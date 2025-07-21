import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import Papa from 'papaparse';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CardiovascularChart = ({ dataFile = '/data/health_data.csv' }) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const countryColors = {
    'Marshall Islands': '#9f1239',
    'Kiribati': '#be123c',
    'Micronesia (Federated States of)': '#e11d48',
    'Papua New Guinea': '#f43f5e',
    'Tuvalu': '#fb7185',
    'Palau': '#fda4af',
    'Nauru': '#fecdd3',
    'Fiji': '#fee2e2',
    'Tonga': '#fef7f7',
    'Samoa': '#fffbfb'
  };

  const sampleData = {
    'Marshall Islands': [
      { year: 2000, value: 34.2 },
      { year: 2005, value: 32.8 },
      { year: 2010, value: 31.5 },
      { year: 2015, value: 30.1 },
      { year: 2019, value: 28.7 }
    ],
    'Kiribati': [
      { year: 2000, value: 28.9 },
      { year: 2005, value: 27.3 },
      { year: 2010, value: 26.1 },
      { year: 2015, value: 24.8 },
      { year: 2019, value: 23.5 }
    ],
    'Micronesia (Federated States of)': [
      { year: 2000, value: 31.7 },
      { year: 2005, value: 30.2 },
      { year: 2010, value: 28.9 },
      { year: 2015, value: 27.4 },
      { year: 2019, value: 26.1 }
    ],
    'Papua New Guinea': [
      { year: 2000, value: 22.4 },
      { year: 2005, value: 21.8 },
      { year: 2010, value: 21.2 },
      { year: 2015, value: 20.6 },
      { year: 2019, value: 20.1 }
    ],
    'Fiji': [
      { year: 2000, value: 24.7 },
      { year: 2005, value: 23.9 },
      { year: 2010, value: 23.2 },
      { year: 2015, value: 22.5 },
      { year: 2019, value: 21.8 }
    ]
  };

  useEffect(() => {
    const loadHealthData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let csvText = '';
        let dataLoaded = false;

        // Try to read local CSV file
        try {
          csvText = await window.fs.readFile(dataFile, { encoding: 'utf8' });
          dataLoaded = true;
          console.log('Successfully loaded health data CSV');
        } catch (err) {
          console.log(`Could not load ${dataFile}:`, err.message);
        }

        if (dataLoaded && csvText) {
          const parsedData = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          }).data;

          // Filter for cardiovascular disease mortality data
          const cvdData = parsedData.filter(row => 
            row['Indicator'] === 'Mortality rate attributed to cardiovascular disease, cancer,\n            diabetes or chronic respiratory disease' &&
            row['OBS_VALUE'] !== null &&
            row['OBS_VALUE'] !== undefined &&
            !isNaN(row['OBS_VALUE']) &&
            row['TIME_PERIOD'] >= 2000
          );

          // Group by country and create time series
          const countryData = {};
          cvdData.forEach(row => {
            const country = row['Pacific Island Countries and territories'];
            const year = row['TIME_PERIOD'];
            const value = parseFloat(row['OBS_VALUE']);
            
            if (!countryData[country]) {
              countryData[country] = [];
            }
            countryData[country].push({ year, value });
          });

          // Sort by year for each country
          Object.keys(countryData).forEach(country => {
            countryData[country].sort((a, b) => a.year - b.year);
          });

          setData(countryData);
        } else {
          // Use sample data
          console.log('Using sample cardiovascular disease data');
          setData(sampleData);
        }
      } catch (error) {
        setError(error);
        console.error('Error loading cardiovascular disease data:', error);
        setData(sampleData);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, [dataFile]);

  const getChartData = () => {
    if (Object.keys(data).length === 0) {
      return { labels: [], datasets: [] };
    }

    // Get all years from all countries
    const allYears = new Set();
    Object.values(data).forEach(countryData => {
      countryData.forEach(point => allYears.add(point.year));
    });
    const years = Array.from(allYears).sort();

    const datasets = Object.entries(data)
      .filter(([country, points]) => points.length > 1)
      .map(([country, points]) => ({
        label: country,
        data: years.map(year => {
          const point = points.find(p => p.year === year);
          return point ? point.value : null;
        }),
        borderColor: countryColors[country] || '#9f1239',
        backgroundColor: countryColors[country] || '#9f1239',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }));

    return {
      labels: years,
      datasets: datasets
    };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Cardiovascular Disease Mortality Over Time',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: 20
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15
        }
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            return `Year ${context[0].label}`;
          },
          label: function(context) {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(1)}% mortality rate`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Year',
          font: {
            size: 14,
            weight: '600'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Mortality Rate (%)',
          font: {
            size: 14,
            weight: '600'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeOutQuart'
    }
  };

  if (loading) {
    return (
      <div className="chart-container">
        <style jsx>{`
          .chart-container {
            width: 100%;
            height: 80vh;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .loading {
            text-align: center;
            color: #718096;
          }
          
          .spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-top: 3px solid #9f1239;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading cardiovascular disease data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <style jsx>{`
        .chart-container {
          width: 100%;
          height: 80vh;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 20px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>
      <Line data={getChartData()} options={options} />
    </div>
  );
};

export default CardiovascularChart;