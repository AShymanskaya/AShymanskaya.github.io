#!/usr/bin/env python3
"""
Cherry Blossom Prediction Workflow - Updated for 2026 Predictions with XGBoost

This script provides a complete workflow for:
1. Training a model on historical data from 2015-2025 using XGBoost
2. Fetching daily weather updates via Meteostat API
3. Making daily updated predictions for 2026 using the trained model
4. Handling bloom confirmations and model retraining when needed

Usage:
- For initial setup: python cherry_blossom_workflow.py --setup
- For daily updates: python cherry_blossom_workflow.py --update
- To force retraining: python cherry_blossom_workflow.py --retrain
- To confirm bloom: python cherry_blossom_workflow.py --confirm-bloom YYYY-MM-DD
"""

import pandas as pd
import numpy as np
import os
import sys
import pickle
import json
import requests
import argparse
from datetime import datetime, timedelta
import logging
from pathlib import Path
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import cross_val_score, KFold

# Try to import python-dotenv for local development
try:
    from dotenv import load_dotenv
    load_dotenv()  # This loads .env file automatically
except ImportError:
    pass  # python-dotenv not installed, will use environment variables only

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("cherry_blossom_workflow.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("cherry_blossom")

# Dictionary for month names
month_names = {
    1: 'january', 2: 'february', 3: 'march', 4: 'april', 
    5: 'may', 6: 'june', 7: 'july', 8: 'august',
    9: 'september', 10: 'october', 11: 'november', 12: 'december'
}

# Get base directory (repository root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Configuration and paths - Using relative paths that work everywhere
CONFIG = {
    'data_dir': str(BASE_DIR / 'data' / 'daily'),
    'output_dir': str(BASE_DIR / 'data' / 'output'),
    'model_dir': str(BASE_DIR / 'data' / 'model'),
    'docs_dir': str(BASE_DIR),  
    'station_id': '10517',  # Bonn Friesdorf
    'historical_file': 'weather_2015_2023.csv',
    'recent_file': 'weather_2024_2025.csv',
    'daily_predictions_file': 'daily_predictions_2026.csv',
    'history_file': 'history.csv',
    'confirmations_file': 'bloom_confirmations.json',
    'min_year': 2015,
    'max_historical_year': 2025,  # Last year with confirmed bloom data
    'prediction_year': 2026       # Current year to predict
}

def get_api_key():
    """
    Get API key from environment variable or .env file
    Supports both local development and GitHub Actions
    """
    # First try environment variable
    api_key = os.environ.get('RAPID_API_KEY')
    
    # For local development, also check .env file
    if not api_key:
        env_file = BASE_DIR / '.env'
        if env_file.exists():
            try:
                with open(env_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('RAPID_API_KEY='):
                            api_key = line.split('=', 1)[1].strip().strip('"\'')
                            break
            except Exception as e:
                logger.warning(f"Error reading .env file: {e}")
    
    if api_key:
        # Log success without exposing the key
        logger.info(f"API key loaded successfully (length: {len(api_key)}, starts with: {api_key[:4]}...)")
    else:
        logger.error("RAPID_API_KEY not found!")
        logger.error("For local development: Create a .env file with RAPID_API_KEY=your_key")
        logger.error("For GitHub Actions: Add RAPID_API_KEY as a repository secret")
        logger.error("Or export it as environment variable: export RAPID_API_KEY=your_key")
        sys.exit(1)
    
    return api_key

def setup_directories():
    """Setup required directories"""
    directories = [
        CONFIG['data_dir'],
        CONFIG['output_dir'],
        CONFIG['model_dir'],
        CONFIG['docs_dir']
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        logger.info(f"Directory ready: {directory}")
    
    logger.info("All directories created/verified")

def harmonize_historical_data():
    """
    Harmonize data from the historical and recent CSV files
    
    Returns:
    - DataFrame with harmonized data
    """
    logger.info("Harmonizing historical weather data...")
    
    # Define file paths
    historical_file = os.path.join(CONFIG['data_dir'], CONFIG['historical_file'])
    recent_file = os.path.join(CONFIG['data_dir'], CONFIG['recent_file'])
    
    # Check if files exist
    if not os.path.exists(historical_file):
        logger.error(f"Historical data file not found: {historical_file}")
        logger.error("Please ensure weather_2015_2023.csv is in the data/daily directory")
        raise FileNotFoundError(f"Historical data file not found: {historical_file}")
    
    if not os.path.exists(recent_file):
        logger.warning(f"Recent data file not found: {recent_file}. Creating empty file.")
        # Create empty dataframe with correct columns
        empty_df = pd.DataFrame(columns=['date', 'tavg', 'tmin', 'tmax', 'prcp', 'snow', 'wdir', 'wspd', 'wpgt', 'pres', 'year', 'month', 'day'])
        empty_df.to_csv(recent_file, index=False)
    
    # Read the CSV files
    historical_data = pd.read_csv(historical_file)
    recent_data = pd.read_csv(recent_file)
    
    logger.info(f"Read {len(historical_data)} rows from historical data")
    logger.info(f"Read {len(recent_data)} rows from recent data")
    
    # Combine the data
    combined_data = pd.concat([historical_data, recent_data], ignore_index=True)
    logger.info(f"Combined data has {len(combined_data)} rows")
    
    # Convert date column to datetime
    combined_data['date'] = pd.to_datetime(combined_data['date'])
    
    # Ensure year, month, day columns exist
    if 'year' not in combined_data.columns:
        combined_data['year'] = combined_data['date'].dt.year
    if 'month' not in combined_data.columns:
        combined_data['month'] = combined_data['date'].dt.month
    if 'day' not in combined_data.columns:
        combined_data['day'] = combined_data['date'].dt.day
    
    # Sort by date
    combined_data = combined_data.sort_values('date')
    
    # Check for duplicates
    duplicates = combined_data.duplicated(subset=['date'], keep='first')
    if duplicates.any():
        duplicate_count = duplicates.sum()
        logger.warning(f"Found {duplicate_count} duplicate dates - keeping first occurrence")
        combined_data = combined_data.drop_duplicates(subset=['date'], keep='first')
    
    # Save the harmonized data
    output_file = os.path.join(CONFIG['output_dir'], 'harmonized_historical_data.csv')
    combined_data.to_csv(output_file, index=False)
    logger.info(f"Harmonized data saved to {output_file}")
    
    return combined_data

def fetch_meteostat_data(api_key, start_date=None, end_date=None):
    """
    Fetch weather data from Meteostat API for a specific date range
    
    Parameters:
    - api_key: Meteostat API key
    - start_date: Start date in "YYYY-MM-DD" format (defaults to yesterday)
    - end_date: End date in "YYYY-MM-DD" format (defaults to today)
    
    Returns:
    - DataFrame with daily weather data
    """
    logger.info(f"Fetching data from Meteostat API...")
    
    # Set default dates if not provided
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logger.info(f"Date range: {start_date} to {end_date}")
    
    # API endpoint and headers
    url = "https://meteostat.p.rapidapi.com/stations/daily"
    headers = {
        "X-RapidAPI-Host": "meteostat.p.rapidapi.com",
        "X-RapidAPI-Key": api_key
    }
    
    # Query parameters
    params = {
        "station": CONFIG['station_id'],
        "start": start_date,
        "end": end_date
    }
    
    try:
        # Make the API request
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()  # Raise an exception for 4XX/5XX responses
        
        # Parse the JSON response
        data = response.json()
        
        if 'data' not in data or not data['data']:
            logger.warning("No data returned from API")
            return None
        
        # Convert to DataFrame
        df = pd.DataFrame(data['data'])
        
        # Process the data
        df['date'] = pd.to_datetime(df['date'])
        df['year'] = df['date'].dt.year
        df['month'] = df['date'].dt.month
        df['day'] = df['date'].dt.day
        
        logger.info(f"Successfully fetched {len(df)} records")
        return df
        
    except requests.exceptions.HTTPError as e:
        if response.status_code == 403:
            logger.error("API key authentication failed. Please check your API key.")
        else:
            logger.error(f"HTTP error occurred: {e}")
        return None
    except Exception as e:
        logger.error(f"Error fetching data from Meteostat API: {str(e)}")
        return None

def update_weather_data(current_data, api_key):
    """
    Update the weather data with the latest from Meteostat API
    
    Parameters:
    - current_data: DataFrame with current data
    - api_key: Meteostat API key
    
    Returns:
    - Updated DataFrame, boolean indicating if data was updated
    """
    # Determine the date range to fetch
    most_recent_date = current_data['date'].max()
    start_date = (most_recent_date + pd.Timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Current date
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    # Check if we need to fetch new data
    if start_date > end_date:
        logger.info("Data is already up to date")
        return current_data, False
    
    # Fetch new data
    new_data = fetch_meteostat_data(api_key, start_date=start_date, end_date=end_date)
    
    if new_data is None or len(new_data) == 0:
        logger.info("No new data to add")
        return current_data, False
    
    # Combine with existing data
    updated_data = pd.concat([current_data, new_data], ignore_index=True)
    
    # Sort by date and remove duplicates
    updated_data = updated_data.sort_values('date')
    updated_data = updated_data.drop_duplicates(subset=['date'], keep='last')
    
    logger.info(f"Added {len(new_data)} new records")
    
    # Extract recent data for 2024-2026
    recent_data = updated_data[(updated_data['year'] >= 2024)]
    
    # Save recent data to the recent file
    recent_file = os.path.join(CONFIG['data_dir'], CONFIG['recent_file'])
    recent_data.to_csv(recent_file, index=False)
    logger.info(f"Updated recent data saved to {recent_file}")
    
    return updated_data, True

def generate_daily_features(df, target_date):
    """
    Generate features for a specific date, using all data up to that date.
    This function creates features that update daily as new data becomes available.
    
    Parameters:
    - df: DataFrame with harmonized weather data
    - target_date: The date to generate features for
    
    Returns:
    - Dictionary of features for the target date
    """
    logger.info(f"Generating daily features for {target_date}...")
    
    # Filter data up to target date
    features_df = df[df['date'] <= pd.to_datetime(target_date)].copy()
    
    if len(features_df) == 0:
        logger.warning(f"No data available up to {target_date}")
        return None
    
    # Get the target year
    target_year = pd.to_datetime(target_date).year
    
    # Initialize feature dictionary
    features = {'year': target_year}
    
    # Calculate temperature range
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['temp_range'] = features_df['tmax'] - features_df['tmin']
    
    # Calculate growing degree days (base 10°C)
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['gdd_10'] = features_df.apply(
            lambda x: max(0, (x['tmax'] + x['tmin']) / 2 - 10), axis=1
        )
        features_df['cum_gdd_10'] = features_df.groupby('year')['gdd_10'].cumsum()
    
    # Calculate chilling hours (hours below 7.2°C, approximated)
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['chill_day'] = features_df.apply(
            lambda x: 1 if x['tmax'] < 7.2 else (0 if x['tmin'] > 7.2 else 0.5), axis=1
        )
        features_df['cum_chill_days'] = features_df.groupby('year')['chill_day'].cumsum()
    
    # Calculate day of year
    features_df['day_of_year'] = features_df['date'].dt.dayofyear
    
    # Get year-to-date data for target year
    ytd_data = features_df[features_df['year'] == target_year]
    
    # Calculate monthly statistics up to current date
    for month in range(1, 13):
        month_data = features_df[(features_df['year'] == target_year) & (features_df['month'] == month)]
        
        if len(month_data) > 0:
            # Temperature averages
            for col in ['tavg', 'tmin', 'tmax']:
                if col in month_data.columns:
                    features[f"{month_names[month]}_{col}"] = month_data[col].mean()
            
            # Precipitation sum
            if 'prcp' in month_data.columns:
                features[f"{month_names[month]}_prcp_sum"] = month_data['prcp'].sum()
            
            # Snow sum
            if 'snow' in month_data.columns:
                features[f"{month_names[month]}_snow_sum"] = month_data['snow'].fillna(0).sum()
            
            # Chill days sum
            if 'chill_day' in month_data.columns:
                features[f"{month_names[month]}_chill_days"] = month_data['chill_day'].sum()
            
            # GDD sum
            if 'gdd_10' in month_data.columns:
                features[f"{month_names[month]}_gdd_sum"] = month_data['gdd_10'].sum()
    
    # Calculate cumulative features up to target date
    if len(ytd_data) > 0:
        features['ytd_avg_temp'] = ytd_data['tavg'].mean()
        features['ytd_total_prcp'] = ytd_data['prcp'].sum()
        features['ytd_total_gdd'] = ytd_data['gdd_10'].sum() if 'gdd_10' in ytd_data.columns else 0
        features['ytd_total_chill_days'] = ytd_data['chill_day'].sum() if 'chill_day' in ytd_data.columns else 0
    
    # Calculate recent rolling averages (last 7, 14, 30 days)
    for window in [7, 14, 30, 60, 90]:
        recent_data = features_df[
            (features_df['date'] > pd.to_datetime(target_date) - pd.Timedelta(days=window)) &
            (features_df['date'] <= pd.to_datetime(target_date))
        ]
        
        if len(recent_data) > 0:
            features[f'tavg_roll_{window}d'] = recent_data['tavg'].mean()
            features[f'tmin_roll_{window}d'] = recent_data['tmin'].mean()
            features[f'tmax_roll_{window}d'] = recent_data['tmax'].mean()
            if window <= 30:  # Only do precipitation sum for shorter windows
                features[f'prcp_roll_{window}d'] = recent_data['prcp'].sum()
    
    # Winter features (Dec previous year, Jan, Feb current year)
    dec_data = features_df[(features_df['year'] == target_year-1) & (features_df['month'] == 12)]
    jan_data = features_df[(features_df['year'] == target_year) & (features_df['month'] == 1)]
    feb_data = features_df[(features_df['year'] == target_year) & (features_df['month'] == 2)]
    
    winter_data = pd.concat([dec_data, jan_data, feb_data])
    
    if len(winter_data) > 0:
        features['winter_tavg'] = winter_data['tavg'].mean()
        features['winter_tmin'] = winter_data['tmin'].mean()
        features['winter_tmax'] = winter_data['tmax'].mean()
        features['winter_prcp_sum'] = winter_data['prcp'].sum()
        features['winter_snow_sum'] = winter_data['snow'].fillna(0).sum() if 'snow' in winter_data.columns else 0
        features['winter_chill_days'] = winter_data['chill_day'].sum() if 'chill_day' in winter_data.columns else 0
        features['winter_full_tavg'] = features['winter_tavg']
        features['winter_full_chill_days'] = features['winter_chill_days']
    
    # Spring features (Mar, Apr, May) - partial if not all months available
    spring_data = features_df[(features_df['year'] == target_year) & (features_df['month'].isin([3, 4, 5]))]
    
    if len(spring_data) > 0:
        features['spring_tavg'] = spring_data['tavg'].mean()
        features['spring_gdd_sum'] = spring_data['gdd_10'].sum() if 'gdd_10' in spring_data.columns else 0
    
    # Fall features (Sep, Oct, Nov)
    fall_data = features_df[(features_df['year'] == target_year) & (features_df['month'].isin([9, 10, 11]))]
    
    if len(fall_data) > 0:
        features['fall_tavg'] = fall_data['tavg'].mean()
        features['fall_chill_days'] = fall_data['chill_day'].sum() if 'chill_day' in fall_data.columns else 0
    
    # Summer features (Jun, Jul, Aug)
    summer_data = features_df[(features_df['year'] == target_year) & (features_df['month'].isin([6, 7, 8]))]
    
    if len(summer_data) > 0:
        features['summer_tavg'] = summer_data['tavg'].mean()
        features['summer_gdd_sum'] = summer_data['gdd_10'].sum() if 'gdd_10' in summer_data.columns else 0
    
    # Year statistics
    year_data = features_df[features_df['year'] == target_year]
    if len(year_data) > 0:
        features['year_avg_temp'] = year_data['tavg'].mean()
        features['year_total_prcp'] = year_data['prcp'].sum()
        features['year_total_chill_days'] = year_data['chill_day'].sum() if 'chill_day' in year_data.columns else 0
        features['year_total_gdd'] = year_data['gdd_10'].sum() if 'gdd_10' in year_data.columns else 0
    
    # Previous year statistics
    prev_year_data = features_df[features_df['year'] == target_year - 1]
    
    if len(prev_year_data) > 0:
        features['prev_year_avg_temp'] = prev_year_data['tavg'].mean()
        features['prev_year_total_prcp'] = prev_year_data['prcp'].sum()
        
        if 'chill_day' in prev_year_data.columns:
            features['prev_year_total_chill_days'] = prev_year_data['chill_day'].sum()
        
        # Previous fall statistics
        prev_fall_data = prev_year_data[prev_year_data['month'].isin([9, 10, 11])]
        if len(prev_fall_data) > 0:
            features['prev_fall_tavg'] = prev_fall_data['tavg'].mean()
            if 'chill_day' in prev_fall_data.columns:
                features['prev_fall_chill_days'] = prev_fall_data['chill_day'].sum()
    
    # Calculate photoperiod (day length) approximation
    lat_rad = np.radians(50.7)  # Bonn latitude
    day_of_year = pd.to_datetime(target_date).dayofyear
    features['photoperiod'] = 12 + (24/np.pi) * np.arcsin(
        0.39795 * np.cos(0.2163108 + 2 * np.arctan(0.9671396 * np.tan(0.00860 * (day_of_year - 186))))
    ) * np.sin(lat_rad)
    
    # Days since winter solstice
    if pd.to_datetime(target_date).month < 6:
        winter_solstice = pd.Timestamp(year=target_year-1, month=12, day=21)
    else:
        winter_solstice = pd.Timestamp(year=target_year, month=12, day=21)
    
    features['days_since_winter_solstice'] = (pd.to_datetime(target_date) - winter_solstice).days
    
    return features

def generate_features(df):
    """
    Generate additional features needed for cherry blossom prediction
    
    Parameters:
    - df: DataFrame with harmonized weather data
    
    Returns:
    - DataFrame with additional features
    """
    logger.info("Generating features for cherry blossom prediction...")
    
    # Create a copy to avoid modifying the original
    features_df = df.copy()
    
    # Calculate temperature range
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['temp_range'] = features_df['tmax'] - features_df['tmin']
    
    # Calculate growing degree days (base 10°C)
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['gdd_10'] = features_df.apply(
            lambda x: max(0, (x['tmax'] + x['tmin']) / 2 - 10), axis=1
        )
        features_df['cum_gdd_10'] = features_df.groupby('year')['gdd_10'].cumsum()
    
    # Calculate chilling hours (hours below 7.2°C, approximated)
    if all(col in features_df.columns for col in ['tmax', 'tmin']):
        features_df['chill_day'] = features_df.apply(
            lambda x: 1 if x['tmax'] < 7.2 else (0 if x['tmin'] > 7.2 else 0.5), axis=1
        )
        features_df['cum_chill_days'] = features_df.groupby('year')['chill_day'].cumsum()
    
    # Calculate day of year
    features_df['day_of_year'] = features_df['date'].dt.dayofyear
    
    # Calculate monthly statistics for each year for ALL months
    for month in range(1, 13):  # All 12 months
        month_data = features_df[features_df['month'] == month]
        
        for year in features_df['year'].unique():
            year_month_data = month_data[month_data['year'] == year]
            
            if len(year_month_data) > 0:
                # Temperature averages
                for col in ['tavg', 'tmin', 'tmax']:
                    if col in features_df.columns:
                        col_name = f"{month_names[month]}_{col}"
                        features_df.loc[features_df['year'] == year, col_name] = year_month_data[col].mean()
                
                # Precipitation sum
                if 'prcp' in features_df.columns:
                    col_name = f"{month_names[month]}_prcp_sum"
                    features_df.loc[features_df['year'] == year, col_name] = year_month_data['prcp'].sum()
                
                # Snow sum
                if 'snow' in features_df.columns:
                    col_name = f"{month_names[month]}_snow_sum"
                    features_df.loc[features_df['year'] == year, col_name] = year_month_data['snow'].fillna(0).sum()
                
                # Chill days sum
                if 'chill_day' in features_df.columns:
                    col_name = f"{month_names[month]}_chill_days"
                    features_df.loc[features_df['year'] == year, col_name] = year_month_data['chill_day'].sum()
                
                # GDD sum
                if 'gdd_10' in features_df.columns:
                    col_name = f"{month_names[month]}_gdd_sum"
                    features_df.loc[features_df['year'] == year, col_name] = year_month_data['gdd_10'].sum()
    
    # For winter features, we'll use February as the representative month
    if 'february_tavg' in features_df.columns:
        features_df['winter_tavg'] = features_df['february_tavg']
        features_df['winter_tmin'] = features_df['february_tmin'] 
        features_df['winter_tmax'] = features_df['february_tmax']
        features_df['winter_prcp_sum'] = features_df['february_prcp_sum']
        features_df['winter_snow_sum'] = features_df['february_snow_sum']
        features_df['winter_chill_days'] = features_df['february_chill_days']
    
    # Calculate seasonal features
    for year in features_df['year'].unique():
        # Winter (Dec, Jan, Feb)
        dec_data = features_df[(features_df['year'] == year-1) & (features_df['month'] == 12)]
        jan_data = features_df[(features_df['year'] == year) & (features_df['month'] == 1)]
        feb_data = features_df[(features_df['year'] == year) & (features_df['month'] == 2)]
        
        winter_data = pd.concat([dec_data, jan_data, feb_data])
        
        if len(winter_data) > 0:
            features_df.loc[features_df['year'] == year, 'winter_full_tavg'] = winter_data['tavg'].mean()
            if 'chill_day' in winter_data.columns:
                features_df.loc[features_df['year'] == year, 'winter_full_chill_days'] = winter_data['chill_day'].sum()
        
        # Spring (Mar, Apr, May)
        spring_data = features_df[(features_df['year'] == year) & (features_df['month'].isin([3, 4, 5]))]
        
        if len(spring_data) > 0:
            features_df.loc[features_df['year'] == year, 'spring_tavg'] = spring_data['tavg'].mean()
            if 'gdd_10' in spring_data.columns:
                features_df.loc[features_df['year'] == year, 'spring_gdd_sum'] = spring_data['gdd_10'].sum()
        
        # Summer (Jun, Jul, Aug)
        summer_data = features_df[(features_df['year'] == year) & (features_df['month'].isin([6, 7, 8]))]
        
        if len(summer_data) > 0:
            features_df.loc[features_df['year'] == year, 'summer_tavg'] = summer_data['tavg'].mean()
            if 'gdd_10' in summer_data.columns:
                features_df.loc[features_df['year'] == year, 'summer_gdd_sum'] = summer_data['gdd_10'].sum()
        
        # Fall (Sep, Oct, Nov)
        fall_data = features_df[(features_df['year'] == year) & (features_df['month'].isin([9, 10, 11]))]
        
        if len(fall_data) > 0:
            features_df.loc[features_df['year'] == year, 'fall_tavg'] = fall_data['tavg'].mean()
            if 'chill_day' in fall_data.columns:
                features_df.loc[features_df['year'] == year, 'fall_chill_days'] = fall_data['chill_day'].sum()
    
    # Calculate calendar year statistics
    for year in features_df['year'].unique():
        year_data = features_df[features_df['year'] == year]
        if len(year_data) > 0:
            features_df.loc[features_df['year'] == year, 'year_avg_temp'] = year_data['tavg'].mean()
            features_df.loc[features_df['year'] == year, 'year_total_prcp'] = year_data['prcp'].sum()
            if 'chill_day' in year_data.columns:
                features_df.loc[features_df['year'] == year, 'year_total_chill_days'] = year_data['chill_day'].sum()
            if 'gdd_10' in year_data.columns:
                features_df.loc[features_df['year'] == year, 'year_total_gdd'] = year_data['gdd_10'].sum()
    
    # Calculate previous year's statistics
    for year in features_df['year'].unique():
        if year-1 in features_df['year'].unique():
            prev_year_data = features_df[features_df['year'] == year-1]
            
            if len(prev_year_data) > 0:
                features_df.loc[features_df['year'] == year, 'prev_year_avg_temp'] = prev_year_data['tavg'].mean()
                features_df.loc[features_df['year'] == year, 'prev_year_total_prcp'] = prev_year_data['prcp'].sum()
                if 'chill_day' in prev_year_data.columns:
                    features_df.loc[features_df['year'] == year, 'prev_year_total_chill_days'] = prev_year_data['chill_day'].sum()
                
                # Previous fall statistics (important for winter dormancy)
                prev_fall_data = prev_year_data[prev_year_data['month'].isin([9, 10, 11])]
                if len(prev_fall_data) > 0:
                    features_df.loc[features_df['year'] == year, 'prev_fall_tavg'] = prev_fall_data['tavg'].mean()
                    if 'chill_day' in prev_fall_data.columns:
                        features_df.loc[features_df['year'] == year, 'prev_fall_chill_days'] = prev_fall_data['chill_day'].sum()
    
    # Calculate moving windows of temperature
    for window in [30, 60, 90]:
        features_df[f'tavg_roll_{window}d'] = features_df['tavg'].rolling(window=window, min_periods=1).mean()
        features_df[f'tmin_roll_{window}d'] = features_df['tmin'].rolling(window=window, min_periods=1).mean()
        features_df[f'tmax_roll_{window}d'] = features_df['tmax'].rolling(window=window, min_periods=1).mean()
    
    # Calculate photoperiod (day length) approximation
    # Using 50.7° for Bonn latitude
    lat_rad = np.radians(50.7)
    features_df['photoperiod'] = features_df.apply(
        lambda x: 12 + (24/np.pi) * np.arcsin(
            0.39795 * np.cos(0.2163108 + 2 * np.arctan(0.9671396 * np.tan(0.00860 * (x['day_of_year'] - 186))))
        ) * np.sin(lat_rad),
        axis=1
    )
    
    # Calculate days since winter solstice (a useful feature for bloom timing)
    features_df['days_since_winter_solstice'] = features_df.apply(
        lambda x: (x['date'] - pd.Timestamp(year=x['year']-1, month=12, day=21)).days
        if x['month'] < 6 else 
        (x['date'] - pd.Timestamp(year=x['year'], month=12, day=21)).days, 
        axis=1
    )
    
    logger.info("Feature generation complete")
    return features_df

def add_cherry_blossom_data(df):
    """
    Add cherry blossom blooming start and end dates.
    
    Parameters:
    - df: DataFrame with weather data
    
    Returns:
    - DataFrame with added cherry blossom columns
    """
    logger.info("Adding cherry blossom historical data...")
    
    # Create a copy to avoid modifying the original
    blossom_df = df.copy()
    
    # Create empty columns for cherry blossom data
    blossom_df['bloom_start'] = pd.NaT
    blossom_df['bloom_end'] = pd.NaT
    blossom_df['is_blooming'] = False
    blossom_df['bloom_duration'] = np.nan
    
    # Cherry blossom data (including 2025 - you'll need to add actual data when available)
    bloom_data = {
        2015: {'start': '2015-04-16', 'end': '2015-04-27'},
        2016: {'start': '2016-04-14', 'end': '2016-04-26'},
        2017: {'start': '2017-03-31', 'end': '2017-04-15'},
        2018: {'start': '2018-04-15', 'end': '2018-04-28'},
        2019: {'start': '2019-04-07', 'end': '2019-04-22'},
        2020: {'start': '2020-04-04', 'end': '2020-04-14'},
        2021: {'start': '2021-04-13', 'end': '2021-04-29'},
        2022: {'start': '2022-04-07', 'end': '2022-04-22'},  
        2023: {'start': '2023-04-11', 'end': '2023-04-26'},
        2024: {'start': '2024-03-30', 'end': '2024-04-10'},
        2025: {'start': '2025-04-05', 'end': '2025-04-15'},  
    }
    
    # Check for bloom confirmations and update bloom_data
    confirmations_file = os.path.join(CONFIG['output_dir'], CONFIG['confirmations_file'])
    if os.path.exists(confirmations_file):
        try:
            with open(confirmations_file, 'r') as f:
                confirmations = json.load(f)
            
            for confirmation in confirmations:
                year = confirmation['year']
                
                # Create or update the entry in bloom_data
                if 'actual_bloom_start' in confirmation and confirmation['actual_bloom_start']:
                    start_date = confirmation['actual_bloom_start']
                    end_date = confirmation.get('actual_bloom_end', None)
                    
                    if not end_date and 'estimated_duration' in confirmation:
                        # Calculate end date based on start date and estimated duration
                        start = pd.to_datetime(start_date)
                        end_date = (start + pd.Timedelta(days=int(confirmation['estimated_duration'])-1)).strftime('%Y-%m-%d')
                    
                    if end_date:
                        bloom_data[year] = {'start': start_date, 'end': end_date}
                        logger.info(f"Updated bloom data for {year} from confirmations: {start_date} to {end_date}")
        except Exception as e:
            logger.error(f"Error loading bloom confirmations: {str(e)}")
    
    # Add bloom data to the DataFrame
    for year, bloom_info in bloom_data.items():
        start_date = pd.to_datetime(bloom_info['start'])
        end_date = pd.to_datetime(bloom_info['end'])
        
        # Skip if this year isn't in the data
        if year not in blossom_df['year'].unique():
            continue
        
        # Mark the start and end dates
        blossom_df.loc[blossom_df['date'] == start_date, 'bloom_start'] = start_date
        blossom_df.loc[blossom_df['date'] == end_date, 'bloom_end'] = end_date
        
        # Mark the blooming period
        blooming_mask = (blossom_df['date'] >= start_date) & (blossom_df['date'] <= end_date)
        blossom_df.loc[blooming_mask, 'is_blooming'] = True
        
        # Calculate bloom duration for the year
        duration = (end_date - start_date).days + 1
        blossom_df.loc[blossom_df['year'] == year, 'bloom_duration'] = duration
    
    # For years with bloom data, calculate days to bloom
    for year in bloom_data.keys():
        # Skip if this year isn't in the data
        if year not in blossom_df['year'].unique():
            continue
            
        year_data = blossom_df[blossom_df['year'] == year]
        bloom_start_date = pd.to_datetime(bloom_data[year]['start'])
        bloom_start_doy = bloom_start_date.dayofyear
        
        # Calculate days until bloom (negative before bloom, positive after)
        blossom_df.loc[blossom_df['year'] == year, 'days_to_bloom'] = (
            blossom_df.loc[blossom_df['year'] == year, 'day_of_year'] - bloom_start_doy
        )
    
    return blossom_df

def train_prediction_model(training_data):
    """
    Train a prediction model for cherry blossom start date using XGBoost.
    Updated to include 2025 data in training.
    """
    logger.info("Training cherry blossom prediction model with XGBoost (2015-2025 data)...")
    
    # Prepare features for each year
    yearly_features = []
    
    for year in training_data['year'].unique():
        # Skip 2026 as it's the prediction year
        if year > 2025:
            continue
            
        year_data = training_data[training_data['year'] == year]
        
        # Skip if there's no bloom data for this year
        bloom_start_rows = year_data[~year_data['bloom_start'].isna()]
        if len(bloom_start_rows) == 0:
            logger.info(f"Skipping year {year} - no bloom start date found")
            continue
            
        # Get the bloom start date for this year
        bloom_start = bloom_start_rows['date'].iloc[0]
        bloom_doy = bloom_start.dayofyear  # day of year
        
        # Get data from all necessary months
        # Previous year December
        prev_dec_data = training_data[(training_data['year'] == year-1) & (training_data['month'] == 12)]
        
        # Current year January through April
        current_winter_spring_data = year_data[year_data['month'].isin([1, 2, 3, 4])]
        
        # Ensure we have enough data from the crucial months
        if len(prev_dec_data) < 20:
            logger.warning(f"Limited December data for previous year ({len(prev_dec_data)} days)")
            
        if len(current_winter_spring_data) < 90:  # Approximately 90 days in Jan-Mar
            logger.warning(f"Incomplete winter/spring data for {year} ({len(current_winter_spring_data)} days)")
        
        # Get a sample row with comprehensive features (from late March)
        march_data = year_data[year_data['month'] == 3]
        if len(march_data) < 25:  # Allow some missing days in March
            logger.warning(f"Skipping year {year} - insufficient March data ({len(march_data)} days)")
            continue
            
        late_march_data = march_data.sort_values('date').tail(1)
        if len(late_march_data) == 0:
            logger.warning(f"Skipping year {year} - can't find late March data")
            continue
            
        sample_row = late_march_data.iloc[0]
        
        # Create feature dictionary for this year
        features = {
            'year': year,
            'bloom_start_doy': bloom_doy
        }
        
        # Add all available monthly features
        crucial_months = ['december', 'january', 'february', 'march', 'april']
        
        # Get all columns in the sample row
        all_columns = sample_row.index.tolist()
        
        # Find all monthly feature columns
        month_cols = []
        for col in all_columns:
            for month in crucial_months:
                if col.startswith(f"{month}_") and not pd.isna(sample_row[col]):
                    month_cols.append(col)
        
        # Add seasonal and calendar features
        seasonal_cols = [col for col in all_columns if any(x in col for x in ['winter', 'spring', 'fall', 'summer', 'year_'])]
        
        # Also add rolling window features
        rolling_cols = [col for col in all_columns if 'roll_' in col]
        
        # All features to include
        feature_cols = month_cols + seasonal_cols + rolling_cols
        
        # Add all valid features to our feature dictionary
        for col in feature_cols:
            if not pd.isna(sample_row[col]):
                features[col] = sample_row[col]
        
        yearly_features.append(features)
    
    # Create DataFrame with yearly features
    if not yearly_features:
        raise ValueError("No valid training data years found")
        
    yearly_df = pd.DataFrame(yearly_features)
    
    # Get all feature columns (excluding 'year' and 'bloom_start_doy')
    feature_cols = [col for col in yearly_df.columns if col not in ['year', 'bloom_start_doy']]
    
    # Check for missing values in feature columns
    missing_values = yearly_df[feature_cols].isna().sum()
    if missing_values.sum() > 0:
        logger.warning("Missing values in feature columns:")
        for col, count in missing_values[missing_values > 0].items():
            logger.warning(f"  {col}: {count} missing values")
        
        # Fill missing values with the mean of each column
        yearly_df[feature_cols] = yearly_df[feature_cols].fillna(yearly_df[feature_cols].mean())
        logger.info("Missing values filled with column means")
    
    # Prepare data for model training
    X = yearly_df[feature_cols]
    y = yearly_df['bloom_start_doy']
    
    # Train XGBoost model with optimized hyperparameters
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=1,
        gamma=0.1,
        reg_alpha=0.05,
        reg_lambda=1,
        random_state=42,
        objective='reg:squarederror'
    )
    
    model.fit(X, y, 
              eval_set=[(X, y)],
              verbose=False)
    
    # Get feature importance
    feature_importance = pd.DataFrame({
        'Feature': feature_cols,
        'Importance': model.feature_importances_
    }).sort_values('Importance', ascending=False)
    
    logger.info("Top 10 Feature Importance (XGBoost):")
    for i, (feature, importance) in enumerate(zip(feature_importance['Feature'].head(10), 
                                              feature_importance['Importance'].head(10))):
        logger.info(f"  {i+1}. {feature}: {importance:.4f}")
    
    # Make predictions for training data
    y_pred = model.predict(X)
    
    # Calculate errors
    mae = mean_absolute_error(y, y_pred)
    rmse = np.sqrt(mean_squared_error(y, y_pred))
    
    # Perform cross-validation for better error estimate
    kfold = KFold(n_splits=min(5, len(X)), shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=kfold, scoring='neg_mean_absolute_error')
    cv_mae = -cv_scores.mean()
    
    logger.info(f"XGBoost Model Performance:")
    logger.info(f"  Mean Absolute Error: {mae:.2f} days")
    logger.info(f"  Cross-Validation MAE: {cv_mae:.2f} days")
    logger.info(f"  Root Mean Squared Error: {rmse:.2f} days")
    
    # Save actual vs predicted for training years
    results_df = pd.DataFrame({
        'year': yearly_df['year'],
        'actual_bloom_doy': y,
        'predicted_bloom_doy': y_pred,
        'error_days': y_pred - y
    })
    
    # Convert day of year to date
    results_df['actual_bloom_date'] = results_df.apply(
        lambda x: pd.Timestamp(year=int(x['year']), month=1, day=1) + 
                 pd.Timedelta(days=int(x['actual_bloom_doy'])-1),
        axis=1
    )
    
    results_df['predicted_bloom_date'] = results_df.apply(
        lambda x: pd.Timestamp(year=int(x['year']), month=1, day=1) + 
                 pd.Timedelta(days=int(x['predicted_bloom_doy'])-1),
        axis=1
    )
    
    logger.info("Training Results (XGBoost):")
    for _, row in results_df.iterrows():
        logger.info(f"  {int(row['year'])}: Actual {row['actual_bloom_date'].strftime('%Y-%m-%d')}, "
                   f"Predicted {row['predicted_bloom_date'].strftime('%Y-%m-%d')}, "
                   f"Error: {row['error_days']:.1f} days")
    
    # Save training results
    results_file = os.path.join(CONFIG['output_dir'], 'model_training_results.csv')
    results_df.to_csv(results_file, index=False)
    logger.info(f"Training results saved to {results_file}")
    
    # Save the model and feature columns
    # Use cross-validation MAE for reporting as it's more robust
    save_model(model, feature_cols, cv_mae)
    
    return model, feature_cols

def save_model(model, feature_cols, mae=None):
    """
    Save the trained XGBoost model and associated metadata to files
    """
    # Create model directory if it doesn't exist
    os.makedirs(CONFIG['model_dir'], exist_ok=True)
    
    # Save model with timestamp to keep version history
    timestamp = datetime.now().strftime('%Y%m%d')
    model_path = os.path.join(CONFIG['model_dir'], f'cherry_blossom_xgboost_{timestamp}.pkl')
    
    # Also save as latest model for easy reference
    latest_model_path = os.path.join(CONFIG['model_dir'], 'cherry_blossom_model_latest.pkl')
    
    # Save the model files
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    with open(latest_model_path, 'wb') as f:
        pickle.dump(model, f)
        
    # Save feature columns
    feature_cols_path = os.path.join(CONFIG['model_dir'], 'feature_cols.json')
    with open(feature_cols_path, 'w') as f:
        json.dump(feature_cols, f)
    
    # Save metadata including training date
    metadata = {
        'model_type': 'XGBoost',
        'training_date': datetime.now().strftime('%Y-%m-%d'),
        'feature_count': len(feature_cols),
        'model_file': os.path.basename(model_path),
        'training_years': '2015-2025',
        'prediction_year': 2026,
        'model_mae': round(float(mae), 2) if mae else None,  # Round to 2 decimal places
        'top_features': list(zip(
            [c for c, _ in sorted(zip(feature_cols, model.feature_importances_), 
                                  key=lambda x: x[1], reverse=True)[:10]], 
            [float(i) for i in sorted(model.feature_importances_, reverse=True)[:10]]
        ))
    }
    
    metadata_path = os.path.join(CONFIG['model_dir'], 'model_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"XGBoost model saved to {model_path} and {latest_model_path}")
    return model_path

def load_model():
    """
    Load the trained model and feature columns
    """
    model_path = os.path.join(CONFIG['model_dir'], 'cherry_blossom_model_latest.pkl')
    feature_cols_path = os.path.join(CONFIG['model_dir'], 'feature_cols.json')
    
    try:
        # Check if files exist
        if not os.path.exists(model_path) or not os.path.exists(feature_cols_path):
            logger.error(f"Model files not found at {model_path}")
            return None, None
        
        # Load model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        # Load feature columns
        with open(feature_cols_path, 'r') as f:
            feature_cols = json.load(f)
        
        logger.info(f"Model loaded with {len(feature_cols)} features")
        return model, feature_cols
        
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        return None, None

def make_daily_prediction(model, feature_cols, data, target_date, year=None):
    """
    Make a prediction for a specific date using daily-updated features
    
    Parameters:
    - model: Trained XGBoost model
    - feature_cols: List of feature columns used by the model
    - data: Complete DataFrame with all available data
    - target_date: Date to make prediction for
    - year: Year to predict (defaults to CONFIG['prediction_year'])
    
    Returns:
    - Dictionary with prediction results for that date
    """
    if year is None:
        year = CONFIG['prediction_year']
    
    # Generate features for the target date
    daily_features = generate_daily_features(data, target_date)
    
    if daily_features is None:
        logger.warning(f"Could not generate features for {target_date}")
        return None
    
    # Create DataFrame for prediction
    pred_features = {}
    
    # Add available features
    for col in feature_cols:
        if col in daily_features:
            pred_features[col] = daily_features[col]
        else:
            # Use default value for missing features
            pred_features[col] = 0.0
    
    # Create DataFrame
    pred_df = pd.DataFrame([pred_features])
    
    # Make prediction
    predicted_doy = model.predict(pred_df[feature_cols])[0]
    
    # Convert to date
    predicted_date = pd.Timestamp(year=year, month=1, day=1) + pd.Timedelta(days=int(predicted_doy)-1)
    
    # Calculate days until bloom
    days_until_bloom = (predicted_date - pd.to_datetime(target_date)).days
    
    # Average bloom duration from historical data
    avg_bloom_duration = 14  # Average from historical data
    predicted_end_date = predicted_date + pd.Timedelta(days=avg_bloom_duration-1)
    
    # Create prediction result
    prediction = {
        'prediction_date': target_date.strftime('%Y-%m-%d'),
        'year': year,
        'predicted_bloom_doy': float(predicted_doy),
        'predicted_bloom_start': predicted_date.strftime('%Y-%m-%d'),
        'estimated_bloom_end': predicted_end_date.strftime('%Y-%m-%d'),
        'days_until_bloom': days_until_bloom,
        'confidence': determine_confidence(pd.to_datetime(target_date), days_until_bloom),
        'features_available': len([k for k in daily_features.keys() if k in feature_cols])
    }
    
    return prediction

def determine_confidence(current_date, days_until_bloom):
    """
    Determine confidence level based on date and days until bloom
    """
    current_month = current_date.month
    
    if days_until_bloom < 7:
        return 'very_high'
    elif days_until_bloom < 14:
        return 'high'
    elif current_month >= 3 and days_until_bloom < 30:
        return 'medium-high'
    elif current_month >= 2:
        return 'medium'
    else:
        return 'low'

def save_daily_predictions(predictions):
    """
    Save daily predictions to CSV file and JSON for web interface
    """
    if not predictions:
        return False
    
    try:
        # Create DataFrame
        pred_df = pd.DataFrame(predictions)
        
        # Save to CSV file
        csv_file = os.path.join(CONFIG['output_dir'], CONFIG['daily_predictions_file'])
        
        if os.path.exists(csv_file):
            # Append to existing file
            existing_df = pd.read_csv(csv_file)
            combined_df = pd.concat([existing_df, pred_df], ignore_index=True)
            
            # Remove duplicates (keep latest prediction for each date)
            combined_df = combined_df.drop_duplicates(subset=['prediction_date'], keep='last')
            combined_df.to_csv(csv_file, index=False)
        else:
            # Create new file
            pred_df.to_csv(csv_file, index=False)
        
        logger.info(f"Saved {len(predictions)} daily predictions to {csv_file}")
        
        # Also save latest prediction as JSON for web interface
        save_prediction_json(predictions[-1] if predictions else None)
        
        return True
        
    except Exception as e:
        logger.error(f"Error saving daily predictions: {str(e)}")
        return False

def save_prediction_json(prediction):
    """
    Save the latest prediction in JSON format for the web interface
    """
    if not prediction:
        return False
    
    try:
        # Load model metadata for MAE
        metadata_path = os.path.join(CONFIG['model_dir'], 'model_metadata.json')
        model_mae = 1.40  # Default value
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                model_mae = metadata.get('model_mae', 1.40)
        
        # Ensure MAE is rounded to 2 decimal places
        model_mae = round(float(model_mae), 2)
        
        # Enhance prediction data for web display
        enhanced_prediction = prediction.copy()
        
        # Add confidence percentage based on confidence level
        confidence_map = {
            'very_high': 95,
            'high': 85,
            'medium-high': 70,
            'medium': 50,
            'low': 30
        }
        enhanced_prediction['confidence_percent'] = confidence_map.get(
            prediction.get('confidence', 'low'), 50
        )
        
        # Calculate predicted peak (middle of bloom period)
        if 'predicted_bloom_start' in prediction and 'estimated_bloom_end' in prediction:
            start = pd.to_datetime(prediction['predicted_bloom_start'])
            end = pd.to_datetime(prediction['estimated_bloom_end'])
            peak = start + (end - start) / 2
            enhanced_prediction['predicted_peak'] = peak.strftime('%Y-%m-%d')
        
        # Add model performance metrics
        enhanced_prediction['model_mae'] = model_mae
        enhanced_prediction['data_points'] = '11 years'
        enhanced_prediction['estimated_duration'] = 14  # Average bloom duration
        
        # Add timestamp
        enhanced_prediction['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Save to output directory
        output_file = os.path.join(CONFIG['output_dir'], 'cherry_blossom_prediction.json')
        os.makedirs(CONFIG['output_dir'], exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(enhanced_prediction, f, indent=2)
        
        logger.info(f"Saved prediction to {output_file}")
        
        # Also save to docs directory for GitHub Pages
        web_file = BASE_DIR / 'cherry_blossom_prediction.json'
        with open(web_file, 'w') as f:
            json.dump(enhanced_prediction, f, indent=2)
        
        logger.info(f"Saved prediction to {web_file}")
        
        # Also save all predictions history
        save_all_predictions_json()
        
        return True
        
    except Exception as e:
        logger.error(f"Error saving prediction JSON: {str(e)}")
        return False

def save_all_predictions_json():
    """
    Save all daily predictions as a JSON array for historical tracking
    """
    try:
        csv_file = os.path.join(CONFIG['output_dir'], CONFIG['daily_predictions_file'])
        
        if os.path.exists(csv_file):
            df = pd.read_csv(csv_file)
            df = df.sort_values('prediction_date')
            predictions_list = df.to_dict('records')
            
            # Save to output directory
            output_file = os.path.join(CONFIG['output_dir'], 'all_predictions_2026.json')
            with open(output_file, 'w') as f:
                json.dump(predictions_list, f, indent=2)
            
            # Save to cherry_blossom root for web access
            web_file = BASE_DIR / 'all_predictions_2026.json'
            with open(web_file, 'w') as f:
                json.dump(predictions_list, f, indent=2)
            
            logger.info(f"Saved {len(predictions_list)} predictions to JSON files")
            
        return True
        
    except Exception as e:
        logger.error(f"Error saving all predictions JSON: {str(e)}")
        return False

def record_bloom_confirmation(year, bloom_date, source="user", notes=""):
    """
    Record a confirmed bloom date
    """
    confirmations_file = os.path.join(CONFIG['output_dir'], CONFIG['confirmations_file'])
    
    try:
        # Create or load existing confirmations
        if os.path.exists(confirmations_file):
            with open(confirmations_file, 'r') as f:
                confirmations = json.load(f)
        else:
            confirmations = []
        
        # Check if this year is already confirmed
        for conf in confirmations:
            if conf['year'] == year:
                # Update existing confirmation
                conf['actual_bloom_start'] = bloom_date
                conf['confirmation_date'] = datetime.now().strftime('%Y-%m-%d')
                conf['confirmation_source'] = source
                conf['notes'] = notes
                break
        else:
            # Add new confirmation
            confirmations.append({
                'year': year,
                'actual_bloom_start': bloom_date,
                'confirmation_date': datetime.now().strftime('%Y-%m-%d'),
                'confirmation_source': source,
                'notes': notes
            })
        
        # Create directory if it doesn't exist
        os.makedirs(CONFIG['output_dir'], exist_ok=True)
        
        # Save confirmations
        with open(confirmations_file, 'w') as f:
            json.dump(confirmations, f, indent=2)
        
        logger.info(f"Recorded bloom confirmation for {year}: {bloom_date}")
        return True
        
    except Exception as e:
        logger.error(f"Error recording bloom confirmation: {str(e)}")
        return False

def should_retrain_model(force=False):
    """
    Determine if model retraining is needed
    """
    if force:
        logger.info("Forcing model retraining")
        return True
    
    # Check for existing model
    latest_model_path = os.path.join(CONFIG['model_dir'], 'cherry_blossom_model_latest.pkl')
    metadata_path = os.path.join(CONFIG['model_dir'], 'model_metadata.json')
    
    if not os.path.exists(latest_model_path) or not os.path.exists(metadata_path):
        logger.info("No existing model found. Training required.")
        return True
    
    # Load metadata to check last training date
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    # Get days since last training
    last_training = datetime.strptime(metadata['training_date'], '%Y-%m-%d')
    days_since_training = (datetime.now() - last_training).days
    
    # Check if a bloom confirmation was received since last training
    confirmation_path = os.path.join(CONFIG['output_dir'], CONFIG['confirmations_file'])
    if os.path.exists(confirmation_path):
        with open(confirmation_path, 'r') as f:
            confirmations = json.load(f)
        
        # Check if there's a new confirmation since last training
        for conf in confirmations:
            if 'confirmation_date' in conf:
                conf_date = datetime.strptime(conf['confirmation_date'], '%Y-%m-%d')
                if conf_date > last_training:
                    logger.info(f"New bloom confirmation found. Retraining required.")
                    return True
    
    # Retrain if it's been more than 30 days or it's a new year
    current_year = datetime.now().year
    if days_since_training > 30 or current_year > last_training.year:
        logger.info(f"Model is {days_since_training} days old. Retraining recommended.")
        return True
    
    logger.info(f"Using existing model (trained {days_since_training} days ago)")
    return False

def make_and_display_prediction(model, feature_cols, data, prediction_date=None, year=2026):
    """
    Make a prediction and display it in a user-friendly format
    
    Parameters:
    - model: Trained model
    - feature_cols: Feature columns
    - data: Weather data
    - prediction_date: Date to predict for (defaults to today)
    - year: Year to predict
    
    Returns:
    - Prediction dictionary
    """
    if prediction_date is None:
        prediction_date = pd.Timestamp.now()
    
    # Make prediction
    pred = make_daily_prediction(model, feature_cols, data, prediction_date, year)
    
    if pred:
        # Display results
        print("\n" + "="*70)
        print(f"🌸 CHERRY BLOSSOM PREDICTION for {prediction_date.strftime('%B %d, %Y')} 🌸")
        print("="*70)
        print(f"\n📅 Predicted Bloom Start: {pd.to_datetime(pred['predicted_bloom_start']).strftime('%B %d, %Y')}")
        print(f"📅 Predicted Bloom End: {pd.to_datetime(pred['estimated_bloom_end']).strftime('%B %d, %Y')}")
        print(f"\n⏰ Days Until Bloom: {pred['days_until_bloom']} days")
        print(f"📊 Confidence Level: {pred['confidence'].replace('_', ' ').upper()}")
        print(f"📈 Day of Year: {pred['predicted_bloom_doy']:.0f}")
        print(f"🤖 Model: XGBoost")
        
        # Add interpretation
        print("\n💡 Interpretation:")
        if pred['days_until_bloom'] < 0:
            print(f"   Bloom has likely already started {abs(pred['days_until_bloom'])} days ago!")
        elif pred['days_until_bloom'] == 0:
            print("   Bloom is predicted to start TODAY!")
        elif pred['days_until_bloom'] <= 7:
            print("   Bloom is imminent! Get ready within a week!")
        elif pred['days_until_bloom'] <= 14:
            print("   Bloom is approaching - about two weeks away.")
        elif pred['days_until_bloom'] <= 30:
            print("   Bloom is expected within a month.")
        else:
            print(f"   Bloom is still {pred['days_until_bloom']} days away.")
        
        # Confidence explanation
        print(f"\n🎯 Confidence Explanation:")
        if pred['confidence'] == 'very_high':
            print("   Very high confidence - bloom is very close and prediction is reliable.")
        elif pred['confidence'] == 'high':
            print("   High confidence - good data available and bloom is near.")
        elif pred['confidence'] == 'medium-high':
            print("   Medium-high confidence - reasonable prediction with good spring data.")
        elif pred['confidence'] == 'medium':
            print("   Medium confidence - prediction based on winter/early spring data.")
        else:
            print("   Low confidence - early prediction, will improve with more data.")
        
        print("="*70 + "\n")
        
        # Log to file as well
        logger.info(f"Prediction displayed for {prediction_date.strftime('%Y-%m-%d')}")
        
    return pred

def main():
    """
    Main function to run the cherry blossom prediction workflow
    """
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Cherry Blossom Prediction Workflow with XGBoost')
    parser.add_argument('--setup', action='store_true', help='Run initial setup')
    parser.add_argument('--update', action='store_true', help='Update prediction with latest data')
    parser.add_argument('--retrain', action='store_true', help='Force model retraining')
    parser.add_argument('--confirm-bloom', metavar='DATE', help='Confirm bloom start date (YYYY-MM-DD)')
    parser.add_argument('--daily', action='store_true', help='Generate daily predictions for 2026')
    parser.add_argument('--predict', action='store_true', help='Force immediate prediction with current data')
    parser.add_argument('--date', metavar='DATE', help='Specific date to predict for (YYYY-MM-DD, default: today)')
    
    args = parser.parse_args()
    
    try:
        # Setup directories
        setup_directories()
        
        # Handle bloom confirmation if provided
        if args.confirm_bloom:
            bloom_date = args.confirm_bloom
            try:
                # Validate date format
                datetime.strptime(bloom_date, '%Y-%m-%d')
                year = int(bloom_date.split('-')[0])
                record_bloom_confirmation(year, bloom_date)
                logger.info(f"Bloom confirmation recorded for {year}: {bloom_date}")
                # Force retraining on next run after confirmation
                args.retrain = True
            except ValueError:
                logger.error(f"Invalid date format: {bloom_date}. Use YYYY-MM-DD")
                return
        
        # Initial setup or force retrain
        if args.setup or args.retrain:
            # Get and harmonize all historical data
            harmonized_data = harmonize_historical_data()
            
            # Generate features
            features_df = generate_features(harmonized_data)
            
            # Add bloom data
            blossom_data = add_cherry_blossom_data(features_df)
            
            # Save processed data
            processed_file = os.path.join(CONFIG['output_dir'], 'processed_blossom_data.csv')
            blossom_data.to_csv(processed_file, index=False)
            logger.info(f"Processed data saved to {processed_file}")
            
            # Train model with data up to 2025
            historical_data = blossom_data[blossom_data['year'] <= CONFIG['max_historical_year']]
            model, feature_cols = train_prediction_model(historical_data)
            
            logger.info("Initial setup completed with XGBoost model")
            
        # Force immediate prediction
        if args.predict:
            logger.info("Forcing immediate prediction...")
            
            # Load model
            model, feature_cols = load_model()
            if model is None:
                logger.error("No model found. Run with --setup first to train a model.")
                return
            
            # Load data
            harmonized_data = harmonize_historical_data()
            
            # Determine prediction date
            if args.date:
                try:
                    prediction_date = pd.to_datetime(args.date)
                except:
                    logger.error(f"Invalid date format: {args.date}. Use YYYY-MM-DD")
                    return
            else:
                prediction_date = pd.Timestamp.now()
            
            # Make and display prediction
            pred = make_and_display_prediction(model, feature_cols, harmonized_data, prediction_date, year=2026)
            
            if pred:
                # Save the prediction
                save_daily_predictions([pred])
                logger.info("Prediction saved to daily predictions file")
            else:
                logger.error("Could not generate prediction")
            
            return
        
        # Generate daily predictions for 2026
        if args.daily:
            logger.info("Generating daily predictions for 2026...")
            
            # Load or train model
            model, feature_cols = load_model()
            if model is None:
                logger.info("Model not found, training new XGBoost model...")
                harmonized_data = harmonize_historical_data()
                features_df = generate_features(harmonized_data)
                blossom_data = add_cherry_blossom_data(features_df)
                historical_data = blossom_data[blossom_data['year'] <= CONFIG['max_historical_year']]
                model, feature_cols = train_prediction_model(historical_data)
            
            # Load data
            harmonized_data = harmonize_historical_data()
            
            # Generate predictions for each day from Jan 1 to Apr 30, 2026
            predictions = []
            start_date = pd.Timestamp(year=2026, month=1, day=1)
            end_date = pd.Timestamp(year=2026, month=4, day=30)
            
            current_date = start_date
            while current_date <= end_date:
                # Make prediction for this date
                pred = make_daily_prediction(model, feature_cols, harmonized_data, current_date, year=2026)
                
                if pred:
                    predictions.append(pred)
                    logger.info(f"  {current_date.strftime('%Y-%m-%d')}: Bloom predicted on {pred['predicted_bloom_start']} "
                               f"({pred['days_until_bloom']} days, confidence: {pred['confidence']})")
                
                current_date += pd.Timedelta(days=1)
            
            # Save all predictions
            if predictions:
                save_daily_predictions(predictions)
                logger.info(f"Generated {len(predictions)} daily predictions for 2026")
            
        # Update prediction with latest data
        elif args.update or (not args.setup and not args.daily and not args.predict):  # Default behavior is to update
            # Get API key
            api_key = get_api_key()
            
            # Load existing data
            harmonized_data = harmonize_historical_data()
            
            # Update with latest weather data
            updated_data, data_changed = update_weather_data(harmonized_data, api_key)
            
            if data_changed:
                logger.info("Data updated. Generating new daily prediction.")
            else:
                logger.info("No new weather data available. Making prediction with existing data.")
            
            # Always proceed with prediction (whether data changed or not)
            
            # Check if we need to retrain
            if should_retrain_model():
                # Generate features
                features_df = generate_features(updated_data)
                # Add bloom data
                blossom_data = add_cherry_blossom_data(features_df)
                
                # Train model
                historical_data = blossom_data[blossom_data['year'] <= CONFIG['max_historical_year']]
                model, feature_cols = train_prediction_model(historical_data)
            else:
                # Load existing model
                model, feature_cols = load_model()
                if model is None:
                    logger.error("Could not load model. Run with --setup first.")
                    return
            
            # Make updated prediction for today
            today = datetime.now()
            pred = make_and_display_prediction(model, feature_cols, updated_data, today, year=2026)
            
            if pred:
                # Save single prediction
                save_daily_predictions([pred])
                logger.info(f"Prediction saved for {today.strftime('%Y-%m-%d')}")
            
            logger.info("Daily prediction completed successfully with XGBoost")
        
    except Exception as e:
        logger.error(f"Error in workflow: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()