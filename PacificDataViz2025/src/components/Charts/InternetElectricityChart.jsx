import React, { useState, useEffect, useRef } from 'react';

const InternetElectricityChart = ({ 
  transparent = false,
  height = '100%'
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortedData, setSortedData] = useState([]);
  const [currentSort, setCurrentSort] = useState('internet');
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });
  const containerRef = useRef(null);

  // Custom color palette matching SeaLevelChart
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

  // Load and combine data from CSV files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let internetData = [];
        let electricityData = [];
        
        // Try to load internet CSV
        try {
            const internetResponse = await fetch('${process.env.PUBLIC_URL}/data/access_internet.csv');
            if (internetResponse.ok) {
                const csvText = await internetResponse.text();
                internetData = parseCSV(csvText);
            }
        } catch (err) {
            console.log('Could not load internet data:', err);
        }

        // Try to load electricity CSV
        try {
            const electricityResponse = await fetch('${process.env.PUBLIC_URL}/data/access_electricity.csv');
            if (electricityResponse.ok) {
                const csvText = await electricityResponse.text();
                electricityData = parseCSV(csvText);
            }
        } catch (err) {
            console.log('Could not load electricity data:', err);
        }

        // Combine the datasets if we have real data
        const combinedData = combineDatasets(internetData, electricityData);
        
        // If we have combined data, use it
        setData(combinedData);
        
      } catch (error) {
        setError(error);
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Parse CSV function - improved to handle multi-line quoted fields
  const parseCSV = (csvText) => {
    try {
      // First, let's handle the multi-line quoted fields by joining them
      const normalizedCsv = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Split into lines but be careful about quoted multi-line fields
      const allLines = normalizedCsv.split('\n');
      const processedLines = [];
      let currentLine = '';
      let inQuotes = false;
      
      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        currentLine += (currentLine ? ' ' : '') + line;
        
        // Count quotes in current combined line
        let quoteCount = 0;
        for (let j = 0; j < currentLine.length; j++) {
          if (currentLine[j] === '"') quoteCount++;
        }
        
        // If we have an even number of quotes, the line is complete
        if (quoteCount % 2 === 0) {
          if (currentLine.trim()) {
            processedLines.push(currentLine.trim());
          }
          currentLine = '';
        }
      }
      
      // Add any remaining line
      if (currentLine.trim()) {
        processedLines.push(currentLine.trim());
      }
      
      if (processedLines.length < 2) {
        return [];
      }
      
      // Get headers
      const headerLine = processedLines[0];
      
      // Split headers more carefully
      const headers = [];
      let currentHeader = '';
      let inQuotesHeader = false;
      
      for (let i = 0; i < headerLine.length; i++) {
        const char = headerLine[i];
        if (char === '"') {
          inQuotesHeader = !inQuotesHeader;
        } else if (char === ',' && !inQuotesHeader) {
          headers.push(currentHeader.trim().replace(/"/g, ''));
          currentHeader = '';
        } else {
          currentHeader += char;
        }
      }
      headers.push(currentHeader.trim().replace(/"/g, ''));
      
      const rows = [];
      
      // Parse each data line
      for (let lineIndex = 1; lineIndex < processedLines.length; lineIndex++) {
        const line = processedLines[lineIndex];
        const values = [];
        let currentValue = '';
        let inQuotesValue = false;
        
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"') {
            inQuotesValue = !inQuotesValue;
          } else if (char === ',' && !inQuotesValue) {
            values.push(currentValue.trim().replace(/"/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/"/g, ''));
        
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          rows.push(row);
        }
      }
      
      return rows;
    } catch (error) {
      console.error('CSV parsing error:', error);
      return [];
    }
  };

  const combineDatasets = (internetData, electricityData) => {
    const combinedData = [];
    
    // Process internet data
    const internetByCountry = {};
    internetData.forEach(row => {
      const country = processCountryName(row['Pacific Island Countries and territories']);
      const year = parseInt(row['TIME_PERIOD']);
      const value = parseFloat(row['OBS_VALUE']);
      
      if (country && !isNaN(year) && !isNaN(value)) {
        if (!internetByCountry[country] || year > internetByCountry[country].year) {
          internetByCountry[country] = {
            country,
            internet: value,
            internetYear: year
          };
        }
      }
    });

    // Process electricity data
    const electricityByCountry = {};
    electricityData.forEach(row => {
      const country = processCountryName(row['Pacific Island Countries and territories']);
      const year = parseInt(row['TIME_PERIOD']);
      const value = parseFloat(row['OBS_VALUE']);
      
      if (country && !isNaN(year) && !isNaN(value)) {
        if (!electricityByCountry[country] || year > electricityByCountry[country].year) {
          electricityByCountry[country] = {
            country,
            electricity: value,
            electricityYear: year
          };
        }
      }
    });

    // Combine data - include countries with either internet OR electricity data
    const allCountries = new Set([...Object.keys(internetByCountry), ...Object.keys(electricityByCountry)]);

    allCountries.forEach(country => {
      const internetInfo = internetByCountry[country];
      const electricityInfo = electricityByCountry[country];
      
      // Include if we have at least one type of data
      if (internetInfo || electricityInfo) {
        combinedData.push({
          country: country,
          internet: internetInfo ? internetInfo.internet : 0, // Default to 0 if no data
          electricity: electricityInfo ? electricityInfo.electricity : 0, // Default to 0 if no data
          internetYear: internetInfo ? internetInfo.internetYear : 'N/A',
          electricityYear: electricityInfo ? electricityInfo.electricityYear : 'N/A',
          hasInternetData: !!internetInfo,
          hasElectricityData: !!electricityInfo
        });
      }
    });

    // Calculate averages only for countries with data
    if (combinedData.length > 0) {
      const countriesWithInternet = combinedData.filter(item => item.hasInternetData);
      const countriesWithElectricity = combinedData.filter(item => item.hasElectricityData);
      
      const avgInternet = countriesWithInternet.length > 0 ? 
        countriesWithInternet.reduce((sum, item) => sum + item.internet, 0) / countriesWithInternet.length : 0;
      const avgElectricity = countriesWithElectricity.length > 0 ? 
        countriesWithElectricity.reduce((sum, item) => sum + item.electricity, 0) / countriesWithElectricity.length : 0;

      combinedData.push({
        country: "Pacific Islands Average",
        internet: Math.round(avgInternet * 10) / 10,
        electricity: Math.round(avgElectricity * 10) / 10,
        internetYear: "Multi-year",
        electricityYear: "Multi-year",
        isAverage: true,
        hasInternetData: true,
        hasElectricityData: true
      });
    }

    return combinedData;
  };

  const processCountryName = (name) => {
    return name ? name.replace('Micronesia (Federated States of)', 'Micronesia (FSM)') : name;
  };

  useEffect(() => {
    if (data.length > 0) {
      // Sort data by internet coverage initially
      handleSort('internet');
    }
  }, [data]);

  const handleSort = (criteria) => {
    setCurrentSort(criteria);
    let sorted = [...data];
    
    switch(criteria) {
      case 'internet':
        sorted.sort((a, b) => b.internet - a.internet);
        break;
      case 'electricity':
        sorted.sort((a, b) => b.electricity - a.electricity);
        break;
      case 'combined':
        sorted.sort((a, b) => (b.internet + b.electricity) - (a.internet + a.electricity));
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
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          background: getBackgroundStyle(),
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: colors.white,
          fontSize: '16px',
          fontWeight: '500'
        }}
      >
        <div style={{
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: `3px solid ${colors.white}`,
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p>Loading Pacific Islands connectivity data...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          background: getBackgroundStyle(),
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: colors.white,
          fontSize: '18px',
          fontWeight: '500',
          textAlign: 'center',
          padding: '20px'
        }}
      >
        <p>No data available. Please provide the required CSV files.</p>
      </div>
    );
  }

  // Calculate maximum values for scaling (excluding zeros for better scaling)
  const maxInternet = Math.max(...data.filter(d => d.hasInternetData).map(d => d.internet));
  const maxElectricity = Math.max(...data.filter(d => d.hasElectricityData).map(d => d.electricity));
  
  const isMobile = window.innerWidth < 768;
  const barMaxWidth = isMobile ? 100 : 200;

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        background: getBackgroundStyle(),
        borderRadius: '8px',
        display: 'flex',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: colors.white,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <style jsx>{`
        .main-container {
          display: flex;
          width: 100%;
          height: 100%;
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: rgba(26, 54, 93, 0.05);
          backdrop-filter: blur(10px);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          width: ${isMobile ? '150px' : '200px'};
          flex-shrink: 0;
        }

        .controls-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        

        .sort-button {
          padding: ${isMobile ? '8px 16px' : '12px 20px'};
          background: rgba(45, 108, 176, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 25px;
          color: ${colors.white};
          cursor: pointer;
          font-size: ${isMobile ? '12px' : '14px'};
          font-weight: 500;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          width: 100%;
          text-align: center;
        }

        .sort-button:hover {
          background: rgba(45, 108, 176, 0.5);
          transform: translateX(2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .sort-button.active {
          background: rgba(45, 108, 176, 0.8);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .chart-content {
          flex: 1;
          padding: ${isMobile ? '12px' : '16px'};
          overflow-y: auto;
          overflow-x: hidden;
        }

        .chart-row {
          display: flex;
          align-items: center;
          margin-bottom: ${isMobile ? '6px' : '8px'};
          height: ${isMobile ? '40px' : '50px'};
          gap: ${isMobile ? '8px' : '15px'};
        }

        .left-section {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          min-width: ${isMobile ? '100px' : '200px'};
        }

        .internet-bar {
          height: ${isMobile ? '36px' : '40px'};
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding-left: ${isMobile ? '10px' : '15px'};
          color: ${colors.white};
          font-size: ${isMobile ? '11px' : '13px'};
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: 20px;
        }

        .internet-bar:hover {
          transform: translateX(-5px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .internet-bar.average {
          background: linear-gradient(135deg, rgba(237, 131, 54, 0.9), rgba(246, 173, 85, 0.9));
          border-color: rgba(237, 131, 54, 0.8);
        }

        .internet-bar.high {
          background: linear-gradient(135deg, rgba(26, 54, 93, 0.9), rgba(16, 36, 62, 0.9));
        }

        .internet-bar.medium {
          background: linear-gradient(135deg, rgba(45, 108, 176, 0.9), rgba(26, 54, 93, 0.9));
        }

        .internet-bar.low {
          background: linear-gradient(135deg, rgba(49, 130, 206, 0.8), rgba(45, 108, 176, 0.8));
        }

        .internet-bar.no-data {
          background: linear-gradient(135deg, rgba(160, 174, 192, 0.6), rgba(113, 128, 150, 0.6));
          border-color: rgba(160, 174, 192, 0.8);
        }

        .country-label {
          min-width: ${isMobile ? '120px' : '180px'};
          width: ${isMobile ? '120px' : '180px'};
          text-align: center;
          font-size: ${isMobile ? '11px' : '13px'};
          font-weight: 600;
          padding: ${isMobile ? '8px 10px' : '10px 14px'};
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
          min-width: ${isMobile ? '100px' : '200px'};
        }

        .electricity-bar {
          height: ${isMobile ? '36px' : '40px'};
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding-left: ${isMobile ? '10px' : '15px'};
          color: ${colors.white};
          font-size: ${isMobile ? '11px' : '13px'};
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: ${isMobile ? '40px' : '60px'};
        }

        .electricity-bar:hover {
          transform: translateX(5px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .electricity-bar.average {
          background: linear-gradient(135deg, rgba(237, 131, 54, 0.9), rgba(246, 173, 85, 0.9));
          border-color: rgba(237, 131, 54, 0.8);
        }

        .electricity-bar.high {
          background: linear-gradient(135deg, rgba(15, 81, 50, 0.9), rgba(6, 95, 70, 0.9));
        }

        .electricity-bar.medium {
          background: linear-gradient(135deg, rgba(15, 118, 110, 0.9), rgba(20, 184, 166, 0.9));
        }

        .electricity-bar.low {
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.8), rgba(45, 212, 191, 0.8));
        }

        .electricity-bar.no-data {
          background: linear-gradient(135deg, rgba(160, 174, 192, 0.6), rgba(113, 128, 150, 0.6));
          border-color: rgba(160, 174, 192, 0.8);
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

        .tooltip-value.no-data {
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }

        .data-years {
          margin-top: 8px;
          padding: 6px 12px;
          background: rgba(45, 108, 176, 0.8);
          color: ${colors.white};
          border-radius: 15px;
          text-align: center;
          font-weight: 500;
          font-size: 12px;
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

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="main-container">
        {/* Controls */}
        <div className="controls">
          <div className="controls-buttons">
            <button 
              className={`sort-button ${currentSort === 'internet' ? 'active' : ''}`}
              onClick={() => handleSort('internet')}
            >
              4G Coverage
            </button>
            <button 
              className={`sort-button ${currentSort === 'electricity' ? 'active' : ''}`}
              onClick={() => handleSort('electricity')}
            >
              Electricity Access
            </button>
            <button 
              className={`sort-button ${currentSort === 'combined' ? 'active' : ''}`}
              onClick={() => handleSort('combined')}
            >
              Combined Score
            </button>
          </div>
          
          
        </div>

        {/* Chart Content */}
        <div className="chart-content">
          {sortedData.map((item, index) => {
            const internetWidth = item.hasInternetData ? Math.max(20, (item.internet / maxInternet) * barMaxWidth) : 20;
            const electricityWidth = item.hasElectricityData ? Math.max(isMobile ? 40 : 60, (item.electricity / maxElectricity) * barMaxWidth) : (isMobile ? 40 : 60);
            
            const getInternetClass = (internet, isAverage, hasData) => {
              if (!hasData) return 'no-data';
              if (isAverage) return 'average';
              if (internet >= 75) return 'high';
              if (internet >= 50) return 'medium';
              return 'low';
            };

            const getElectricityClass = (electricity, isAverage, hasData) => {
              if (!hasData) return 'no-data';
              if (isAverage) return 'average';
              if (electricity >= 90) return 'high';
              if (electricity >= 70) return 'medium';
              return 'low';
            };
            
            return (
              <div key={index} className="chart-row">
                {/* Left side - Internet coverage */}
                <div className="left-section">
                  <div 
                    className={`internet-bar ${getInternetClass(item.internet, item.isAverage, item.hasInternetData)}`}
                    style={{ width: `${internetWidth}px` }}
                    onMouseEnter={(e) => handleHover(item, e)}
                    onMouseLeave={handleLeave}
                  >
                    {item.hasInternetData ? `${item.internet.toFixed(1)}%${isMobile ? '' : ' 4G'}` : 'No data'}
                  </div>
                </div>
                
                {/* Center - Country name */}
                <div className={`country-label ${item.isAverage ? 'average' : ''}`}>
                  {item.country}
                </div>
                
                {/* Right side - Electricity access */}
                <div className="right-section">
                  <div 
                    className={`electricity-bar ${getElectricityClass(item.electricity, item.isAverage, item.hasElectricityData)}`}
                    style={{ width: `${electricityWidth}px` }}
                    onMouseEnter={(e) => handleHover(item, e)}
                    onMouseLeave={handleLeave}
                  >
                    {item.hasElectricityData ? `${item.electricity.toFixed(1)}%${isMobile ? '' : ' Power'}` : 'No data'}
                  </div>
                </div>
              </div>
            );
          })}
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
            <span className="tooltip-label">4G Mobile Coverage:</span>
            <span className={`tooltip-value ${!tooltip.data.hasInternetData ? 'no-data' : ''}`}>
              {tooltip.data.hasInternetData ? `${tooltip.data.internet.toFixed(1)}%` : 'No data available'}
            </span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Electricity Access:</span>
            <span className={`tooltip-value ${!tooltip.data.hasElectricityData ? 'no-data' : ''}`}>
              {tooltip.data.hasElectricityData ? `${tooltip.data.electricity.toFixed(1)}%` : 'No data available'}
            </span>
          </div>
          <div className="data-years">
            {tooltip.data.isAverage ? 
              'Regional average across multiple years' : 
              `Mobile: ${tooltip.data.internetYear} | Power: ${tooltip.data.electricityYear}`
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default InternetElectricityChart;