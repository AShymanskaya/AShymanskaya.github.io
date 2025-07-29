import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';

// Disease indicators mapping - moved outside component to avoid dependency issues
const diseaseIndicators = {
  'HIV': 'Number of new HIV infections per 1,000 uninfected population',
  'Malaria': 'Malaria incidence per 1,000 population at risk',
  'Tuberculosis': 'Tuberculosis incidence',
  'Cardiovascular': 'Mortality rate attributed to cardiovascular disease, cancer,\n            diabetes or chronic respiratory disease',
  'Water & Sanitation': 'Mortality rate attributed to unsafe water, unsafe sanitation\n            and lack of hygiene'
};

const PacificDiseasesDashboard = ({ 
  dataFile = '/data/health_data.csv',
  transparent = true
}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });
  const containerRef = useRef(null);

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

  // Regional groupings - you may need to adjust based on your specific countries
  const pacificRegions = {
    polynesia: [
      'Samoa', 'Tonga', 'Tuvalu', 'Cook Islands', 'French Polynesia', 
      'Niue', 'Tokelau', 'American Samoa', 'Wallis and Futuna'
    ],
    micronesia: [
      'Federated States of Micronesia', 'Kiribati', 'Marshall Islands', 
      'Nauru', 'Palau', 'Guam', 'Northern Mariana Islands'
    ],
    melanesia: [
      'Fiji', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu', 
      'New Caledonia'
    ]
  };

  // Regional color palettes - distinct families with variations
  const regionalColors = {
    polynesia: {
      base: '#2b6cb0',  // Ocean blue family
      shades: [
        '#1a4d8b',  // Deep ocean
        '#2b6cb0',  // Primary ocean
        '#3182ce',  // Bright ocean
        '#4299e1',  // Sky blue
        '#63b3ed',  // Light sky
        '#90cdf4',  // Pale sky
      ]
    },
    micronesia: {
      base: '#38a169',  // Green/teal family
      shades: [
        '#22543d',  // Deep forest
        '#276749',  // Forest green
        '#38a169',  // Primary green
        '#48bb78',  // Bright green
        '#68d391',  // Light green
        '#9ae6b4',  // Pale green
      ]
    },
    melanesia: {
      base: '#ed8936',  // Coral/warm family
      shades: [
        '#c05621',  // Deep coral
        '#dd6b20',  // Burnt orange
        '#ed8936',  // Primary coral
        '#f6ad55',  // Warm orange
        '#fbd38d',  // Light peach
        '#fed7aa',  // Pale peach
      ]
    },
    other: {
      base: '#9f7aea',  // Purple family for unclassified
      shades: [
        '#6b46c1',  // Deep purple
        '#805ad5',  // Royal purple
        '#9f7aea',  // Primary purple
        '#b794f4',  // Bright purple
        '#d6bcfa',  // Light purple
        '#e9d8fd',  // Pale purple
      ]
    }
  };

  // Get the region for a country
  const getCountryRegion = (country) => {
    for (const [region, countries] of Object.entries(pacificRegions)) {
      if (countries.some(c => country.toLowerCase().includes(c.toLowerCase()) || 
                              c.toLowerCase().includes(country.toLowerCase()))) {
        return region;
      }
    }
    return 'other';
  };

  // Country color assignments based on region
  const getCountryColor = (index, country) => {
    const region = getCountryRegion(country);
    const colorShades = regionalColors[region].shades;
    
    // Get countries in the same region
    const regionCountries = availableCountries.filter(c => getCountryRegion(c) === region);
    const regionIndex = regionCountries.indexOf(country);
    
    // Return a color from the region's palette
    return colorShades[regionIndex % colorShades.length];
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
          setSelectedCountries(countries.slice(0, 16)); // Select first 16 by default
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

    // Responsive chart dimensions
    const isMobile = window.innerWidth < 768;
    const margin = { 
      top: isMobile ? 8 : 10, 
      right: isMobile ? 12 : 20, 
      bottom: isMobile ? 15 : 20, 
      left: isMobile ? 25 : 35 
    };
    const width = (isMobile ? 220 : 280) - margin.left - margin.right;
    const height = (isMobile ? 120 : 160) - margin.top - margin.bottom;
    
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
                  fill={getCountryColor(countryIndex, country)}
                  opacity="0.8"
                  stroke={getCountryColor(countryIndex, country)}
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
            {[0, 0.5, 1].map(ratio => (
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
                  fontSize={isMobile ? "7" : "8"} 
                  fill={colors.neutral[600]}
                >
                  {maxValue < 9 ? (maxValue * ratio).toFixed(1) : Math.round(maxValue * ratio)}
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {stackedData.filter((_, i) => i % Math.ceil(stackedData.length / 3) === 0).map(d => {
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
                    y={height + 15} 
                    textAnchor="middle" 
                    fontSize={isMobile ? "7" : "8"} 
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
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          borderRadius: '0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: colors.neutral[800]
        }}
      >
        <div style={{
          border: `3px solid ${colors.neutral[300]}`,
          borderTop: `3px solid ${colors.primary.ocean}`,
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p>Loading health data...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          borderRadius: '0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: colors.neutral[800]
        }}
      >
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    );
  }

  const isMobile = window.innerWidth < 768;

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        background: 'transparent',
        borderRadius: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: colors.neutral[800],
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <style jsx>{`
        .main-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          flex-direction: ${isMobile ? 'column' : 'row'};
        }

        .country-selector {
          width: ${isMobile ? '100%' : '180px'};
          max-height: ${isMobile ? '100px' : 'none'};
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-right: ${isMobile ? 'none' : `1px solid rgba(255, 255, 255, 0.2)`};
          border-bottom: ${isMobile ? `1px solid rgba(255, 255, 255, 0.2)` : 'none'};
          padding: ${isMobile ? '6px' : '12px'};
          overflow-y: auto;
          flex-shrink: 0;
        }

        .region-section {
          margin-bottom: 10px;
        }

        .region-title {
          font-size: ${isMobile ? '10px' : '12px'};
          font-weight: 600;
          color: ${colors.neutral[700]};
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .country-buttons {
          display: flex;
          flex-direction: ${isMobile ? 'row' : 'column'};
          flex-wrap: ${isMobile ? 'wrap' : 'nowrap'};
          gap: ${isMobile ? '2px' : '3px'};
        }

        .country-button {
          padding: ${isMobile ? '2px 6px' : '4px 8px'};
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(5px);
          color: ${colors.neutral[700]};
          cursor: pointer;
          font-size: ${isMobile ? '9px' : '11px'};
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          text-align: left;
        }

        .country-button:hover {
          border-color: rgba(49, 130, 206, 0.5);
          background: rgba(255, 255, 255, 0.2);
        }

        .country-button.selected {
          background: rgba(43, 108, 176, 0.8);
          border-color: rgba(43, 108, 176, 0.8);
          color: white;
        }

        .country-dot {
          width: ${isMobile ? '6px' : '8px'};
          height: ${isMobile ? '6px' : '8px'};
          border-radius: 50%;
          flex-shrink: 0;
        }

        .charts-container {
          flex: 1;
          padding: ${isMobile ? '10px' : '20px'};
          overflow: auto;
          background: transparent;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: ${isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))'};
          gap: ${isMobile ? '10px' : '20px'};
          height: fit-content;
        }

        .chart-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: ${isMobile ? '10px' : '16px'};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .chart-title {
          font-size: ${isMobile ? '14px' : '18px'};
          font-weight: 700;
          color: ${colors.primary.deep};
          margin-bottom: 4px;
          text-align: left;
        }

        .chart-subtitle {
          font-size: ${isMobile ? '11px' : '13px'};
          color: ${colors.primary.deep};
          text-align: left;
          margin-bottom: ${isMobile ? '8px' : '12px'};
        }

        .chart-area {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: ${isMobile ? '120px' : '160px'};
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
          font-size: ${isMobile ? '12px' : '14px'};
        }

        .area-path {
          transition: opacity 0.2s ease;
          cursor: pointer;
        }

        .area-path:hover {
          opacity: 1 !important;
        }

        .tooltip {
          position: fixed;
          background: rgba(26, 54, 93, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 8px;
          color: white;
          font-size: 11px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          pointer-events: none;
          z-index: 1000;
          max-width: 180px;
        }

        .tooltip-title {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }

        .tooltip-label {
          color: rgba(255, 255, 255, 0.8);
        }

        .tooltip-value {
          font-weight: 600;
        }

        /* Scrollbar styles */
        .country-selector::-webkit-scrollbar,
        .charts-container::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .country-selector::-webkit-scrollbar-track,
        .charts-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }

        .country-selector::-webkit-scrollbar-thumb,
        .charts-container::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .country-selector::-webkit-scrollbar-thumb:hover,
        .charts-container::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="main-content">
        <div className="country-selector">
          {/* Group countries by region */}
          {Object.entries(pacificRegions).map(([region, regionCountries]) => {
            const availableRegionCountries = availableCountries.filter(country => 
              regionCountries.some(rc => 
                country.toLowerCase().includes(rc.toLowerCase()) || 
                rc.toLowerCase().includes(country.toLowerCase())
              )
            );
            
            if (availableRegionCountries.length === 0) return null;
            
            return (
              <div key={region} className="region-section">
                <div className="region-title">{region}</div>
                <div className="country-buttons">
                  {availableRegionCountries.map((country, index) => {
                    const countryIndex = availableCountries.indexOf(country);
                    return (
                      <button
                        key={country}
                        className={`country-button ${selectedCountries.includes(country) ? 'selected' : ''}`}
                        onClick={() => toggleCountry(country)}
                      >
                        <div 
                          className="country-dot" 
                          style={{ backgroundColor: getCountryColor(countryIndex, country) }}
                        />
                        {isMobile ? country.substring(0, 3) : country}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {/* Other/unclassified countries */}
          {(() => {
            const otherCountries = availableCountries.filter(country => 
              getCountryRegion(country) === 'other'
            );
            
            if (otherCountries.length === 0) return null;
            
            return (
              <div className="region-section">
                <div className="region-title">Other</div>
                <div className="country-buttons">
                  {otherCountries.map((country, index) => {
                    const countryIndex = availableCountries.indexOf(country);
                    return (
                      <button
                        key={country}
                        className={`country-button ${selectedCountries.includes(country) ? 'selected' : ''}`}
                        onClick={() => toggleCountry(country)}
                      >
                        <div 
                          className="country-dot" 
                          style={{ backgroundColor: getCountryColor(countryIndex, country) }}
                        />
                        {isMobile ? country.substring(0, 3) : country}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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