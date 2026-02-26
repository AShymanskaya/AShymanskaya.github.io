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
- To confirm bloom:   python cherry_blossom_workflow.py --confirm-bloom YYYY-MM-DD
- To predict now:     python cherry_blossom_workflow.py --predict [--date YYYY-MM-DD]
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
    load_dotenv()
except ImportError:
    pass

# ── Base directory ────────────────────────────────────────────────────────────
# Script lives in  <repo>/scripts/cherry_blossom_workflow.py
# Repository root is one level up.
BASE_DIR = Path(__file__).resolve().parent.parent

# ── Logging ───────────────────────────────────────────────────────────────────
# Use an absolute path so the log always lands in the repo root, regardless of
# the working directory from which the script is invoked (e.g. GitHub Actions).
LOG_FILE = str(BASE_DIR / "cherry_blossom_workflow.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("cherry_blossom")

# ── Month name lookup ─────────────────────────────────────────────────────────
MONTH_NAMES = {
    1: "january",  2: "february", 3: "march",    4: "april",
    5: "may",      6: "june",     7: "july",      8: "august",
    9: "september",10: "october", 11: "november", 12: "december",
}

# ── Configuration ─────────────────────────────────────────────────────────────
CONFIG = {
    "data_dir":              str(BASE_DIR / "data" / "daily"),
    "output_dir":            str(BASE_DIR / "data" / "output"),
    "model_dir":             str(BASE_DIR / "data" / "model"),
    "docs_dir":              str(BASE_DIR),
    "station_id":            "10517",          # Bonn Friesdorf
    # NOTE: this file is named for its origin (2024-2025 seed data) but the
    # daily update job appends 2026 records to it too.  Rename when convenient.
    "historical_file":       "weather_2015_2023.csv",
    "recent_file":           "weather_2024_2025.csv",
    "daily_predictions_file":"daily_predictions_2026.csv",
    "confirmations_file":    "bloom_confirmations.json",
    "min_year":              2015,
    "max_historical_year":   2025,
    "prediction_year":       2026,
}

# ── Ground-truth bloom dates (start only; end is used only for the web label) ─
# Keep these in sync with add_cherry_blossom_data().
BLOOM_DATES = {
    2015: {"start": "2015-04-16", "end": "2015-04-27"},
    2016: {"start": "2016-04-14", "end": "2016-04-26"},
    2017: {"start": "2017-03-31", "end": "2017-04-15"},
    2018: {"start": "2018-04-15", "end": "2018-04-28"},
    2019: {"start": "2019-04-07", "end": "2019-04-22"},
    2020: {"start": "2020-04-04", "end": "2020-04-14"},
    2021: {"start": "2021-04-13", "end": "2021-04-29"},
    2022: {"start": "2022-04-07", "end": "2022-04-22"},
    2023: {"start": "2023-04-11", "end": "2023-04-26"},
    2024: {"start": "2024-03-30", "end": "2024-04-10"},
    2025: {"start": "2025-04-05", "end": "2025-04-15"},   # verified observation
}


# ══════════════════════════════════════════════════════════════════════════════
#  UTILITY
# ══════════════════════════════════════════════════════════════════════════════

def get_api_key() -> str:
    """Return the Meteostat RapidAPI key from env or .env file."""
    api_key = os.environ.get("RAPID_API_KEY")

    if not api_key:
        env_file = BASE_DIR / ".env"
        if env_file.exists():
            try:
                for line in env_file.read_text().splitlines():
                    line = line.strip()
                    if line.startswith("RAPID_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip("\"'")
                        break
            except Exception as exc:
                logger.warning(f"Error reading .env file: {exc}")

    if api_key:
        logger.info(
            f"API key loaded (length: {len(api_key)}, starts with: {api_key[:4]}...)"
        )
    else:
        logger.error("RAPID_API_KEY not found!")
        logger.error("Local dev: create a .env file with RAPID_API_KEY=your_key")
        logger.error("GitHub Actions: add RAPID_API_KEY as a repository secret")
        sys.exit(1)

    return api_key


def setup_directories() -> None:
    """Create all required directories."""
    for directory in [
        CONFIG["data_dir"],
        CONFIG["output_dir"],
        CONFIG["model_dir"],
        CONFIG["docs_dir"],
    ]:
        os.makedirs(directory, exist_ok=True)
        logger.info(f"Directory ready: {directory}")
    logger.info("All directories created/verified")


def _load_confirmations() -> dict:
    """
    Return bloom_data with any saved confirmations applied on top.
    Confirmation years override the hardcoded BLOOM_DATES.
    """
    bloom_data = {y: dict(v) for y, v in BLOOM_DATES.items()}

    confirmations_file = os.path.join(
        CONFIG["output_dir"], CONFIG["confirmations_file"]
    )
    if not os.path.exists(confirmations_file):
        return bloom_data

    try:
        with open(confirmations_file) as f:
            confirmations = json.load(f)
        for conf in confirmations:
            year  = conf.get("year")
            start = conf.get("actual_bloom_start")
            end   = conf.get("actual_bloom_end")
            if not (year and start):
                continue
            if not end and "estimated_duration" in conf:
                end = (
                    pd.to_datetime(start)
                    + pd.Timedelta(days=int(conf["estimated_duration"]) - 1)
                ).strftime("%Y-%m-%d")
            entry = {"start": start}
            if end:
                entry["end"] = end
            bloom_data[year] = entry
            logger.info(f"Confirmation applied for {year}: {start}")
    except Exception as exc:
        logger.warning(f"Could not load bloom confirmations: {exc}")

    return bloom_data


# ══════════════════════════════════════════════════════════════════════════════
#  DATA INGESTION
# ══════════════════════════════════════════════════════════════════════════════

def harmonize_historical_data() -> pd.DataFrame:
    """
    Read and merge the static historical CSV with the rolling recent CSV.
    Returns a clean, sorted DataFrame with no duplicate dates.
    """
    logger.info("Harmonizing historical weather data...")

    historical_file = os.path.join(CONFIG["data_dir"], CONFIG["historical_file"])
    recent_file     = os.path.join(CONFIG["data_dir"], CONFIG["recent_file"])

    if not os.path.exists(historical_file):
        raise FileNotFoundError(
            f"Historical data file not found: {historical_file}\n"
            "Ensure weather_2015_2023.csv is in data/daily/"
        )

    if not os.path.exists(recent_file):
        logger.warning(f"Recent file not found: {recent_file} – creating empty placeholder.")
        pd.DataFrame(
            columns=["date","tavg","tmin","tmax","prcp","snow",
                     "wdir","wspd","wpgt","pres","year","month","day"]
        ).to_csv(recent_file, index=False)

    historical = pd.read_csv(historical_file)
    recent     = pd.read_csv(recent_file)
    logger.info(f"Historical rows: {len(historical)}, recent rows: {len(recent)}")

    combined = pd.concat([historical, recent], ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"])

    for col, fn in [("year", "dt.year"), ("month", "dt.month"), ("day", "dt.day")]:
        if col not in combined.columns:
            combined[col] = getattr(combined["date"], fn)

    combined = combined.sort_values("date")

    dupes = combined.duplicated(subset=["date"], keep="first")
    if dupes.any():
        logger.warning(f"Dropping {dupes.sum()} duplicate date(s) (keeping first)")
        combined = combined[~dupes]

    combined.to_csv(
        os.path.join(CONFIG["output_dir"], "harmonized_historical_data.csv"),
        index=False,
    )
    logger.info(f"Harmonized data: {len(combined)} rows")
    return combined.reset_index(drop=True)


def fetch_meteostat_data(
    api_key: str, start_date: str = None, end_date: str = None
) -> pd.DataFrame | None:
    """Fetch daily weather records from the Meteostat RapidAPI."""
    if not end_date:
        end_date   = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(f"Fetching Meteostat data: {start_date} → {end_date}")

    url     = "https://meteostat.p.rapidapi.com/stations/daily"
    headers = {
        "X-RapidAPI-Host": "meteostat.p.rapidapi.com",
        "X-RapidAPI-Key":  api_key,
    }
    params  = {"station": CONFIG["station_id"], "start": start_date, "end": end_date}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        if "data" not in data or not data["data"]:
            logger.warning("API returned no data for the requested range.")
            return None

        df = pd.DataFrame(data["data"])
        df["date"]  = pd.to_datetime(df["date"])
        df["year"]  = df["date"].dt.year
        df["month"] = df["date"].dt.month
        df["day"]   = df["date"].dt.day

        logger.info(f"Fetched {len(df)} record(s) from Meteostat.")
        return df

    except requests.exceptions.HTTPError as exc:
        if exc.response.status_code == 403:
            logger.error("API authentication failed – check RAPID_API_KEY.")
        else:
            logger.error(f"HTTP error: {exc}")
        return None
    except Exception as exc:
        logger.error(f"Unexpected error fetching weather data: {exc}")
        return None


def update_weather_data(
    current_data: pd.DataFrame, api_key: str
) -> tuple[pd.DataFrame, bool]:
    """
    Fetch any missing days since the last record and append them to the
    recent CSV.  Returns (updated_df, was_data_added).
    """
    most_recent = current_data["date"].max()
    start_date  = (most_recent + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    end_date    = datetime.now().strftime("%Y-%m-%d")

    if start_date > end_date:
        logger.info("Weather data is already up to date.")
        return current_data, False

    new_data = fetch_meteostat_data(api_key, start_date=start_date, end_date=end_date)
    if new_data is None or len(new_data) == 0:
        logger.info("No new records returned by the API.")
        return current_data, False

    updated = (
        pd.concat([current_data, new_data], ignore_index=True)
        .sort_values("date")
        .drop_duplicates(subset=["date"], keep="last")
        .reset_index(drop=True)
    )
    logger.info(f"Added {len(new_data)} new record(s).")

    # Persist the recent slice (2024 onward) back to disk
    recent_file = os.path.join(CONFIG["data_dir"], CONFIG["recent_file"])
    updated[updated["year"] >= 2024].to_csv(recent_file, index=False)
    logger.info(f"Recent data saved to {recent_file}")

    return updated, True


# ══════════════════════════════════════════════════════════════════════════════
#  FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════

def _add_derived_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add gdd_10 and chill_day columns in-place (if tmin/tmax are present).
    These are shared building blocks for both generate_daily_features() and
    generate_features().
    """
    df = df.copy()
    if {"tmax", "tmin"}.issubset(df.columns):
        df["temp_range"] = df["tmax"] - df["tmin"]
        df["gdd_10"] = df.apply(
            lambda r: max(0.0, (r["tmax"] + r["tmin"]) / 2 - 10), axis=1
        )
        df["chill_day"] = df.apply(
            lambda r: 1.0 if r["tmax"] < 7.2 else (0.0 if r["tmin"] > 7.2 else 0.5),
            axis=1,
        )
        df["cum_gdd_10"]    = df.groupby("year")["gdd_10"].cumsum()
        df["cum_chill_days"]= df.groupby("year")["chill_day"].cumsum()
    df["day_of_year"] = df["date"].dt.dayofyear
    return df


def generate_daily_features(
    df: pd.DataFrame, target_date
) -> dict | None:
    """
    Generate the full feature dictionary for a given cutoff date, using only
    data available up to (and including) that date.

    This is the single source of truth for features — used at both training
    time (one call per historical year) and inference time (one call per day).
    Keeping a single implementation guarantees train/inference parity.

    Parameters
    ----------
    df          : Full harmonized weather DataFrame (all years).
    target_date : Date up to which data is allowed (pd.Timestamp or str).

    Returns
    -------
    dict of feature_name → float, or None if no data is available.
    """
    target_date = pd.to_datetime(target_date)
    target_year = target_date.year

    logger.info(f"Generating features for cutoff {target_date.date()} (year={target_year})")

    # ── 1. Restrict to data available up to cutoff ────────────────────────────
    snap = df[df["date"] <= target_date].copy()
    if snap.empty:
        logger.warning(f"No data available up to {target_date.date()}")
        return None

    snap = _add_derived_columns(snap)

    features: dict = {"year": target_year}

    # ── 2. Monthly statistics (current year only, partial months included) ────
    for month in range(1, 13):
        m_data = snap[
            (snap["year"] == target_year) & (snap["month"] == month)
        ]
        if m_data.empty:
            continue
        name = MONTH_NAMES[month]
        for col in ["tavg", "tmin", "tmax"]:
            if col in m_data.columns:
                features[f"{name}_{col}"] = m_data[col].mean()
        if "prcp"      in m_data.columns:
            features[f"{name}_prcp_sum"]   = m_data["prcp"].sum()
        if "snow"      in m_data.columns:
            features[f"{name}_snow_sum"]   = m_data["snow"].fillna(0).sum()
        if "chill_day" in m_data.columns:
            features[f"{name}_chill_days"] = m_data["chill_day"].sum()
        if "gdd_10"    in m_data.columns:
            features[f"{name}_gdd_sum"]    = m_data["gdd_10"].sum()

    # ── 3. Rolling-window temperature averages ────────────────────────────────
    # Rolling windows use only actual available rows within each window, so
    # they never cross the year boundary implicitly.
    for window in [30, 60, 90]:
        window_start = target_date - pd.Timedelta(days=window)
        w_data = snap[
            (snap["date"] > window_start) & (snap["date"] <= target_date)
        ]
        if w_data.empty:
            continue
        for col in ["tavg", "tmin", "tmax"]:
            features[f"{col}_roll_{window}d"] = w_data[col].mean()

    # ── 4. Winter aggregate (Dec of prev year + Jan + Feb of current year) ────
    dec  = snap[(snap["year"] == target_year - 1) & (snap["month"] == 12)]
    jan  = snap[(snap["year"] == target_year)     & (snap["month"] == 1)]
    feb  = snap[(snap["year"] == target_year)     & (snap["month"] == 2)]
    winter = pd.concat([dec, jan, feb])
    if not winter.empty:
        features["winter_tavg"]         = winter["tavg"].mean()
        features["winter_tmin"]         = winter["tmin"].mean()
        features["winter_tmax"]         = winter["tmax"].mean()
        features["winter_prcp_sum"]     = winter["prcp"].sum()
        features["winter_snow_sum"]     = winter["snow"].fillna(0).sum() if "snow" in winter.columns else 0.0
        features["winter_chill_days"]   = winter["chill_day"].sum() if "chill_day" in winter.columns else 0.0
        features["winter_full_tavg"]    = features["winter_tavg"]
        features["winter_full_chill_days"] = features["winter_chill_days"]

    # ── 5. Seasonal aggregates (partial if season not yet complete) ───────────
    spring = snap[(snap["year"] == target_year) & snap["month"].isin([3, 4, 5])]
    if not spring.empty:
        features["spring_tavg"]    = spring["tavg"].mean()
        features["spring_gdd_sum"] = spring["gdd_10"].sum() if "gdd_10" in spring.columns else 0.0

    summer = snap[(snap["year"] == target_year) & snap["month"].isin([6, 7, 8])]
    if not summer.empty:
        features["summer_tavg"]    = summer["tavg"].mean()
        features["summer_gdd_sum"] = summer["gdd_10"].sum() if "gdd_10" in summer.columns else 0.0

    fall = snap[(snap["year"] == target_year) & snap["month"].isin([9, 10, 11])]
    if not fall.empty:
        features["fall_tavg"]       = fall["tavg"].mean()
        features["fall_chill_days"] = fall["chill_day"].sum() if "chill_day" in fall.columns else 0.0

    # ── 6. Year-to-date totals (current year up to cutoff) ───────────────────
    ytd = snap[snap["year"] == target_year]
    if not ytd.empty:
        features["year_avg_temp"]         = ytd["tavg"].mean()
        features["year_total_prcp"]       = ytd["prcp"].sum()
        features["year_total_chill_days"] = ytd["chill_day"].sum() if "chill_day" in ytd.columns else 0.0
        features["year_total_gdd"]        = ytd["gdd_10"].sum()  if "gdd_10"    in ytd.columns else 0.0

    # ── 7. Previous full calendar year ────────────────────────────────────────
    prev_year = snap[snap["year"] == target_year - 1]
    if not prev_year.empty:
        features["prev_year_avg_temp"]        = prev_year["tavg"].mean()
        features["prev_year_total_prcp"]      = prev_year["prcp"].sum()
        features["prev_year_total_chill_days"]= (
            prev_year["chill_day"].sum() if "chill_day" in prev_year.columns else 0.0
        )
        prev_fall = prev_year[prev_year["month"].isin([9, 10, 11])]
        if not prev_fall.empty:
            features["prev_fall_tavg"]       = prev_fall["tavg"].mean()
            features["prev_fall_chill_days"] = (
                prev_fall["chill_day"].sum() if "chill_day" in prev_fall.columns else 0.0
            )

    # ── 8. Phenological calendar features ────────────────────────────────────
    doy = target_date.dayofyear
    lat_rad = np.radians(50.7)  # Bonn
    features["photoperiod"] = 12 + (24 / np.pi) * np.arcsin(
        0.39795
        * np.cos(0.2163108 + 2 * np.arctan(0.9671396 * np.tan(0.00860 * (doy - 186))))
    ) * np.sin(lat_rad)

    if target_date.month < 6:
        solstice = pd.Timestamp(year=target_year - 1, month=12, day=21)
    else:
        solstice = pd.Timestamp(year=target_year, month=12, day=21)
    features["days_since_winter_solstice"] = (target_date - solstice).days

    return features


def generate_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Broadcast full-year aggregate features onto every row in `df`.
    Used only to produce the processed_blossom_data.csv debug file in --setup.
    Training now calls generate_daily_features() directly.
    """
    logger.info("Generating broadcast features (for processed data file)...")
    features_df = _add_derived_columns(df)

    # Monthly stats per year (all 12 months)
    for month in range(1, 13):
        name = MONTH_NAMES[month]
        m_all = features_df[features_df["month"] == month]
        for year in features_df["year"].unique():
            m_yr = m_all[m_all["year"] == year]
            if m_yr.empty:
                continue
            mask = features_df["year"] == year
            for col in ["tavg", "tmin", "tmax"]:
                if col in features_df.columns:
                    features_df.loc[mask, f"{name}_{col}"] = m_yr[col].mean()
            if "prcp"      in features_df.columns:
                features_df.loc[mask, f"{name}_prcp_sum"]   = m_yr["prcp"].sum()
            if "snow"      in features_df.columns:
                features_df.loc[mask, f"{name}_snow_sum"]   = m_yr["snow"].fillna(0).sum()
            if "chill_day" in features_df.columns:
                features_df.loc[mask, f"{name}_chill_days"] = m_yr["chill_day"].sum()
            if "gdd_10"    in features_df.columns:
                features_df.loc[mask, f"{name}_gdd_sum"]    = m_yr["gdd_10"].sum()

    # Seasonal and annual aggregates
    for year in features_df["year"].unique():
        mask = features_df["year"] == year

        dec  = features_df[(features_df["year"] == year - 1) & (features_df["month"] == 12)]
        jan  = features_df[(features_df["year"] == year)     & (features_df["month"] == 1)]
        feb  = features_df[(features_df["year"] == year)     & (features_df["month"] == 2)]
        winter = pd.concat([dec, jan, feb])
        if not winter.empty:
            features_df.loc[mask, "winter_full_tavg"]        = winter["tavg"].mean()
            features_df.loc[mask, "winter_full_chill_days"]  = winter["chill_day"].sum()

        for season, months, tav_col, extra_col, extra_src in [
            ("spring", [3,4,5],   "spring_tavg", "spring_gdd_sum", "gdd_10"),
            ("summer", [6,7,8],   "summer_tavg", "summer_gdd_sum", "gdd_10"),
            ("fall",   [9,10,11], "fall_tavg",   "fall_chill_days","chill_day"),
        ]:
            s = features_df[(features_df["year"] == year) & features_df["month"].isin(months)]
            if not s.empty:
                features_df.loc[mask, tav_col]   = s["tavg"].mean()
                if extra_src in s.columns:
                    features_df.loc[mask, extra_col] = s[extra_src].sum()

        yr = features_df[features_df["year"] == year]
        if not yr.empty:
            features_df.loc[mask, "year_avg_temp"]         = yr["tavg"].mean()
            features_df.loc[mask, "year_total_prcp"]       = yr["prcp"].sum()
            features_df.loc[mask, "year_total_chill_days"] = yr["chill_day"].sum()
            features_df.loc[mask, "year_total_gdd"]        = yr["gdd_10"].sum()

        prev = features_df[features_df["year"] == year - 1]
        if not prev.empty:
            features_df.loc[mask, "prev_year_avg_temp"]         = prev["tavg"].mean()
            features_df.loc[mask, "prev_year_total_prcp"]       = prev["prcp"].sum()
            features_df.loc[mask, "prev_year_total_chill_days"] = prev["chill_day"].sum()
            pf = prev[prev["month"].isin([9,10,11])]
            if not pf.empty:
                features_df.loc[mask, "prev_fall_tavg"]       = pf["tavg"].mean()
                features_df.loc[mask, "prev_fall_chill_days"] = pf["chill_day"].sum()

    # Rolling windows — grouped by year to avoid cross-year bleed
    for window in [30, 60, 90]:
        for col in ["tavg", "tmin", "tmax"]:
            features_df[f"{col}_roll_{window}d"] = (
                features_df.groupby("year")[col]
                .transform(lambda x: x.rolling(window=window, min_periods=1).mean())
            )

    # Photoperiod & days-since-solstice
    lat_rad = np.radians(50.7)
    features_df["photoperiod"] = features_df["day_of_year"].apply(
        lambda doy: 12 + (24 / np.pi) * np.arcsin(
            0.39795 * np.cos(0.2163108 + 2 * np.arctan(0.9671396 * np.tan(0.00860 * (doy - 186))))
        ) * np.sin(lat_rad)
    )
    features_df["days_since_winter_solstice"] = features_df.apply(
        lambda r: (
            r["date"] - pd.Timestamp(year=int(r["year"]) - 1, month=12, day=21)
        ).days if r["month"] < 6 else (
            r["date"] - pd.Timestamp(year=int(r["year"]), month=12, day=21)
        ).days,
        axis=1,
    )

    logger.info("Broadcast feature generation complete.")
    return features_df


def add_cherry_blossom_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Annotate every row with bloom_start, bloom_end, is_blooming, bloom_duration,
    and days_to_bloom columns.  Bloom dates come from _load_confirmations().
    """
    logger.info("Adding cherry blossom historical data...")
    out = df.copy()
    out["bloom_start"]   = pd.NaT
    out["bloom_end"]     = pd.NaT
    out["is_blooming"]   = False
    out["bloom_duration"]= np.nan
    out["days_to_bloom"] = np.nan

    bloom_data = _load_confirmations()

    for year, info in bloom_data.items():
        if year not in out["year"].unique():
            continue
        if "end" not in info:
            continue

        start = pd.to_datetime(info["start"])
        end   = pd.to_datetime(info["end"])

        out.loc[out["date"] == start, "bloom_start"] = start
        out.loc[out["date"] == end,   "bloom_end"]   = end
        out.loc[(out["date"] >= start) & (out["date"] <= end), "is_blooming"] = True
        out.loc[out["year"] == year, "bloom_duration"] = (end - start).days + 1

        doy = start.dayofyear
        yr_mask = out["year"] == year
        out.loc[yr_mask, "days_to_bloom"] = out.loc[yr_mask, "day_of_year"] - doy

    return out


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train_prediction_model(df: pd.DataFrame) -> tuple:
    """
    Train an XGBoost regressor to predict cherry blossom start DOY.

    Key design decisions
    --------------------
    * Calls generate_daily_features(df, cutoff) per training year — the exact
      same function used at inference time.  This eliminates the data-leakage
      bug where full-year stats (summer_tavg, fall_tavg, etc.) were included
      in training rows even though those values are unavailable in February.
    * Cutoff is end-of-March for each training year, adjusted earlier for
      years where bloom happened before March 31.
    * Saves cross-validation MAE (not in-sample MAE) to model_metadata.json so
      the web UI shows an honest accuracy estimate.
    * Loads feature_cols.json from disk on retrains so the feature set stays
      stable across runs.

    Parameters
    ----------
    df : Full harmonized weather DataFrame (all years, no bloom columns needed).

    Returns
    -------
    (model, feature_cols)
    """
    logger.info("Training XGBoost cherry blossom model on 2015-2025 data...")

    bloom_data = _load_confirmations()  # respects any saved confirmations
    yearly_features = []

    for year, info in sorted(bloom_data.items()):
        if year > CONFIG["max_historical_year"]:
            continue

        bloom_start = pd.to_datetime(info["start"])
        bloom_doy   = bloom_start.dayofyear

        # Training cutoff: end of March, but pulled back for early-bloom years
        # so the model never "sees" the bloom date itself as a feature.
        cutoff = pd.Timestamp(year=year, month=3, day=31)
        if bloom_start <= cutoff:
            cutoff = bloom_start - pd.Timedelta(days=1)
            logger.info(
                f"  {year}: early bloom (DOY {bloom_doy}), "
                f"cutoff adjusted to {cutoff.date()}"
            )

        # Need at least 60 days of current-year data to produce useful features
        available_for_year = df[(df["date"] <= cutoff) & (df["year"] == year)]
        if len(available_for_year) < 60:
            logger.warning(
                f"  Skipping {year}: only {len(available_for_year)} days "
                f"available up to {cutoff.date()} (need ≥60)"
            )
            continue

        features = generate_daily_features(df, cutoff)
        if features is None:
            logger.warning(f"  Skipping {year}: generate_daily_features returned None")
            continue

        features["year"]           = year
        features["bloom_start_doy"]= bloom_doy
        yearly_features.append(features)
        logger.info(
            f"  {year}: cutoff={cutoff.date()}, "
            f"bloom DOY={bloom_doy}, features={len(features)}"
        )

    if not yearly_features:
        raise ValueError("No valid training years found – cannot train model.")

    yearly_df = pd.DataFrame(yearly_features)
    logger.info(f"Training matrix: {len(yearly_df)} years")

    # ── Determine canonical feature list ─────────────────────────────────────
    feature_cols_path = os.path.join(CONFIG["model_dir"], "feature_cols.json")
    if os.path.exists(feature_cols_path):
        with open(feature_cols_path) as f:
            canonical_cols = json.load(f)
        logger.info(f"Loaded {len(canonical_cols)} canonical features from disk.")
    else:
        exclude = {"year", "bloom_start_doy", "photoperiod"}
        canonical_cols = [c for c in yearly_df.columns if c not in exclude]
        logger.info(f"First-run: derived {len(canonical_cols)} features.")

    feature_cols = [c for c in canonical_cols if c in yearly_df.columns]
    missing = set(canonical_cols) - set(feature_cols)
    if missing:
        logger.warning(
            f"{len(missing)} canonical feature(s) absent from training data: "
            f"{sorted(missing)}"
        )

    # ── Fill missing values ───────────────────────────────────────────────────
    na_counts = yearly_df[feature_cols].isna().sum()
    na_cols   = na_counts[na_counts > 0]
    if not na_cols.empty:
        logger.warning(f"Filling {len(na_cols)} column(s) with column mean:")
        for col, cnt in na_cols.items():
            logger.warning(f"    {col}: {cnt} missing value(s)")
        yearly_df[feature_cols] = yearly_df[feature_cols].fillna(
            yearly_df[feature_cols].mean()
        )

    X = yearly_df[feature_cols]
    y = yearly_df["bloom_start_doy"]

    # ── Train ─────────────────────────────────────────────────────────────────
    logger.info(f"Fitting XGBoost: {len(X)} samples × {len(feature_cols)} features")
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
        objective="reg:squarederror",
    )
    model.fit(X, y, eval_set=[(X, y)], verbose=False)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    y_pred      = model.predict(X)
    insample_mae= float(mean_absolute_error(y, y_pred))
    insample_rmse=float(np.sqrt(mean_squared_error(y, y_pred)))

    n_splits = min(5, len(X))
    kfold    = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    cv_scores= cross_val_score(model, X, y, cv=kfold, scoring="neg_mean_absolute_error")
    cv_mae   = float(-cv_scores.mean())
    cv_std   = float(cv_scores.std())

    logger.info("Model performance:")
    logger.info(f"  In-sample MAE : {insample_mae:.2f} days  ← internal only")
    logger.info(f"  CV MAE        : {cv_mae:.2f} ± {cv_std:.2f} days  ← reported to users")
    logger.info(f"  In-sample RMSE: {insample_rmse:.2f} days")

    # ── Per-year results ──────────────────────────────────────────────────────
    results = pd.DataFrame({
        "year":                yearly_df["year"].values,
        "actual_bloom_doy":    y.values,
        "predicted_bloom_doy": y_pred,
        "error_days":          y_pred - y.values,
    })
    for prefix, col in [("actual", "actual_bloom_doy"), ("predicted", "predicted_bloom_doy")]:
        results[f"{prefix}_bloom_date"] = results.apply(
            lambda r, c=col: (
                pd.Timestamp(year=int(r["year"]), month=1, day=1)
                + pd.Timedelta(days=int(r[c]) - 1)
            ),
            axis=1,
        )
    logger.info("Per-year results:")
    for _, row in results.iterrows():
        logger.info(
            f"  {int(row['year'])}: "
            f"actual {row['actual_bloom_date'].strftime('%Y-%m-%d')}, "
            f"predicted {row['predicted_bloom_date'].strftime('%Y-%m-%d')}, "
            f"error {row['error_days']:+.1f}d"
        )

    results.to_csv(
        os.path.join(CONFIG["output_dir"], "model_training_results.csv"), index=False
    )

    # ── Feature importance ────────────────────────────────────────────────────
    imp_df = (
        pd.DataFrame({"feature": feature_cols, "importance": model.feature_importances_})
        .sort_values("importance", ascending=False)
    )
    logger.info("Top-10 features:")
    for _, row in imp_df.head(10).iterrows():
        logger.info(f"  {row['feature']}: {row['importance']:.4f}")

    # ── Persist ───────────────────────────────────────────────────────────────
    save_model(model, feature_cols, mae=cv_mae)

    return model, feature_cols


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════

def save_model(model, feature_cols: list, mae: float = None) -> str:
    """Persist model, feature list, and metadata to the model directory."""
    os.makedirs(CONFIG["model_dir"], exist_ok=True)

    ts             = datetime.now().strftime("%Y%m%d")
    model_path     = os.path.join(CONFIG["model_dir"], f"cherry_blossom_xgboost_{ts}.pkl")
    latest_path    = os.path.join(CONFIG["model_dir"], "cherry_blossom_model_latest.pkl")
    feat_path      = os.path.join(CONFIG["model_dir"], "feature_cols.json")
    metadata_path  = os.path.join(CONFIG["model_dir"], "model_metadata.json")

    with open(model_path,  "wb") as f: pickle.dump(model, f)
    with open(latest_path, "wb") as f: pickle.dump(model, f)
    with open(feat_path,   "w")  as f: json.dump(feature_cols, f)

    top10 = sorted(
        zip(feature_cols, model.feature_importances_),
        key=lambda x: x[1], reverse=True,
    )[:10]
    metadata = {
        "model_type":    "XGBoost",
        "training_date": datetime.now().strftime("%Y-%m-%d"),
        "feature_count": len(feature_cols),
        "model_file":    os.path.basename(model_path),   # timestamped file
        "latest_file":   os.path.basename(latest_path),  # always-current alias
        "training_years":"2015-2025",
        "prediction_year": CONFIG["prediction_year"],
        "model_mae":     round(float(mae), 2) if mae is not None else None,
        "top_features":  [[c, float(i)] for c, i in top10],
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Model saved → {model_path}")
    logger.info(f"Latest alias → {latest_path}")
    return model_path


def load_model() -> tuple:
    """Load the latest model and its feature list from disk."""
    latest_path = os.path.join(CONFIG["model_dir"], "cherry_blossom_model_latest.pkl")
    feat_path   = os.path.join(CONFIG["model_dir"], "feature_cols.json")

    if not os.path.exists(latest_path) or not os.path.exists(feat_path):
        logger.error(f"Model files not found in {CONFIG['model_dir']}")
        return None, None

    try:
        with open(latest_path, "rb") as f: model        = pickle.load(f)
        with open(feat_path,   "r")  as f: feature_cols = json.load(f)
        logger.info(f"Model loaded ({len(feature_cols)} features)")
        return model, feature_cols
    except Exception as exc:
        logger.error(f"Error loading model: {exc}")
        return None, None


# ══════════════════════════════════════════════════════════════════════════════
#  PREDICTION
# ══════════════════════════════════════════════════════════════════════════════

def make_daily_prediction(
    model, feature_cols: list, data: pd.DataFrame,
    target_date, year: int = None,
) -> dict | None:
    """
    Run inference for a single date.

    Parameters
    ----------
    model        : Trained XGBoost model.
    feature_cols : Ordered list of feature names (from load_model / train).
    data         : Full harmonized weather DataFrame.
    target_date  : Date for which to predict (pd.Timestamp or str).
    year         : Prediction year (default: CONFIG['prediction_year']).
    """
    if year is None:
        year = CONFIG["prediction_year"]

    target_date = pd.to_datetime(target_date)
    daily_feats = generate_daily_features(data, target_date)
    if daily_feats is None:
        logger.warning(f"Could not generate features for {target_date.date()}")
        return None

    # Align to canonical feature vector; zero-fill anything not yet available
    pred_row = {col: daily_feats.get(col, 0.0) for col in feature_cols}
    pred_df  = pd.DataFrame([pred_row])[feature_cols]

    predicted_doy  = float(model.predict(pred_df)[0])
    predicted_date = (
        pd.Timestamp(year=year, month=1, day=1)
        + pd.Timedelta(days=int(predicted_doy) - 1)
    )
    days_until   = (predicted_date - target_date).days
    end_date     = predicted_date + pd.Timedelta(days=13)   # 14-day average duration

    n_matched = sum(1 for k in daily_feats if k in feature_cols)

    return {
        "prediction_date":       target_date.strftime("%Y-%m-%d"),
        "year":                  year,
        "predicted_bloom_doy":   predicted_doy,
        "predicted_bloom_start": predicted_date.strftime("%Y-%m-%d"),
        "estimated_bloom_end":   end_date.strftime("%Y-%m-%d"),
        "days_until_bloom":      days_until,
        "confidence":            _confidence_level(target_date, days_until),
        "features_available":    n_matched,
    }


def _confidence_level(current_date: pd.Timestamp, days_until_bloom: int) -> str:
    """Map (current date, days until bloom) → confidence label."""
    month = current_date.month
    if   days_until_bloom  < 7:                          return "very_high"
    elif days_until_bloom  < 14:                         return "high"
    elif month >= 3 and days_until_bloom < 30:           return "medium-high"
    elif month >= 2:                                     return "medium"
    else:                                                return "low"


def should_retrain_model(force: bool = False) -> bool:
    """
    Return True when a model retrain is warranted.

    Rules (in priority order):
    1. force=True           → always retrain.
    2. No model on disk     → must retrain.
    3. New bloom confirmation saved after last training date → retrain.
    4. First run of the new prediction year (i.e. model was trained in a
       prior year before September) → retrain once to incorporate the
       latest confirmed data.  Does NOT trigger on every subsequent daily run.
    """
    if force:
        logger.info("Forced retrain requested.")
        return True

    latest_path   = os.path.join(CONFIG["model_dir"], "cherry_blossom_model_latest.pkl")
    metadata_path = os.path.join(CONFIG["model_dir"], "model_metadata.json")

    if not os.path.exists(latest_path) or not os.path.exists(metadata_path):
        logger.info("No existing model found – training required.")
        return True

    with open(metadata_path) as f:
        metadata = json.load(f)

    last_training_str = metadata.get("training_date")
    if not last_training_str:
        logger.warning("model_metadata.json missing 'training_date' – retraining.")
        return True

    last_training  = datetime.strptime(last_training_str, "%Y-%m-%d")
    days_since     = (datetime.now() - last_training).days
    current_year   = datetime.now().year

    # Rule 3: new bloom confirmation
    conf_path = os.path.join(CONFIG["output_dir"], CONFIG["confirmations_file"])
    if os.path.exists(conf_path):
        try:
            with open(conf_path) as f:
                confirmations = json.load(f)
            for conf in confirmations:
                conf_date_str = conf.get("confirmation_date")
                if conf_date_str:
                    conf_date = datetime.strptime(conf_date_str, "%Y-%m-%d")
                    if conf_date > last_training:
                        logger.info(
                            f"New bloom confirmation ({conf_date.date()}) "
                            f"since last training ({last_training.date()}) – retraining."
                        )
                        return True
        except Exception as exc:
            logger.warning(f"Could not read confirmations file: {exc}")

    # Rule 4: first run of a new prediction year, model was trained mid-year
    if current_year > last_training.year and last_training.month < 9:
        logger.info(
            f"Model trained {last_training.date()} is from last year – "
            "retraining once for the new season."
        )
        return True

    logger.info(f"Using existing model (trained {days_since} day(s) ago).")
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  OUTPUT / WEB FILES
# ══════════════════════════════════════════════════════════════════════════════

def save_daily_predictions(predictions: list) -> bool:
    """Append predictions to the CSV log and refresh the JSON web files."""
    if not predictions:
        return False
    try:
        pred_df  = pd.DataFrame(predictions)
        csv_file = os.path.join(CONFIG["output_dir"], CONFIG["daily_predictions_file"])

        if os.path.exists(csv_file):
            existing = pd.read_csv(csv_file)
            combined = (
                pd.concat([existing, pred_df], ignore_index=True)
                .drop_duplicates(subset=["prediction_date"], keep="last")
            )
        else:
            combined = pred_df

        combined.to_csv(csv_file, index=False)
        logger.info(f"Saved {len(predictions)} prediction(s) to {csv_file}")

        save_prediction_json(predictions[-1])
        return True

    except Exception as exc:
        logger.error(f"Error saving daily predictions: {exc}")
        return False


def save_prediction_json(prediction: dict) -> bool:
    """Write the latest prediction as JSON for the web interface."""
    if not prediction:
        return False
    try:
        metadata_path = os.path.join(CONFIG["model_dir"], "model_metadata.json")
        model_mae = None
        if os.path.exists(metadata_path):
            with open(metadata_path) as f:
                model_mae = json.load(f).get("model_mae")
        if model_mae is None:
            logger.warning(
                "model_mae not found in metadata – web UI will show None. "
                "Run --setup or --retrain to fix."
            )
        model_mae = round(float(model_mae), 2) if model_mae is not None else None

        confidence_pct = {
            "very_high": 95, "high": 85,
            "medium-high": 70, "medium": 50, "low": 30,
        }

        enhanced = dict(prediction)
        enhanced["confidence_percent"] = confidence_pct.get(
            prediction.get("confidence", "low"), 50
        )

        start = pd.to_datetime(prediction.get("predicted_bloom_start"))
        end   = pd.to_datetime(prediction.get("estimated_bloom_end"))
        if start and end:
            enhanced["predicted_peak"] = (start + (end - start) / 2).strftime("%Y-%m-%d")

        enhanced["model_mae"]        = model_mae
        enhanced["data_points"]      = "11 years"
        enhanced["estimated_duration"] = 14
        enhanced["last_updated"]     = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for path in [
            os.path.join(CONFIG["output_dir"], "cherry_blossom_prediction.json"),
            str(BASE_DIR / "cherry_blossom_prediction.json"),
        ]:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump(enhanced, f, indent=2)
            logger.info(f"Prediction JSON → {path}")

        save_all_predictions_json()
        return True

    except Exception as exc:
        logger.error(f"Error saving prediction JSON: {exc}")
        return False


def save_all_predictions_json() -> bool:
    """Write the full prediction history as a JSON array."""
    try:
        csv_file = os.path.join(CONFIG["output_dir"], CONFIG["daily_predictions_file"])
        if not os.path.exists(csv_file):
            return True

        df   = pd.read_csv(csv_file).sort_values("prediction_date")
        data = df.to_dict("records")

        for path in [
            os.path.join(CONFIG["output_dir"], "all_predictions_2026.json"),
            str(BASE_DIR / "all_predictions_2026.json"),
        ]:
            with open(path, "w") as f:
                json.dump(data, f, indent=2)

        logger.info(f"Saved {len(data)} total predictions to JSON files.")
        return True

    except Exception as exc:
        logger.error(f"Error saving all-predictions JSON: {exc}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  BLOOM CONFIRMATIONS
# ══════════════════════════════════════════════════════════════════════════════

def record_bloom_confirmation(
    year: int, bloom_date: str, source: str = "user", notes: str = ""
) -> bool:
    """Persist a confirmed bloom observation.  Triggers retrain on next --update."""
    conf_file = os.path.join(CONFIG["output_dir"], CONFIG["confirmations_file"])
    os.makedirs(CONFIG["output_dir"], exist_ok=True)

    try:
        confirmations = []
        if os.path.exists(conf_file):
            with open(conf_file) as f:
                confirmations = json.load(f)

        for conf in confirmations:
            if conf["year"] == year:
                conf.update({
                    "actual_bloom_start":    bloom_date,
                    "confirmation_date":     datetime.now().strftime("%Y-%m-%d"),
                    "confirmation_source":   source,
                    "notes":                 notes,
                })
                break
        else:
            confirmations.append({
                "year":                year,
                "actual_bloom_start":  bloom_date,
                "confirmation_date":   datetime.now().strftime("%Y-%m-%d"),
                "confirmation_source": source,
                "notes":               notes,
            })

        with open(conf_file, "w") as f:
            json.dump(confirmations, f, indent=2)
        logger.info(f"Bloom confirmation recorded: {year} → {bloom_date}")
        return True

    except Exception as exc:
        logger.error(f"Error recording bloom confirmation: {exc}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  DISPLAY
# ══════════════════════════════════════════════════════════════════════════════

def make_and_display_prediction(
    model, feature_cols: list, data: pd.DataFrame,
    prediction_date=None, year: int = 2026,
) -> dict | None:
    """Make a prediction and print a human-readable summary."""
    if prediction_date is None:
        prediction_date = pd.Timestamp.now()
    prediction_date = pd.to_datetime(prediction_date)

    pred = make_daily_prediction(model, feature_cols, data, prediction_date, year)
    if not pred:
        return None

    bar = "=" * 70
    print(f"\n{bar}")
    print(f"🌸  CHERRY BLOSSOM PREDICTION  –  {prediction_date.strftime('%B %d, %Y')}  🌸")
    print(bar)
    bloom_start = pd.to_datetime(pred["predicted_bloom_start"])
    bloom_end   = pd.to_datetime(pred["estimated_bloom_end"])
    print(f"\n  📅 Bloom start : {bloom_start.strftime('%B %d, %Y')}")
    print(f"  📅 Bloom end   : {bloom_end.strftime('%B %d, %Y')}")
    print(f"\n  ⏰ Days until bloom : {pred['days_until_bloom']}")
    print(f"  📊 Confidence       : {pred['confidence'].replace('_', ' ').upper()}")
    print(f"  📈 Predicted DOY    : {pred['predicted_bloom_doy']:.0f}")
    print(f"  🤖 Model            : XGBoost")

    days = pred["days_until_bloom"]
    if   days < 0:   note = f"Bloom likely started {abs(days)} day(s) ago!"
    elif days == 0:  note = "Bloom predicted to start TODAY!"
    elif days <= 7:  note = "Bloom is imminent – within a week!"
    elif days <= 14: note = "Bloom approaching – about two weeks away."
    elif days <= 30: note = "Bloom expected within a month."
    else:            note = f"Bloom is {days} day(s) away."
    print(f"\n  💡 {note}")
    print(f"{bar}\n")

    logger.info(f"Prediction displayed for {prediction_date.date()}")
    return pred


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Cherry Blossom Prediction Workflow (XGBoost)"
    )
    parser.add_argument("--setup",         action="store_true", help="Initial setup + train model")
    parser.add_argument("--update",        action="store_true", help="Fetch latest weather + predict (default)")
    parser.add_argument("--retrain",       action="store_true", help="Force model retraining")
    parser.add_argument("--predict",       action="store_true", help="Predict without fetching new data")
    parser.add_argument("--confirm-bloom", metavar="DATE",      help="Record confirmed bloom date (YYYY-MM-DD)")
    parser.add_argument("--date",          metavar="DATE",      help="Prediction date override (YYYY-MM-DD)")
    args = parser.parse_args()

    try:
        setup_directories()

        # ── Bloom confirmation ─────────────────────────────────────────────────
        if args.confirm_bloom:
            try:
                datetime.strptime(args.confirm_bloom, "%Y-%m-%d")
            except ValueError:
                logger.error(f"Invalid date: {args.confirm_bloom} – use YYYY-MM-DD")
                return
            year = int(args.confirm_bloom[:4])
            record_bloom_confirmation(year, args.confirm_bloom)
            args.retrain = True   # retrain on this same run

        # ── Setup / force retrain ──────────────────────────────────────────────
        if args.setup or args.retrain:
            harmonized_data = harmonize_historical_data()

            # Optionally save an annotated debug CSV (not used by training)
            features_df  = generate_features(harmonized_data)
            blossom_data = add_cherry_blossom_data(features_df)
            blossom_data.to_csv(
                os.path.join(CONFIG["output_dir"], "processed_blossom_data.csv"),
                index=False,
            )

            # train_prediction_model only needs the raw harmonized df
            model, feature_cols = train_prediction_model(harmonized_data)
            logger.info("Setup / retrain complete.")

        # ── Predict without fetching new data ──────────────────────────────────
        if args.predict:
            model, feature_cols = load_model()
            if model is None:
                logger.error("No model found – run --setup first.")
                return

            harmonized_data = harmonize_historical_data()
            pred_date = pd.to_datetime(args.date) if args.date else pd.Timestamp.now()

            pred = make_and_display_prediction(
                model, feature_cols, harmonized_data, pred_date, year=2026
            )
            if pred:
                save_daily_predictions([pred])
            return

        # ── Daily update (default behaviour) ──────────────────────────────────
        if args.update or not (args.setup or args.retrain or args.predict):
            api_key = get_api_key()
            harmonized_data = harmonize_historical_data()
            updated_data, data_changed = update_weather_data(harmonized_data, api_key)

            if data_changed:
                logger.info("New weather data added.")
            else:
                logger.info("Weather data already current.")

            # Retrain if warranted (checks confirmations + year boundary)
            if should_retrain_model():
                model, feature_cols = train_prediction_model(updated_data)
            else:
                model, feature_cols = load_model()
                if model is None:
                    logger.error("No model found – run --setup first.")
                    return

            pred_date = pd.to_datetime(args.date) if args.date else pd.Timestamp.now()
            pred = make_and_display_prediction(
                model, feature_cols, updated_data, pred_date, year=2026
            )
            if pred:
                save_daily_predictions([pred])
                logger.info(f"Prediction saved for {pred_date.date()}")

            logger.info("Daily update complete.")

    except Exception as exc:
        logger.error(f"Workflow error: {exc}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()