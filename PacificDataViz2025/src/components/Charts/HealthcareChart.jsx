import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const HealthcareChart = ({ transparent = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indicatorData, setIndicatorData] = useState({});
  const [womensHealthData, setWomensHealthData] = useState({});
  const [activeChart, setActiveChart] = useState('BPI_MANAGL2');
  const [activeDataSource, setActiveDataSource] = useState('general'); // 'general' or 'womens'
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [availableWomensIndicators, setAvailableWomensIndicators] = useState([]);
  
  const svgRef = useRef(null);

  // Define the color palette
  const colors = useMemo(() => ({
    primaryDeepBlue: '#1a365d',
    primaryOcean: '#2b6cb0',
    primaryLight: '#3182ce',
    accentCoral: '#ed8936',
    accentWarm: '#f6ad55',
    accentLight: '#fbd38d',
    accentGreen: '#38a169',
    accentTeal: '#319795',
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
  }), []);

  // Indicator configurations for general healthcare
  const indicatorConfig = useMemo(() => ({
    'BPI_MANAGL2': {
      name: 'NCD Guidelines',
      description: 'National guidelines for care of main NCDs',
      unit: 'units',
      shortUnit: 'units'
    },
    'SPC_3_8_1': {
      name: 'Health Services',
      description: 'Coverage of essential health services',
      unit: 'index',
      shortUnit: 'index'
    },
    'SH_MED_DEN': {
      name: 'Health worker density',
      description: 'Medical professional density',
      unit: 'per 1000 population',
      shortUnit: '/1000 pop'
    },
    'SH_STA_BRTC': {
      name: 'Birth Attendance',
      description: 'Births attended by skilled health personnel',
      unit: 'percentage',
      shortUnit: '%'
    },
    'SH_STA_MORT': {
      name: 'Mortality Rate',
      description: 'Statistical mortality indicators',
      unit: 'rate',
      shortUnit: 'rate'
    }
  }), []);

  // Women's health indicator configurations
  const womensHealthConfig = useMemo(() => ({
    'SH_STA_BRTC': {
      name: 'Birth Attendance',
      description: 'Births attended by skilled health personnel',
      unit: 'percentage',
      shortUnit: '%'
    },
    'SH_STA_MORT': {
      name: 'Maternal Mortality',
      description: 'Maternal mortality ratio',
      unit: 'per 100,000 live births',
      shortUnit: '/100k births'
    }
  }), []);

  

  

  const loadAndProcessData = useCallback(async () => {
    try {
      console.log('Loading healthcare CSV files...');
      
      const healthcareDataFile = '/data/health_care_data.csv';
      const womensHealthDataFile = '/data/womens_health.csv';
      
      // Use Promise.all to load both files simultaneously
      const [healthcareResponse, womensHealthResponse] = await Promise.all([
        fetch(healthcareDataFile).catch(() => null),
        fetch(womensHealthDataFile).catch(() => null)
      ]);
      
      let generalCsvContent = '';
      let womensCsvContent = '';
      
      // Process healthcare data response
      if (healthcareResponse && healthcareResponse.ok) {
        generalCsvContent = await healthcareResponse.text();
        console.log('Successfully loaded general healthcare data via fetch');
      } else {
        console.log('Could not load general healthcare CSV file');
      }
      
      // Process women's health data response
      if (womensHealthResponse && womensHealthResponse.ok) {
        womensCsvContent = await womensHealthResponse.text();
        console.log('Successfully loaded women\'s health data via fetch');
      } else {
        console.log('Could not load women\'s health CSV file');
      }
      
      // Process both datasets in parallel using Promise.all
      const [generalParsed, womensParsed] = await Promise.all([
        new Promise(resolve => {
          const parsed = Papa.parse(generalCsvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          });
          resolve(parsed);
        }),
        new Promise(resolve => {
          const parsed = Papa.parse(womensCsvContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          });
          resolve(parsed);
        })
      ]);
      
      // Filter and process general healthcare data
      const targetIndicators = ['BPI_MANAGL2', 'SPC_3_8_1', 'SH_MED_DEN', 'SH_STA_BRTC', 'SH_STA_MORT'];
      const validGeneralData = generalParsed.data.filter(row => {
        return row.OBS_VALUE !== null && 
               row.OBS_VALUE !== undefined && 
               row.OBS_VALUE !== '' && 
               !isNaN(row.OBS_VALUE) &&
               row['Pacific Island Countries and territories'] !== null &&
               targetIndicators.includes(row.INDICATOR);
      });
      
      // Filter and process women's health data
      const validWomensData = womensParsed.data.filter(row => {
        return row.OBS_VALUE !== null && 
               row.OBS_VALUE !== undefined && 
               row.OBS_VALUE !== '' && 
               !isNaN(row.OBS_VALUE) &&
               row['Pacific Island Countries and territories'] !== null;
      });
      
      // Process both datasets in parallel
      const [generalGroupedData, womensGroupedData] = await Promise.all([
        new Promise(resolve => {
          const groupedData = {};
          const foundIndicators = [];
          
          targetIndicators.forEach(indicator => {
            const indicatorRows = validGeneralData.filter(row => row.INDICATOR === indicator);
            if (indicatorRows.length > 0) {
              foundIndicators.push(indicator);
              groupedData[indicator] = processDataForComparison(indicatorRows);
            }
          });
          
          resolve({ groupedData, foundIndicators });
        }),
        new Promise(resolve => {
          const groupedData = {};
          const foundIndicators = [];
          
          // Get all unique indicators from women's health data
          const allWomensIndicators = [...new Set(validWomensData.map(row => row.INDICATOR).filter(Boolean))];
          
          allWomensIndicators.forEach(indicator => {
            const indicatorRows = validWomensData.filter(row => row.INDICATOR === indicator);
            if (indicatorRows.length >= 10) { // Require at least 10 data points
              foundIndicators.push(indicator);
              groupedData[indicator] = processDataForComparison(indicatorRows);
            }
          });
          
          resolve({ groupedData, foundIndicators });
        })
      ]);
      
      setAvailableIndicators(generalGroupedData.foundIndicators);
      setAvailableWomensIndicators(womensGroupedData.foundIndicators);
      setIndicatorData(generalGroupedData.groupedData);
      setWomensHealthData(womensGroupedData.groupedData);
      
      // Set default active chart
      if (generalGroupedData.foundIndicators.length > 0) {
        setActiveChart(generalGroupedData.foundIndicators[0]);
        setActiveDataSource('general');
      } else if (womensGroupedData.foundIndicators.length > 0) {
        setActiveChart(womensGroupedData.foundIndicators[0]);
        setActiveDataSource('womens');
      }
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading and processing data:', error);
      setError('Error loading data: ' + error.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAndProcessData();
  }, [loadAndProcessData]);

  const processDataForComparison = (data) => {
    const countryData = {};
    
    data.forEach(row => {
      const geoCode = row.GEO_PICT || row['Pacific Island Countries and territories'].substring(0, 3).toUpperCase();
      const countryName = row['Pacific Island Countries and territories'];
      const year = row.TIME_PERIOD;
      const value = row.OBS_VALUE;
      
      if (!countryData[geoCode]) {
        countryData[geoCode] = {
          name: countryName,
          geoCode: geoCode,
          data: []
        };
      }
      
      countryData[geoCode].data.push({
        year: year,
        value: value
      });
    });
    
    const comparisonData = {};
    Object.keys(countryData).forEach(geoCode => {
      const country = countryData[geoCode];
      const sortedData = country.data.sort((a, b) => a.year - b.year);
      
      if (sortedData.length >= 2) {
        const firstYear = sortedData[0];
        const lastYear = sortedData[sortedData.length - 1];
        
        comparisonData[geoCode] = {
          name: country.name,
          geoCode: geoCode,
          firstYear: firstYear,
          lastYear: lastYear,
          change: lastYear.value - firstYear.value,
          percentChange: ((lastYear.value - firstYear.value) / firstYear.value) * 100
        };
      }
    });
    
    return comparisonData;
  };

  const createClevelandPlot = useCallback((data, indicatorType) => {
    const svgElement = svgRef.current;
    d3.select(svgElement).selectAll("*").remove();

    const margin = { top: 20, right: 40, bottom: 50, left: 200 };
    
    // Make width responsive to container
    const containerWidth = svgElement.parentElement ? svgElement.parentElement.offsetWidth : 500;
    const width = containerWidth - margin.left - margin.right-100;
    const height = 520 - margin.top - margin.bottom;

    const svg = d3.select(svgElement)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const countries = Object.values(data).sort((a, b) => b.change - a.change);
    
    if (countries.length === 0) return;

    const config = (activeDataSource === 'general' ? indicatorConfig : womensHealthConfig)[indicatorType] || { shortUnit: 'units' };

    // Scales
    const allValues = countries.flatMap(d => [d.firstYear.value, d.lastYear.value]);
    const xScale = d3.scaleLinear()
      .domain(d3.extent(allValues))
      .nice()
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(countries.map(d => d.name))
      .range([0, height])
      .padding(0.25);

    // Background grid lines
    g.selectAll(".grid-line")
      .data(xScale.ticks(6))
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", colors.neutral300)
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.4);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text")
      .style("fill", colors.neutral600)
      .style("font-size", "12px")
      .style("font-family", "'Inter', sans-serif");

    g.selectAll(".domain")
      .style("stroke", colors.neutral400);

    g.selectAll(".tick line")
      .style("stroke", colors.neutral400);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", colors.neutral700)
      .style("font-size", "11px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif");

    // Lines connecting the dots
    g.selectAll(".connecting-line")
      .data(countries)
      .enter()
      .append("line")
      .attr("class", "connecting-line")
      .attr("x1", d => xScale(d.firstYear.value))
      .attr("x2", d => xScale(d.lastYear.value))
      .attr("y1", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("y2", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("stroke", d => d.change >= 0 ? colors.accentGreen : colors.accentCoral)
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.7)
      .style("opacity", 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 60)
      .style("opacity", 0.7);

    // First year circles (baseline)
    g.selectAll(".circle-first")
      .data(countries)
      .enter()
      .append("circle")
      .attr("class", "circle-first")
      .attr("cx", d => xScale(d.firstYear.value))
      .attr("cy", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("r", 0)
      .style("fill", colors.neutral500)
      .style("stroke", colors.neutral600)
      .style("stroke-width", 2)
      .transition()
      .duration(600)
      .delay((d, i) => i * 60 + 300)
      .attr("r", 5);

    // Last year circles (current)
    g.selectAll(".circle-last")
      .data(countries)
      .enter()
      .append("circle")
      .attr("class", "circle-last")
      .attr("cx", d => xScale(d.lastYear.value))
      .attr("cy", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("r", 0)
      .style("fill", d => d.change >= 0 ? colors.primaryOcean : colors.accentCoral)
      .style("stroke", d => d.change >= 0 ? colors.primaryDeepBlue : colors.accentCoral)
      .style("stroke-width", 2.5)
      .transition()
      .duration(600)
      .delay((d, i) => i * 60 + 500)
      .attr("r", 7);

    // Tooltips
    const tooltip = d3.select("body").append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`)
      .style("border", `1px solid ${colors.neutral300}`)
      .style("border-radius", "12px")
      .style("padding", "12px 16px")
      .style("font-size", "13px")
      .style("font-family", "'Inter', sans-serif")
      .style("box-shadow", `0 10px 25px ${colors.glassShadow}`)
      .style("backdrop-filter", "blur(10px)")
      .style("z-index", "1000")
      .style("max-width", "250px");

    g.selectAll(".circle-first, .circle-last")
      .on("mouseover", function(event, d) {
        const isFirst = d3.select(this).classed("circle-first");
        const value = isFirst ? d.firstYear.value : d.lastYear.value;
        const year = isFirst ? d.firstYear.year : d.lastYear.year;
        const changeColor = d.change >= 0 ? colors.accentGreen : colors.accentCoral;
        
        tooltip.style("visibility", "visible")
          .html(`
            <div style="color: ${colors.neutral800}; font-weight: 600; margin-bottom: 8px; font-size: 14px;">${d.name}</div>
            <div style="color: ${colors.neutral700}; margin-bottom: 4px;">${year}: <strong style="color: ${colors.primaryOcean};">${value.toFixed(2)} ${config.shortUnit}</strong></div>
            <div style="color: ${colors.neutral600}; font-size: 12px; border-top: 1px solid ${colors.neutral200}; padding-top: 6px; margin-top: 6px;">
              <div>Change: <span style="color: ${changeColor}; font-weight: 600;">${d.change > 0 ? '+' : ''}${d.change.toFixed(2)} ${config.shortUnit}</span></div>
              <div>Growth: <span style="color: ${changeColor}; font-weight: 600;">${d.percentChange > 0 ? '+' : ''}${d.percentChange.toFixed(1)}%</span></div>
            </div>
          `);
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isFirst ? 7 : 9)
          .style("filter", "drop-shadow(0 4px 8px rgba(0,0,0,0.2))");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 15) + "px");
      })
      .on("mouseout", function(event, d) {
        tooltip.style("visibility", "hidden");
        
        const isFirst = d3.select(this).classed("circle-first");
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isFirst ? 5 : 7)
          .style("filter", "none");
      });

    // X-axis label
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 40})`)
      .style("text-anchor", "middle")
      .style("fill", colors.neutral600)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(`${config.description} (${config.unit})`);
  }, [colors, activeDataSource, indicatorConfig, womensHealthConfig]);

  useEffect(() => {
    if (!loading && !error) {
      const currentData = activeDataSource === 'general' ? indicatorData : womensHealthData;
      const currentIndicators = activeDataSource === 'general' ? availableIndicators : availableWomensIndicators;
      
      if (currentIndicators.length > 0 && currentData[activeChart] && Object.keys(currentData[activeChart]).length > 0) {
        createClevelandPlot(currentData[activeChart], activeChart);
      }
    }
  }, [activeChart, activeDataSource, indicatorData, womensHealthData, availableIndicators, availableWomensIndicators, loading, error, createClevelandPlot]);

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
        <p>Loading healthcare data...</p>
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
        <p>{error}</p>
      </div>
    );
  }

  if (availableIndicators.length === 0 && availableWomensIndicators.length === 0) {
    return (
      <div 
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
        <p>No healthcare indicator data available for the selected category</p>
      </div>
    );
  }

  const currentIndicators = activeDataSource === 'general' ? availableIndicators : availableWomensIndicators;
  const currentConfig = (activeDataSource === 'general' ? indicatorConfig : womensHealthConfig);

  // Handle data source switching
  const handleDataSourceChange = (newSource) => {
    setActiveDataSource(newSource);
    const targetIndicators = newSource === 'general' ? availableIndicators : availableWomensIndicators;
    if (targetIndicators.length > 0) {
      setActiveChart(targetIndicators[0]);
    }
  };

  const isMobile = window.innerWidth < 768;

  return (
    <div 
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
          width: ${isMobile ? '160px' : '200px'};
          flex-shrink: 0;
        }

        .controls-section {
          margin-bottom: 16px;
        }

        .controls-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-title {
          font-size: ${isMobile ? '11px' : '12px'};
          font-weight: 600;
          margin-bottom: 8px;
          color: rgba(255, 255, 255, 0.9);
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .data-source-button {
          padding: ${isMobile ? '6px 12px' : '8px 14px'};
          background: rgba(45, 108, 176, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          color: ${colors.white};
          cursor: pointer;
          font-size: ${isMobile ? '10px' : '12px'};
          font-weight: 500;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          width: 100%;
          text-align: center;
        }

        .data-source-button:hover {
          background: rgba(45, 108, 176, 0.5);
          transform: translateX(2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .data-source-button.active {
          background: rgba(45, 108, 176, 0.8);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .sort-button {
          padding: ${isMobile ? '6px 10px' : '8px 12px'};
          background: rgba(45, 108, 176, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          color: ${colors.white};
          cursor: pointer;
          font-size: ${isMobile ? '9px' : '11px'};
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

        .legend {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .legend-title {
          font-size: ${isMobile ? '12px' : '14px'};
          font-weight: 600;
          margin-bottom: 12px;
          color: ${colors.white};
          text-align: center;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          flex-shrink: 0;
        }

        .legend-label {
          font-size: ${isMobile ? '10px' : '11px'};
          color: rgba(255, 255, 255, 0.8);
        }

        .stats-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stats-title {
          font-size: ${isMobile ? '11px' : '12px'};
          font-weight: 600;
          margin-bottom: 8px;
          color: rgba(255, 255, 255, 0.9);
          text-align: center;
        }

        .stats-item {
          font-size: ${isMobile ? '10px' : '11px'};
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 4px;
          text-align: center;
        }

        .chart-content {
          flex: 1;
          padding: ${isMobile ? '12px' : '16px'};
          overflow-y: auto;
          overflow-x: hidden;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="main-container">
        {/* Controls */}
        <div className="controls">
          {/* Data Source Selection */}
          <div className="controls-section">
            <div className="section-title">Data Source</div>
            <div className="controls-buttons">
              <button 
                className={`data-source-button ${activeDataSource === 'general' ? 'active' : ''}`}
                onClick={() => handleDataSourceChange('general')}
              >
                General ({availableIndicators.length})
              </button>
              <button 
                className={`data-source-button ${activeDataSource === 'womens' ? 'active' : ''}`}
                onClick={() => handleDataSourceChange('womens')}
              >
                Women's Health ({availableWomensIndicators.length})
              </button>
            </div>
          </div>

          {/* Indicator Selection */}
          <div className="controls-section">
            <div className="section-title">Indicators</div>
            <div className="controls-buttons">
              {currentIndicators.map(indicator => {
                const config = currentConfig[indicator];
                return (
                  <button
                    key={indicator}
                    className={`sort-button ${activeChart === indicator ? 'active' : ''}`}
                    onClick={() => setActiveChart(indicator)}
                  >
                    {config?.name || indicator}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Legend */}
          <div className="legend">
            <div className="legend-title">Legend</div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: colors.neutral500, border: `2px solid ${colors.neutral600}` }}></div>
              <span className="legend-label">Baseline Year</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: colors.primaryOcean, border: `2px solid ${colors.primaryDeepBlue}` }}></div>
              <span className="legend-label">Improvement</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: colors.accentCoral, border: `2px solid ${colors.accentCoral}` }}></div>
              <span className="legend-label">Decline</span>
            </div>
          </div>
        </div>

        {/* Chart Content */}
        <div className="chart-content">
          <svg ref={svgRef}></svg>
        </div>
      </div>
    </div>
  );
};

export default HealthcareChart;