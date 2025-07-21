import React, { useState, useEffect } from 'react';

const SeaLevelChart = ({ 
  seaLevelDataFile = '/data/sea_lvl_rise_rates_data.json', 
  populationDataFile = '/data/elevation_coast_population.json',
  transparent = false
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortedData, setSortedData] = useState([]);
  const [currentSort, setCurrentSort] = useState('vulnerability');
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });

  // Custom color palette
  const colors = {
    primaryDeepBlue: '#1a365d',
    primaryOcean: '#2b6cb0',
    primaryLight: '#3182ce',
    accentCoral: '#ed8936',
    accentWarm: '#f6ad55',
    accentLight: '#fbd38d',
    accentGreen: '#38a169',
    accentTeal: '#319795',
    dangerRed: '#c53030',
    warningOrange: '#dd6b20',
    neutral900: '#1a202c',
    neutral800: '#2d3748',
    neutral700: '#4a5568',
    neutral600: '#718096',
    neutral500: '#a0aec0',
    neutral400: '#cbd5e0',
    neutral300: '#e2e8f0',
    neutral200: '#edf2f7',
    neutral100: '#f7fafc',
    neutral50: '#fafbfc',
    white: '#ffffff',
    glassBg: 'rgba(255, 255, 255, 0.1)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',
    glassShadow: 'rgba(0, 0, 0, 0.1)'
  };

  // Load and combine data from two JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let seaLevelData = [];
        let populationData = [];
        
        // Try to load sea level rise data
        try {
            const seaLevelResponse = await fetch('/data/sea_lvl_rise_rates_data.json');
            if (seaLevelResponse.ok) {
                seaLevelData = await seaLevelResponse.json();
                console.log('Successfully loaded sea level data');
            }
        } catch (err) {
            console.log('Could not load sea level data');
        }

        // Try to load population data
        try {
            const populationResponse = await fetch('/data/elevation_coast_population.json');
            if (populationResponse.ok) {
                const popData = await populationResponse.json();
                populationData = popData.country_data || [];
                console.log('Successfully loaded population data');
            }
        } catch (err) {
            console.log('Could not load population data');
        }

        // Combine the datasets if we have real data
        const combinedData = combineDatasets(seaLevelData, populationData);
        
        // Calculate vulnerability scores
        combinedData.forEach(item => {
          item.vulnerabilityScore = calculateVulnerabilityScore(item);
        });

        setData(combinedData);
      } catch (error) {
        setError(error);
        console.error('Error loading data:', error);
        
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [seaLevelDataFile, populationDataFile]);

  const combineDatasets = (seaLevelData, populationData) => {
    const combinedData = [];
    
    // Create a map of population data by country name
    const popMap = new Map();
    populationData.forEach(country => {
      const normalizedName = normalizeCountryName(country.country_name);
      popMap.set(normalizedName, country);
    });

    // Process sea level data and match with population data
    seaLevelData.forEach(seaItem => {
      const normalizedSeaName = normalizeCountryName(seaItem.island);
      const popItem = popMap.get(normalizedSeaName);
      
      if (popItem) {
        // Calculate coastal population (0-20m only)
        const coastalPopulation = popItem.zone_0_5m + popItem.zone_5_10m + popItem.zone_10_20m;
        
        combinedData.push({
          country: seaItem.island,
          seaLevelRise: seaItem.rate,
          coastalPopulation: coastalPopulation,
          zone_0_5m: popItem.zone_0_5m,
          zone_5_10m: popItem.zone_5_10m,
          zone_10_20m: popItem.zone_10_20m,
          isAverage: seaItem.is_average || false,
          confidenceInterval: seaItem.confidence_interval || 0,
          startYear: seaItem.start_year,
          endYear: seaItem.end_year
        });
      }
    });

    return combinedData;
  };

  const normalizeCountryName = (name) => {
    return name.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/micronesia \(federated states of\)/i, 'micronesia (federated states of)')
      .replace(/federated states of micronesia/i, 'micronesia (federated states of)')
      .replace(/marshall islands/i, 'marshall islands')
      .replace(/solomon islands/i, 'solomon islands')
      .replace(/cook islands/i, 'cook islands')
      .replace(/papua new guinea/i, 'papua new guinea')
      .replace(/regional average/i, 'regional average')
      .trim();
  };

  const calculateVulnerabilityScore = (item) => {
    return (item.seaLevelRise * item.coastalPopulation) / 10;
  };

  const getSeaLevelClass = (seaLevel, isAverage) => {
    if (isAverage) return 'average';
    if (seaLevel >= 7) return 'high';
    if (seaLevel >= 5) return 'medium';
    return 'low';
  };

  useEffect(() => {
    if (data.length > 0) {
      // Sort data by vulnerability score initially
      handleSort('vulnerability');
    }
  }, [data]);

  const handleSort = (criteria) => {
    setCurrentSort(criteria);
    let sorted = [...data];
    
    switch(criteria) {
      case 'vulnerability':
        sorted.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
        break;
      case 'seaLevel':
        sorted.sort((a, b) => b.seaLevelRise - a.seaLevelRise);
        break;
      case 'population':
        sorted.sort((a, b) => b.coastalPopulation - a.coastalPopulation);
        break;
      default:
        break;
    }
    
    setSortedData(sorted);
  };

  const handleHover = (item, e) => {
    setTooltip({
      visible: true,
      data: item,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleLeave = () => {
    setTooltip({ visible: false, data: null, position: { x: 0, y: 0 } });
  };

  // Get background style based on transparent prop
  const getBackgroundStyle = () => {
    if (transparent) {
      return 'transparent';
    }
    return `linear-gradient(135deg, ${colors.primaryDeepBlue} 0%, ${colors.primaryOcean} 50%, ${colors.primaryLight} 100%)`;
  };

  if (loading) {
    return (
      <div className="sea-level-chart">
        <style jsx>{`
          .sea-level-chart {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${getBackgroundStyle()};
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: ${colors.white};
            font-size: 16px;
            font-weight: 500;
            min-height: 100vh;
          }
          
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid ${colors.white};
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
        <p>Loading Pacific Islands climate data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="sea-level-chart">
        <style jsx>{`
          .sea-level-chart {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${getBackgroundStyle()};
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: ${colors.white};
            font-size: 18px;
            font-weight: 500;
            text-align: center;
            padding: 20px;
            min-height: 100vh;
          }
        `}</style>
        <p>No data available. Please provide the required JSON files.</p>
      </div>
    );
  }

  // Calculate maximum values for scaling
  const maxSeaLevel = Math.max(...data.map(d => d.seaLevelRise));
  const maxPopulation = Math.max(...data.map(d => d.coastalPopulation));

  return (
    <div className="sea-level-chart">
      <style jsx>{`
        .sea-level-chart {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: ${getBackgroundStyle()};
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: ${colors.white};
          overflow: hidden;
          min-height: 100vh;
        }

        .controls {
          display: flex;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          background: rgba(26, 54, 93, 0.05);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .sort-button {
          padding: 10px 20px;
          background: rgba(45, 108, 176, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 25px;
          color: ${colors.white};
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .sort-button:hover {
          background: rgba(45, 108, 176, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .sort-button.active {
          background: rgba(45, 108, 176, 0.8);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .chart-content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
        }

        .chart-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          height: 50px;
          gap: 15px;
        }

        .left-section {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        .population-stack {
          height: 40px;
          border-radius: 8px;
          display: flex;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: 20px;
        }

        .population-stack:hover {
          transform: translateX(-5px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .population-segment {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${colors.white};
          font-weight: 600;
          font-size: 11px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          transition: all 0.3s ease;
          min-width: 20px;
        }

        .zone-0-5m {
          background: linear-gradient(135deg, ${colors.dangerRed}, #b91c1c);
        }

        .zone-5-10m {
          background: linear-gradient(135deg, ${colors.accentCoral}, ${colors.warningOrange});
        }

        .zone-10-20m {
          background: linear-gradient(135deg, ${colors.accentWarm}, ${colors.accentLight});
        }

        .country-label {
          min-width: 180px;
          width: 180px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: ${colors.white};
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .country-label.average {
          background: rgba(237, 131, 54, 0.9);
          border-color: rgba(237, 131, 54, 0.8);
          font-weight: 700;
        }

        .right-section {
          flex: 1;
          display: flex;
          justify-content: flex-start;
          align-items: center;
        }

        .sealevel-bar {
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding-left: 15px;
          color: ${colors.white};
          font-size: 13px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: 60px;
        }

        .sealevel-bar:hover {
          transform: translateX(5px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .sealevel-bar.average {
          background: linear-gradient(135deg, rgba(237, 131, 54, 0.9), rgba(246, 173, 85, 0.9));
          border-color: rgba(237, 131, 54, 0.8);
        }

        .sealevel-bar.low {
          background: linear-gradient(135deg, rgba(49, 130, 206, 0.8), rgba(45, 108, 176, 0.8));
        }

        .sealevel-bar.medium {
          background: linear-gradient(135deg, rgba(45, 108, 176, 0.9), rgba(26, 54, 93, 0.9));
        }

        .sealevel-bar.high {
          background: linear-gradient(135deg, rgba(26, 54, 93, 0.9), rgba(16, 36, 62, 0.9));
        }

        .tooltip {
          position: fixed;
          background: rgba(26, 54, 93, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 16px;
          color: ${colors.white};
          font-size: 14px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(15px);
          pointer-events: none;
          z-index: 1000;
          max-width: 300px;
        }

        .tooltip-title {
          font-weight: 700;
          margin-bottom: 12px;
          font-size: 16px;
        }

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
        }

        .tooltip-label {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
        }

        .tooltip-value {
          font-weight: 600;
        }

        .vulnerability-score {
          margin-top: 8px;
          padding: 6px 12px;
          background: rgba(237, 131, 54, 0.8);
          color: ${colors.white};
          border-radius: 15px;
          text-align: center;
          font-weight: 700;
        }

        /* Scrollbar */
        .chart-content::-webkit-scrollbar {
          width: 8px;
        }

        .chart-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .chart-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }

        .chart-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 1200px) {
          .country-label {
            min-width: 150px;
            width: 150px;
            font-size: 12px;
          }
        }

        @media (max-width: 768px) {
          .controls {
            gap: 8px;
            padding: 12px;
          }
          
          .sort-button {
            padding: 6px 12px;
            font-size: 12px;
          }
          
          .country-label {
            min-width: 120px;
            width: 120px;
            font-size: 11px;
          }
          
          .chart-row {
            height: 45px;
            gap: 8px;
          }
          
          .population-stack,
          .sealevel-bar {
            height: 36px;
          }
        }
      `}</style>

      {/* Controls */}
      <div className="controls">
        <button 
          className={`sort-button ${currentSort === 'vulnerability' ? 'active' : ''}`}
          onClick={() => handleSort('vulnerability')}
        >
          Vulnerability Score 
        </button>
        <button 
          className={`sort-button ${currentSort === 'seaLevel' ? 'active' : ''}`}
          onClick={() => handleSort('seaLevel')}
        >
          Sea Level Rise
        </button>
        <button 
          className={`sort-button ${currentSort === 'population' ? 'active' : ''}`}
          onClick={() => handleSort('population')}
        >
          Coastal Population
        </button>
      </div>

      {/* Chart Content */}
      <div className="chart-content">
        {sortedData.map((item, index) => {
          const totalPopulation = item.coastalPopulation;
          const populationWidth = Math.max(20, (totalPopulation / maxPopulation) * 200);
          const seaLevelWidth = Math.max(60, (item.seaLevelRise / maxSeaLevel) * 200);
          
          return (
            <div key={index} className="chart-row">
              {/* Left side - Stacked population zones */}
              <div className="left-section">
                <div 
                  className="population-stack"
                  style={{ width: `${populationWidth}px` }}
                  onMouseEnter={(e) => handleHover(item, e)}
                  onMouseLeave={handleLeave}
                >
                  {item.zone_0_5m > 0 && (
                    <div 
                      className="population-segment zone-0-5m"
                      style={{ width: `${(item.zone_0_5m / totalPopulation) * populationWidth}px` }}
                    >
                      {(item.zone_0_5m / totalPopulation) * populationWidth > 35 ? `${item.zone_0_5m}%` : ''}
                    </div>
                  )}
                  {item.zone_5_10m > 0 && (
                    <div 
                      className="population-segment zone-5-10m"
                      style={{ width: `${(item.zone_5_10m / totalPopulation) * populationWidth}px` }}
                    >
                      {(item.zone_5_10m / totalPopulation) * populationWidth > 35 ? `${item.zone_5_10m}%` : ''}
                    </div>
                  )}
                  {item.zone_10_20m > 0 && (
                    <div 
                      className="population-segment zone-10-20m"
                      style={{ width: `${(item.zone_10_20m / totalPopulation) * populationWidth}px` }}
                    >
                      {(item.zone_10_20m / totalPopulation) * populationWidth > 35 ? `${item.zone_10_20m}%` : ''}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Center - Country name */}
              <div className={`country-label ${item.isAverage ? 'average' : ''}`}>
                {item.country}
              </div>
              
              {/* Right side - Sea level rise */}
              <div className="right-section">
                <div 
                  className={`sealevel-bar ${getSeaLevelClass(item.seaLevelRise, item.isAverage)}`}
                  style={{ width: `${seaLevelWidth}px` }}
                  onMouseEnter={(e) => handleHover(item, e)}
                  onMouseLeave={handleLeave}
                >
                  {item.seaLevelRise} mm/year
                </div>
              </div>
            </div>
          );
        })}
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
            <span className="tooltip-label">Sea Level Rise:</span>
            <span className="tooltip-value">{tooltip.data.seaLevelRise} mm/year</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Coastal Population:</span>
            <span className="tooltip-value">{tooltip.data.coastalPopulation}%</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">High Risk (0-5m):</span>
            <span className="tooltip-value">{tooltip.data.zone_0_5m}%</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Medium Risk (5-10m):</span>
            <span className="tooltip-value">{tooltip.data.zone_5_10m}%</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Low Risk (10-20m):</span>
            <span className="tooltip-value">{tooltip.data.zone_10_20m}%</span>
          </div>
          <div className="vulnerability-score">
            Vulnerability Score: {tooltip.data.vulnerabilityScore.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
};

export default SeaLevelChart;