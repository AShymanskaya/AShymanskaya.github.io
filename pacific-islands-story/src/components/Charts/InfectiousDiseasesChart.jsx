import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const InfectiousDiseasesChart = ({ 
  dataFile = '/data/health_data.csv',
  transparent = false
}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentDisease, setCurrentDisease] = useState('HIV');
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });

  const diseaseIndicators = {
    'HIV': 'Number of new HIV infections per 1,000 uninfected population',
    'Malaria': 'Malaria incidence per 1,000 population at risk',
    'Tuberculosis': 'Tuberculosis incidence'
  };

  const countryColors = {
    'Papua New Guinea': '#c53030',
    'Solomon Islands': '#e53e3e',
    'Vanuatu': '#fc8181',
    'Fiji': '#feb2b2',
    'Kiribati': '#3182ce',
    'Marshall Islands': '#4299e1',
    'Micronesia (FSM)': '#63b3ed',
    'Tonga': '#90cdf4',
    'Samoa': '#bee3f8',
    'New Caledonia': '#f6ad55',
    'Palau': '#fbd38d',
    'Tuvalu': '#fde68a',
    'Nauru': '#68d391'
  };

  useEffect(() => {
    const loadHealthData = async () => {
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
          console.log('Could not load health data');
        }

        if (dataLoaded && csvContent) {
          const parsedData = Papa.parse(csvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          }).data;

          const processedData = {};

          // Process each disease
          Object.entries(diseaseIndicators).forEach(([disease, indicator]) => {
            const diseaseData = parsedData.filter(row => 
              row['Indicator'] === indicator &&
              row['OBS_VALUE'] !== null &&
              row['OBS_VALUE'] !== undefined &&
              !isNaN(row['OBS_VALUE']) &&
              row['TIME_PERIOD'] >= 2010
            );

            const yearData = {};
            diseaseData.forEach(row => {
              const country = row['Pacific Island Countries and territories'];
              const year = row['TIME_PERIOD'];
              const value = parseFloat(row['OBS_VALUE']);
              
              if (!yearData[year]) {
                yearData[year] = {};
              }
              yearData[year][country] = value;
            });

            processedData[disease] = yearData;
          });

          setData(processedData);
        } else {
          // Fallback demo data
          const demoData = {
            'HIV': {
              2015: { 'Papua New Guinea': 0.97, 'Solomon Islands': 0.46, 'Vanuatu': 0.37, 'Fiji': 0.36, 'Kiribati': 0.16 },
              2016: { 'Papua New Guinea': 0.94, 'Solomon Islands': 0.44, 'Vanuatu': 0.35, 'Fiji': 0.34, 'Kiribati': 0.15 },
              2017: { 'Papua New Guinea': 0.91, 'Solomon Islands': 0.43, 'Vanuatu': 0.33, 'Fiji': 0.32, 'Kiribati': 0.15 },
              2018: { 'Papua New Guinea': 0.89, 'Solomon Islands': 0.42, 'Vanuatu': 0.32, 'Fiji': 0.31, 'Kiribati': 0.15 },
              2019: { 'Papua New Guinea': 0.87, 'Solomon Islands': 0.42, 'Vanuatu': 0.31, 'Fiji': 0.30, 'Kiribati': 0.15 },
              2020: { 'Papua New Guinea': 0.86, 'Solomon Islands': 0.42, 'Vanuatu': 0.31, 'Fiji': 0.29, 'Kiribati': 0.15 },
              2021: { 'Papua New Guinea': 0.85, 'Solomon Islands': 0.42, 'Vanuatu': 0.31, 'Fiji': 0.28, 'Kiribati': 0.15 },
              2022: { 'Papua New Guinea': 0.85, 'Solomon Islands': 0.42, 'Vanuatu': 0.31, 'Fiji': 0.28, 'Kiribati': 0.15 }
            },
            'Malaria': {
              2015: { 'Papua New Guinea': 145, 'Solomon Islands': 125, 'Vanuatu': 63, 'New Caledonia': 6.5 },
              2016: { 'Papua New Guinea': 148, 'Solomon Islands': 118, 'Vanuatu': 58, 'New Caledonia': 5.2 },
              2017: { 'Papua New Guinea': 151, 'Solomon Islands': 110, 'Vanuatu': 52, 'New Caledonia': 4.1 },
              2018: { 'Papua New Guinea': 154, 'Solomon Islands': 102, 'Vanuatu': 47, 'New Caledonia': 3.2 },
              2019: { 'Papua New Guinea': 156, 'Solomon Islands': 95, 'Vanuatu': 42, 'New Caledonia': 2.8 },
              2020: { 'Papua New Guinea': 157, 'Solomon Islands': 91, 'Vanuatu': 38, 'New Caledonia': 2.3 },
              2021: { 'Papua New Guinea': 157, 'Solomon Islands': 89, 'Vanuatu': 35, 'New Caledonia': 2.1 },
              2022: { 'Papua New Guinea': 157, 'Solomon Islands': 89, 'Vanuatu': 35, 'New Caledonia': 2.1 }
            },
            'Tuberculosis': {
              2015: { 'Marshall Islands': 410, 'Kiribati': 265, 'Micronesia (FSM)': 257, 'Papua New Guinea': 364, 'Fiji': 115 },
              2016: { 'Marshall Islands': 425, 'Kiribati': 278, 'Micronesia (FSM)': 248, 'Papua New Guinea': 378, 'Fiji': 108 },
              2017: { 'Marshall Islands': 441, 'Kiribati': 285, 'Micronesia (FSM)': 242, 'Papua New Guinea': 395, 'Fiji': 102 },
              2018: { 'Marshall Islands': 456, 'Kiribati': 291, 'Micronesia (FSM)': 238, 'Papua New Guinea': 412, 'Fiji': 97 },
              2019: { 'Marshall Islands': 468, 'Kiribati': 295, 'Micronesia (FSM)': 235, 'Papua New Guinea': 425, 'Fiji': 92 },
              2020: { 'Marshall Islands': 475, 'Kiribati': 297, 'Micronesia (FSM)': 234, 'Papua New Guinea': 431, 'Fiji': 89 },
              2021: { 'Marshall Islands': 481, 'Kiribati': 298, 'Micronesia (FSM)': 234, 'Papua New Guinea': 432, 'Fiji': 87 },
              2022: { 'Marshall Islands': 487, 'Kiribati': 298, 'Micronesia (FSM)': 234, 'Papua New Guinea': 432, 'Fiji': 87 }
            }
          };
          setData(demoData);
        }
      } catch (error) {
        setError(error);
        console.error('Error loading health data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, [dataFile]);

  const handleHover = (year, country, value, e) => {
    setTooltip({
      visible: true,
      data: { year, country, value, disease: currentDisease },
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleLeave = () => {
    setTooltip({ visible: false, data: null, position: { x: 0, y: 0 } });
  };

  const getValueFormat = (disease, value) => {
    switch(disease) {
      case 'HIV':
        return `${value.toFixed(2)} per 1,000`;
      case 'Malaria':
        return `${value.toFixed(1)} per 1,000`;
      case 'Tuberculosis':
        return `${Math.round(value)} per 100,000`;
      default:
        return value.toString();
    }
  };

  const renderStackedAreaChart = () => {
    const currentData = data[currentDisease] || {};
    const years = Object.keys(currentData).sort();
    
    if (years.length === 0) return null;

    // Get all countries
    const allCountries = new Set();
    years.forEach(year => {
      Object.keys(currentData[year] || {}).forEach(country => {
        allCountries.add(country);
      });
    });
    const countries = Array.from(allCountries);

    // Calculate stacked data
    const stackedData = years.map(year => {
      const yearData = currentData[year] || {};
      let cumulative = 0;
      const countryValues = countries.map(country => {
        const value = yearData[country] || 0;
        const start = cumulative;
        cumulative += value;
        return { country, value, start, end: cumulative };
      });
      return { year, total: cumulative, countries: countryValues };
    });

    const maxValue = Math.max(...stackedData.map(d => d.total));
    const chartWidth = 400;
    const chartHeight = 200;
    const padding = 40;

    // Create SVG path for each country
    const createAreaPath = (countryName) => {
      const points = stackedData.map((d, i) => {
        const x = (i / (stackedData.length - 1)) * chartWidth;
        const countryData = d.countries.find(c => c.country === countryName);
        const yStart = chartHeight - (countryData.start / maxValue) * chartHeight;
        const yEnd = chartHeight - (countryData.end / maxValue) * chartHeight;
        return { x, yStart, yEnd };
      });

      const topPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yEnd}`).join(' ');
      const bottomPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yStart}`).reverse().join(' ');
      
      return `${topPath} L ${points[points.length - 1].x} ${points[points.length - 1].yStart} ${bottomPath} Z`;
    };

    return (
      <div className="stacked-area-chart">
        <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${chartWidth + padding * 2} ${chartHeight + padding * 2}`}>
          <g transform={`translate(${padding}, ${padding})`}>
            {/* Y-axis */}
            <line x1="0" y1="0" x2="0" y2={chartHeight} stroke={transparent ? '#a0aec0' : 'rgba(255,255,255,0.3)'} strokeWidth="1"/>
            
            {/* X-axis */}
            <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke={transparent ? '#a0aec0' : 'rgba(255,255,255,0.3)'} strokeWidth="1"/>
            
            {/* Area layers */}
            {countries.map(country => (
              <path
                key={country}
                d={createAreaPath(country)}
                fill={countryColors[country] || '#718096'}
                opacity="0.8"
                stroke={countryColors[country] || '#718096'}
                strokeWidth="1"
                className="area-path"
                onMouseMove={(e) => {
                  // Find closest year
                  const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                  const x = e.clientX - rect.left - padding;
                  const yearIndex = Math.round((x / chartWidth) * (years.length - 1));
                  const year = years[yearIndex];
                  const yearData = currentData[year];
                  if (yearData && yearData[country]) {
                    handleHover(year, country, yearData[country], e);
                  }
                }}
                onMouseLeave={handleLeave}
              />
            ))}
            
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <g key={ratio}>
                <line 
                  x1="-5" 
                  y1={chartHeight - (ratio * chartHeight)} 
                  x2="0" 
                  y2={chartHeight - (ratio * chartHeight)} 
                  stroke={transparent ? '#a0aec0' : 'rgba(255,255,255,0.3)'} 
                />
                <text 
                  x="-10" 
                  y={chartHeight - (ratio * chartHeight) + 4} 
                  textAnchor="end" 
                  fontSize="10" 
                  fill={transparent ? '#4a5568' : 'rgba(255,255,255,0.8)'}
                >
                  {Math.round(maxValue * ratio)}
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {years.filter((_, i) => i % 2 === 0).map((year, i) => {
              const actualIndex = years.indexOf(year);
              const x = (actualIndex / (years.length - 1)) * chartWidth;
              return (
                <text 
                  key={year}
                  x={x} 
                  y={chartHeight + 15} 
                  textAnchor="middle" 
                  fontSize="10" 
                  fill={transparent ? '#4a5568' : 'rgba(255,255,255,0.8)'}
                >
                  {year}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="diseases-chart">
        <style jsx>{`
          .diseases-chart {
            width: 100%;
            height: 400px;
            background: ${transparent ? 'transparent' : 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)'};
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: ${transparent ? '#2d3748' : 'white'};
            font-size: 16px;
            font-weight: 500;
          }
          
          .spinner {
            border: 3px solid ${transparent ? 'rgba(45, 55, 72, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
            border-top: 3px solid #f6ad55;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div className="spinner" />
        <p>Loading infectious disease data...</p>
      </div>
    );
  }

  return (
    <div className="diseases-chart">
      <style jsx>{`
        .diseases-chart {
          width: 100%;
          height: 100%;
          background: ${transparent ? 'transparent' : 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)'};
          border-radius: ${transparent ? '0' : '8px'};
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: ${transparent ? '#2d3748' : 'white'};
          overflow: hidden;
        }

        .disease-tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: ${transparent ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)'};
          border-bottom: 1px solid ${transparent ? 'rgba(45, 55, 72, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
        }

        .disease-tab {
          padding: 6px 14px;
          background: ${transparent ? 'rgba(45, 55, 72, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
          border: 1px solid ${transparent ? 'rgba(45, 55, 72, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 16px;
          color: ${transparent ? '#2d3748' : 'white'};
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .disease-tab:hover {
          background: ${transparent ? 'rgba(45, 55, 72, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
          transform: translateY(-1px);
        }

        .disease-tab.active {
          background: #f6ad55;
          border-color: #f6ad55;
          color: #1a365d;
        }

        .chart-content {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .stacked-area-chart {
          width: 100%;
          max-width: 500px;
          height: 300px;
        }

        .area-path {
          transition: opacity 0.3s ease;
          cursor: pointer;
        }

        .area-path:hover {
          opacity: 1 !important;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
          padding: 16px;
          background: ${transparent ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 8px;
          border: 1px solid ${transparent ? 'rgba(45, 55, 72, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .chart-title {
          text-align: center;
          margin-bottom: 20px;
          font-size: 16px;
          font-weight: 600;
          color: ${transparent ? '#2d3748' : 'white'};
        }

        .tooltip {
          position: fixed;
          background: ${transparent ? 'rgba(45, 55, 72, 0.95)' : 'rgba(26, 54, 93, 0.95)'};
          border: 1px solid ${transparent ? 'rgba(45, 55, 72, 0.3)' : 'rgba(255, 255, 255, 0.2)'};
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

        @media (max-width: 768px) {
          .disease-tabs {
            gap: 6px;
            padding: 10px 12px;
          }
          
          .disease-tab {
            padding: 5px 10px;
            font-size: 10px;
          }
          
          .chart-content {
            padding: 15px;
          }
          
          .legend {
            gap: 8px;
            padding: 12px;
          }
          
          .legend-item {
            font-size: 10px;
          }
        }
      `}</style>

      {/* Disease Tabs */}
      <div className="disease-tabs">
        {Object.keys(diseaseIndicators).map(disease => (
          <button
            key={disease}
            className={`disease-tab ${currentDisease === disease ? 'active' : ''}`}
            onClick={() => setCurrentDisease(disease)}
          >
            {disease}
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <div className="chart-content">
        <div className="chart-title">
          {currentDisease} Trends in Pacific Island Countries (2015-2022)
        </div>
        
        {renderStackedAreaChart()}
        
        {/* Legend */}
        <div className="legend">
          {Object.keys(data[currentDisease] || {}).length > 0 && 
            Object.keys(data[currentDisease][Object.keys(data[currentDisease])[0]] || {}).map(country => (
              <div key={country} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: countryColors[country] || '#718096' }}
                />
                <span>{country}</span>
              </div>
            ))
          }
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

export default InfectiousDiseasesChart;