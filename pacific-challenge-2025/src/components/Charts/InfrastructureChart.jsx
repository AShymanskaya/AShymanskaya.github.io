import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const InfrastructureChart = () => {
  const [data, setData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('Average');
  const [countries, setCountries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const infrastructureDataFile = `${process.env.PUBLIC_URL}/data/infrastructure.csv`;
        const infrastructureResponse = await fetch(infrastructureDataFile);
        let csvContent = '';
        
        if (infrastructureResponse.ok) {
          csvContent = await infrastructureResponse.text();
        } else {
          throw new Error('Could not load infrastructure data');
        }
        
        const parsed = Papa.parse(csvContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        // Process the data to get latest available year per country and indicator
        const validData = parsed.data.filter(d => d.OBS_VALUE != null && d.OBS_VALUE !== '');
        
        const connectivityMapping = {
          "Liner Shipping Connectivity Index": "Ship",
          "Proportion of airports with unpaved runways": "Airport", 
          "Proportion of roads unpaved": "Land"
        };

        // Group data by country and indicator to find latest year
        const groupedData = {};
        validData.forEach(row => {
          const country = row["Pacific Island Countries and territories"];
          const indicator = row.Indicator;
          const year = row.TIME_PERIOD;
          const value = row.OBS_VALUE;
          
          if (!connectivityMapping[indicator]) return; // Skip if not one of our target indicators
          
          const key = `${country}_${indicator}`;
          
          if (!groupedData[key] || year > groupedData[key].year) {
            groupedData[key] = {
              country,
              indicator,
              year,
              value
            };
          }
        });

        // Build final processed data structure
        const processedData = {};
        const countrySet = new Set();

        Object.values(groupedData).forEach(item => {
          const { country, indicator, value } = item;
          
          countrySet.add(country);
          
          if (!processedData[country]) {
            processedData[country] = {};
          }
          
          processedData[country][connectivityMapping[indicator]] = value;
        });

        // Calculate averages
        const allValues = { Ship: [], Airport: [], Land: [] };
        Object.values(processedData).forEach(countryData => {
          if (countryData.Ship !== undefined) allValues.Ship.push(countryData.Ship);
          if (countryData.Airport !== undefined) allValues.Airport.push(countryData.Airport);
          if (countryData.Land !== undefined) allValues.Land.push(countryData.Land);
        });

        const averages = {
          Ship: allValues.Ship.length > 0 ? allValues.Ship.reduce((a, b) => a + b, 0) / allValues.Ship.length : 0,
          Airport: allValues.Airport.length > 0 ? allValues.Airport.reduce((a, b) => a + b, 0) / allValues.Airport.length : 0,
          Land: allValues.Land.length > 0 ? allValues.Land.reduce((a, b) => a + b, 0) / allValues.Land.length : 0
        };

        processedData['Average'] = averages;
        
        setData(processedData);
        setCountries(['Average', ...Array.from(countrySet).sort()]);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const DonutChart = ({ data, title }) => {
    if (!data) return null;

    // Prepare data for nested circles
    const connectivityTypes = [
      { name: 'Ship', value: data.Ship || 0, color: '#3B82F6', description: 'Liner Shipping Connectivity Index' },
      { name: 'Airport', value: data.Airport || 0, color: '#EF4444', description: 'Percentage of airports with unpaved runways' },
      { name: 'Land', value: data.Land || 0, color: '#10B981', description: 'Percentage of roads that are unpaved' }
    ];

    const centerX = 120;
    const centerY = 120;
    
    // Define three concentric circles with different radii
    const circles = [
      { radius: 100, data: connectivityTypes[0], strokeWidth: 24 }, // Outermost - Ship
      { radius: 75, data: connectivityTypes[1], strokeWidth: 20 },  // Middle - Airport  
      { radius: 50, data: connectivityTypes[2], strokeWidth: 16 }   // Innermost - Land
    ];

    // Normalize values for stroke-dasharray (different scales need normalization)
    const normalizeValue = (value, type) => {
      if (type === 'Ship') {
        // Liner Shipping Connectivity Index (scale 0-100+), normalize to 0-100
        // Higher values = better connectivity
        return Math.min(Math.max(value / 1.5, 0), 100);
      } else {
        // Percentages (0-100) for unpaved infrastructure
        // Higher percentage of unpaved = worse connectivity
        // So we invert: 0% unpaved = 100% connectivity, 100% unpaved = 0% connectivity
        return Math.max(100 - value, 0);
      }
    };

    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <svg width="240" height="240" className="drop-shadow-lg">
            {/* Background circles */}
            {circles.map((circle, index) => (
              <circle
                key={`bg-${index}`}
                cx={centerX}
                cy={centerY}
                r={circle.radius}
                fill="none"
                stroke="transparent"
                strokeWidth={circle.strokeWidth}
              />
            ))}
            
            {/* Progress circles */}
            {circles.map((circle, index) => {
              const normalizedValue = normalizeValue(circle.data.value, circle.data.name);
              const circumference = 2 * Math.PI * circle.radius;
              const strokeDasharray = `${(normalizedValue / 100) * circumference} ${circumference}`;
              
              return (
                <circle
                  key={`progress-${index}`}
                  cx={centerX}
                  cy={centerY}
                  r={circle.radius}
                  fill="none"
                  stroke={circle.data.color}
                  strokeWidth={circle.strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  transform={`rotate(-90 ${centerX} ${centerY})`}
                  className="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onMouseEnter={(e) => showTooltip(e, circle.data, normalizedValue)}
                  onMouseLeave={hideTooltip}
                  onMouseMove={(e) => moveTooltip(e)}
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                />
              );
            })}
            
            {/* Center circle with title */}
            <circle
              cx={centerX}
              cy={centerY}
              r={35}
              fill="transparent"
              stroke="none"
              strokeWidth="2"
            />
            
            {/* Center text with primary dark blue color */}
            <text
              x={centerX}
              y={centerY - 5}
              textAnchor="middle"
              className="text-sm font-bold"
              style={{ fontSize: '14px', fill: '#1e3a8a' }}
            >
              {title}
            </text>
            <text
              x={centerX}
              y={centerY + 12}
              textAnchor="middle"
              className="text-xs"
              style={{ fontSize: '11px', fill: '#1e3a8a' }}
            >
              Connectivity
            </text>
          </svg>
        </div>

        
          
        
      </div>
    );
  };

  // Tooltip functions
  const showTooltip = (event, data, normalizedValue) => {
    const tooltip = document.getElementById('connectivity-tooltip') || createTooltip();
    const unit = data.name === 'Ship' ? 'Index' : '% unpaved';
    
    let scoreExplanation = '';
    if (data.name === 'Ship') {
      scoreExplanation = 'Higher index = better connectivity';
    } else {
      scoreExplanation = `${data.value.toFixed(1)}% unpaved = ${normalizedValue.toFixed(0)}% connectivity`;
    }
    
    tooltip.innerHTML = `
      <div style="color: #2d3748; font-weight: 600; margin-bottom: 8px; font-size: 14px;">${data.name} Infrastructure</div>
      <div style="color: #4a5568; margin-bottom: 4px; font-size: 12px;">${data.description}</div>
      <div style="color: #2b6cb0; font-weight: 600; margin-bottom: 4px;">Raw Value: ${data.value.toFixed(1)} ${unit}</div>
      <div style="color: #38a169; font-weight: 600; margin-bottom: 4px;">Connectivity Score: ${normalizedValue.toFixed(0)}%</div>
      <div style="color: #718096; font-size: 11px; font-style: italic;">${scoreExplanation}</div>
    `;
    
    tooltip.style.visibility = 'visible';
    moveTooltip(event);
  };

  const hideTooltip = () => {
    const tooltip = document.getElementById('connectivity-tooltip');
    if (tooltip) {
      tooltip.style.visibility = 'hidden';
    }
  };

  const moveTooltip = (event) => {
    const tooltip = document.getElementById('connectivity-tooltip');
    if (tooltip) {
      tooltip.style.top = (event.pageY - 10) + 'px';
      tooltip.style.left = (event.pageX + 15) + 'px';
    }
  };

  const createTooltip = () => {
    const tooltip = document.createElement('div');
    tooltip.id = 'connectivity-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      visibility: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f7fafc 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 2px 2px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
      z-index: 1000;
      max-width: 280px;
      pointer-events: none;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        background: 'transparent',
        borderRadius: '20px',
        color: '#718096',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #2b6cb0',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading connectivity data...</p>
      </div>
    );
  }

  const currentData = data && data[selectedCountry] ? data[selectedCountry] : null;

  return (
    <div style={{
      width: '100%',
      minHeight: '300px',
      background: 'transparent',
      borderRadius: '20px',
      padding: '3px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Country selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '2px'
      }}>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          style={{
            padding: '1px 1px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.4)',
            color: '#2d3748',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            outline: 'none'
          }}
        >
          {countries.map(country => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {/* Chart Container */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        marginBottom: '20px',
        background: 'transparent',
        borderRadius: '16px',
        padding: '2px',
      }}>
        {currentData ? (
          <DonutChart data={currentData} title={selectedCountry} />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '2px',
            color: '#a0aec0',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            No data available for selected country
          </div>
        )}
      </div>

      {/* Data interpretation note */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
        marginTop: '0'  // Removed extra margin
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2px 2px',
          background: 'rgba(255,255,255,0.4)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '2px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#3B82F6',
              borderRadius: '50%'
            }}></div>
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#2d3748',
              fontFamily: "'Space Grotesk', 'Inter', sans-serif"
            }}>Ship Connectivity</div>
          </div>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            lineHeight: '1.4'
          }}>Liner Shipping Connectivity Index measures maritime transport links. Higher values indicate better shipping connections.</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '2px 2px',
          background: 'rgba(255,255,255,0.4)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '2px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#EF4444',
              borderRadius: '50%'
            }}></div>
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#2d3748',
              fontFamily: "'Space Grotesk', 'Inter', sans-serif"
            }}>Airport Infrastructure</div>
          </div>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            lineHeight: '1.4'
          }}>Percentage of airports with unpaved runways. Lower values indicate better airport infrastructure.</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '2px 2px',
          background: 'rgba(255,255,255,0.4)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '2px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#10B981',
              borderRadius: '50%'
            }}></div>
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#2d3748',
              fontFamily: "'Space Grotesk', 'Inter', sans-serif"
            }}>Land Infrastructure</div>
          </div>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            lineHeight: '1.4'
          }}>Percentage of roads that are unpaved. Lower values indicate better road infrastructure.</div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default InfrastructureChart;