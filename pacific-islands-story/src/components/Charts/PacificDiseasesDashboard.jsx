import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const PacificDiseasesDashboard = ({ 
  dataFile = '/data/health_data.csv'
}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });

  // Disease indicators mapping
  const diseaseIndicators = {
    'HIV': 'Number of new HIV infections per 1,000 uninfected population',
    'Malaria': 'Malaria incidence per 1,000 population at risk',
    'Tuberculosis': 'Tuberculosis incidence',
    'Cardiovascular': 'Mortality rate attributed to cardiovascular disease, cancer,\n            diabetes or chronic respiratory disease',
    'Water & Sanitation': 'Mortality rate attributed to unsafe water, unsafe sanitation\n            and lack of hygiene'
  };

  // Your app's color palette
  const colors = {
    primary: {
      deep: '#1a365d',
      ocean: '#2b6cb0',
      light: '#3182ce'
    },
    accent: {
      coral: '#ed8936',
      warm: '#f6ad55',
      light: '#fbd38d',
      green: '#38a169',
      teal: '#319795'
    },
    neutral: {
      900: '#1a202c',
      800: '#2d3748',
      700: '#4a5568',
      600: '#718096',
      500: '#a0aec0',
      400: '#cbd5e0',
      300: '#e2e8f0',
      200: '#edf2f7',
      100: '#f7fafc',
      50: '#fafbfc'
    }
  };

  // Country color assignments
  const getCountryColor = (index) => {
    const colorPalette = [
      colors.primary.ocean,
      colors.accent.coral,
      colors.accent.green,
      colors.accent.teal,
      colors.primary.light,
      colors.accent.warm,
      colors.neutral,
      '#9f7aea',
      '#f56565',
      '#4fd1c7',
      '#68d391',
      '#f6e05e',
      '#fc8181',
      '#63b3ed',
      '#f093fb',
      '#fbb6ce'
    ];
    return colorPalette[index % colorPalette.length];
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        let csvContent = '';
        let dataLoaded = false;

        try {
          const response = await fetch(dataFile);
          if (response.ok) {
            csvContent = await response.text();
            dataLoaded = true;
          }
        } catch (err) {
          console.log('Could not load from fetch');
        }

        if (dataLoaded && csvContent) {
          const parsedData = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          }).data;

          const processedData = {};
          const countriesSet = new Set();

          // Process each disease
          Object.entries(diseaseIndicators).forEach(([disease, indicator]) => {
            const diseaseData = parsedData.filter(row => {
              const rowIndicator = row['Indicator']?.trim();
              const targetIndicator = indicator.trim();
              return rowIndicator === targetIndicator &&
                row['OBS_VALUE'] !== null &&
                row['OBS_VALUE'] !== undefined &&
                !isNaN(row['OBS_VALUE']) &&
                row['TIME_PERIOD'] >= 2010;
            });

            const yearData = {};
            diseaseData.forEach(row => {
              const country = row['Pacific Island Countries and territories'];
              const year = row['TIME_PERIOD'];
              const value = parseFloat(row['OBS_VALUE']);
              
              if (country) {
                countriesSet.add(country);
                if (!yearData[year]) {
                  yearData[year] = {};
                }
                yearData[year][country] = value;
              }
            });

            processedData[disease] = yearData;
          });

          const countries = Array.from(countriesSet).sort();
          setAvailableCountries(countries);
          setSelectedCountries(countries.slice(0, 8)); // Select first 8 by default
          setData(processedData);
        } else {
          setError('Could not load or parse data');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Error loading data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  const toggleCountry = (country) => {
    setSelectedCountries(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  const handleHover = (year, country, value, disease, e) => {
    setTooltip({
      visible: true,
      data: { year, country, value, disease },
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleLeave = () => {
    setTooltip({ visible: false, data: null, position: { x: 0, y: 0 } });
  };

  const getValueFormat = (disease, value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    
    switch(disease) {
      case 'HIV':
        return `${value.toFixed(2)}/1,000`;
      case 'Malaria':
        return `${value.toFixed(1)}/1,000`;
      case 'Tuberculosis':
        return `${Math.round(value)}/100,000`;
      case 'Cardiovascular':
        return `${value.toFixed(1)}/100,000`;
      case 'Water & Sanitation':
        return `${value.toFixed(2)}/100,000`;
      default:
        return value.toString();
    }
  };

  const renderStackedAreaChart = (disease) => {
    const currentData = data[disease] || {};
    const years = Object.keys(currentData).sort();
    
    if (years.length === 0) return <div className="no-data">No data available</div>;

    // Get countries that have data and are selected
    const countriesWithData = selectedCountries.filter(country => {
      return years.some(year => currentData[year] && currentData[year][country]);
    });

    if (countriesWithData.length === 0) return <div className="no-data">No selected countries have data</div>;

    // Create stacked data similar to D3 stack
    const stackedData = years.map(year => {
      const yearData = currentData[year] || {};
      let cumulative = 0;
      const stackData = { year: parseInt(year) };
      
      countriesWithData.forEach(country => {
        const value = yearData[country] || 0;
        stackData[`${country}_start`] = cumulative;
        cumulative += value;
        stackData[`${country}_end`] = cumulative;
        stackData[country] = value;
      });
      
      stackData.total = cumulative;
      return stackData;
    });

    const maxValue = Math.max(...stackedData.map(d => d.total));
    if (maxValue === 0) return <div className="no-data">No data values</div>;

    // Chart dimensions 
    const margin = { top: 15, right: 25, bottom: 25, left: 45 }; // Reduced margins
    const width = 200 - margin.left - margin.right; // Reduced from 320
    const height = 100 - margin.top - margin.bottom; // Reduced from 240
    
    // Create area path for each country
    const createAreaPath = (country) => {
      const points = stackedData.map(d => {
        const x = ((d.year - stackedData[0].year) / (stackedData[stackedData.length - 1].year - stackedData[0].year)) * width;
        const y0 = height - (d[`${country}_start`] / maxValue) * height;
        const y1 = height - (d[`${country}_end`] / maxValue) * height;
        return { x, y0, y1, year: d.year, value: d[country] };
      });

      const topPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y1}`).join(' ');
      const bottomPath = points.slice().reverse().map(p => `L ${p.x} ${p.y0}`).join(' ');
      
      return {
        path: `${topPath} ${bottomPath} Z`,
        points
      };
    };

    return (
      <div className="chart-wrapper">
        <svg 
          width={width + margin.left + margin.right} 
          height={height + margin.top + margin.bottom}
          viewBox={`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`}
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Y-axis */}
            <line x1="0" y1="0" x2="0" y2={height} stroke={colors.neutral[400]} strokeWidth="1"/>
            
            {/* X-axis */}
            <line x1="0" y1={height} x2={width} y2={height} stroke={colors.neutral[400]} strokeWidth="1"/>
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <line 
                key={ratio}
                x1="0" 
                y1={height - (ratio * height)} 
                x2={width} 
                y2={height - (ratio * height)} 
                stroke={colors.neutral[300]}
                strokeWidth="0.5"
                strokeDasharray="2,2"
                opacity="0.5"
              />
            ))}
            
            {/* Stacked areas */}
            {countriesWithData.map((country, index) => {
              const countryIndex = availableCountries.indexOf(country);
              const pathData = createAreaPath(country);
              
              return (
                <path
                  key={country}
                  d={pathData.path}
                  fill={getCountryColor(countryIndex)}
                  opacity="0.8"
                  stroke={getCountryColor(countryIndex)}
                  strokeWidth="0.5"
                  className="area-path"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                    const mouseX = e.clientX - rect.left - margin.left;
                    const yearProgress = mouseX / width;
                    const yearIndex = Math.round(yearProgress * (stackedData.length - 1));
                    const dataPoint = stackedData[yearIndex];
                    
                    if (dataPoint && dataPoint[country] > 0) {
                      handleHover(dataPoint.year, country, dataPoint[country], disease, e);
                    }
                  }}
                  onMouseLeave={handleLeave}
                />
              );
            })}
            
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <g key={ratio}>
                <line 
                  x1="-5" 
                  y1={height - (ratio * height)} 
                  x2="0" 
                  y2={height - (ratio * height)} 
                  stroke={colors.neutral[400]} 
                />
                <text 
                  x="-8" 
                  y={height - (ratio * height) + 3} 
                  textAnchor="end" 
                  fontSize="8" 
                  fill={colors.neutral[600]}
                >
                  {maxValue < 9 ? (maxValue * ratio).toFixed(1) : Math.round(maxValue * ratio)}
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {stackedData.filter((_, i) => i % Math.ceil(stackedData.length / 5) === 0).map(d => {
              const x = ((d.year - stackedData[0].year) / (stackedData[stackedData.length - 1].year - stackedData[0].year)) * width;
              return (
                <g key={d.year}>
                  <line 
                    x1={x} 
                    y1={height} 
                    x2={x} 
                    y2={height + 5} 
                    stroke={colors.neutral[400]} 
                  />
                  <text 
                    x={x} 
                    y={height + 18} 
                    textAnchor="middle" 
                    fontSize="8" 
                    fill={colors.neutral[600]}
                  >
                    {d.year}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="spinner"></div>
        <p>Loading health data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <style jsx>{`
        .dashboard {
          width: 100vw;
          height: 100vh;
          background: ${colors.neutral[50]};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: ${colors.neutral[800]};
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .dashboard.loading, .dashboard.error {
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .spinner {
          border: 3px solid ${colors.neutral[300]};
          border-top: 3px solid ${colors.primary.ocean};
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        

        .title {
          font-size: 24px;
          font-weight: 700;
          color: ${colors.primary.deep};
          margin: 0;
        }

        .main-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .country-selector {
          width: 310px;
          background: white;
          border-right: 1px solid ${colors.neutral[300]};
          padding: 180px 20px 20px 20px;
          overflow-y: auto;
          flex-shrink: 0;
        }

        

        .country-buttons {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .country-button {
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid ${colors.neutral[300]};
          background: white;
          color: ${colors.neutral[700]};
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          text-align: left;
        }

        .country-button:hover {
          border-color: ${colors.primary.light};
          background: ${colors.neutral[50]};
        }

        .country-button.selected {
          background: ${colors.primary.ocean};
          border-color: ${colors.primary.ocean};
          color: white;
        }

        .country-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .charts-container {
          flex: 1;
          padding: 100px 24px 24px 24px;
          overflow: auto;
          background: ${colors.neutral[200]};
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 5px;
          height: fit-content;
        }

        .chart-card {
          background: 'transparent';
          border-radius: 12px;
          padding: 5px;
        }

        .chart-title {
          font-size: 18px;
          font-weight: 700;
          color: ${colors.primary.deep};
          margin-bottom: 1px;
          text-align: left;
        }

        .chart-subtitle {
          font-size: 13px;
          color: ${colors.neutral[600]};
          text-align: left;
          margin-bottom: 2px;
        }

        .chart-area {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
        }

        .chart-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .no-data {
          color: ${colors.neutral[500]};
          font-style: italic;
          text-align: center;
          font-size: 14px;
        }

        .area-path {
          transition: opacity 0.2s ease;
          cursor: pointer;
        }

        .area-path:hover {
          opacity: 1 !important;
        }

        .legend {
          margin-top: 2px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: ${colors.neutral[700]};
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        .tooltip {
          position: fixed;
          background: rgba(26, 54, 93, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 12px;
          color: white;
          font-size: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          pointer-events: none;
          z-index: 1000;
          max-width: 200px;
        }

        .tooltip-title {
          font-weight: 700;
          margin-bottom: 6px;
        }

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }

        .tooltip-label {
          color: rgba(255, 255, 255, 0.8);
        }

        .tooltip-value {
          font-weight: 600;
        }

        @media (max-width: 1200px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .main-content {
            flex-direction: column;
          }
          
          .country-selector {
            width: 100%;
            max-height: 150px;
            padding: 5px;
          }
          
          .country-buttons {
            flex-direction: row;
            flex-wrap: wrap;
          }
          
          .charts-container {
            padding: 5px;
          }
          
          .header {
            padding: 20px 16px 16px 16px;
          }
        }
      `}</style>

      

      <div className="main-content">
        <div className="country-selector">
          <div className="country-buttons">
            {availableCountries.map((country, index) => (
              <button
                key={country}
                className={`country-button ${selectedCountries.includes(country) ? 'selected' : ''}`}
                onClick={() => toggleCountry(country)}
              >
                <div 
                  className="country-dot" 
                  style={{ backgroundColor: getCountryColor(index) }}
                />
                {country}
              </button>
            ))}
          </div>
        </div>

        <div className="charts-container">
          <div className="charts-grid">
            {Object.keys(diseaseIndicators).map(disease => (
              <div key={disease} className="chart-card">
                <div className="chart-title">{disease}</div>
                <div className="chart-subtitle">
                  {disease === 'HIV' && 'New infections per 1,000 uninfected population'}
                  {disease === 'Malaria' && 'Cases per 1,000 population at risk'}
                  {disease === 'Tuberculosis' && 'Incidence per 100,000 population'}
                  {disease === 'Cardiovascular' && 'Deaths per 100,000 population'}
                  {disease === 'Water & Sanitation' && 'Deaths per 100,000 population'}
                </div>
                <div className="chart-area">
                  {renderStackedAreaChart(disease)}
                </div>
                
                {/* Legend */}
                <div className="legend">
                  {selectedCountries.filter(country => {
                    const diseaseData = data[disease] || {};
                    return Object.keys(diseaseData).some(year => diseaseData[year] && diseaseData[year][country]);
                  }).map((country, index) => {
                    const countryIndex = availableCountries.indexOf(country);
                    return (
                      <div key={country} className="legend-item">
                        <div 
                          className="legend-color" 
                          style={{ backgroundColor: getCountryColor(countryIndex) }}
                        />
                        <span>{country}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div 
          className="tooltip"
          style={{
            left: tooltip.position.x + 10,
            top: tooltip.position.y - 10
          }}
        >
          <div className="tooltip-title">{tooltip.data.country}</div>
          <div className="tooltip-row">
            <span className="tooltip-label">Year:</span>
            <span className="tooltip-value">{tooltip.data.year}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">{tooltip.data.disease}:</span>
            <span className="tooltip-value">
              {getValueFormat(tooltip.data.disease, tooltip.data.value)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacificDiseasesDashboard;