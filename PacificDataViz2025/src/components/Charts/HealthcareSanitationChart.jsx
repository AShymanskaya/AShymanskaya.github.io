import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const HealthcareSanitationChart = ({ transparent = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waterAccessData, setWaterAccessData] = useState({});
  const [sanitationData, setSanitationData] = useState({});
  const [healthServicesData, setHealthServicesData] = useState({});
  const [activeChart, setActiveChart] = useState('water');
  
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

  const loadAndProcessData = useCallback(async () => {
    try {
      console.log('Loading data files...');
      
      // Load both infrastructure and water_sanitation data
      const infrastructureDataFile = '${process.env.PUBLIC_URL}/data/health_care_data.csv';
      const waterSanitationDataFile = '${process.env.PUBLIC_URL}/data/water_sanitation.csv';
      
      const [infrastructureResponse, waterSanitationResponse] = await Promise.all([
        fetch(infrastructureDataFile),
        fetch(waterSanitationDataFile)
      ]);
      
      if (!infrastructureResponse.ok) {
        throw new Error('Could not load infrastructure data');
      }
      
      if (!waterSanitationResponse.ok) {
        throw new Error('Could not load water sanitation data');
      }

      const [infrastructureCsv, waterSanitationCsv] = await Promise.all([
        infrastructureResponse.text(),
        waterSanitationResponse.text()
      ]);
      
      console.log('Successfully loaded both data files');
      
      // Parse both CSV files
      const infrastructureParsed = Papa.parse(infrastructureCsv, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });
      
      const waterSanitationParsed = Papa.parse(waterSanitationCsv, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });
      
      // Combine the data
      const allRawData = [...infrastructureParsed.data, ...waterSanitationParsed.data];
      
      console.log('Infrastructure indicators:', [...new Set(infrastructureParsed.data.map(row => row.INDICATOR))]);
      console.log('Water sanitation indicators:', [...new Set(waterSanitationParsed.data.map(row => row.INDICATOR))]);
      console.log('SH_H2O_SAFE records found:', allRawData.filter(row => row.INDICATOR === 'SH_H2O_SAFE').length);
      console.log('SH_SAN_SAFE records found:', allRawData.filter(row => row.INDICATOR === 'SH_SAN_SAFE').length);
      console.log('SPC_3_8_1 records found:', allRawData.filter(row => row.INDICATOR === 'SPC_3_8_1').length);
      
      // Filter valid data - using SH_H2O_SAFE for water access
      const allData = allRawData.filter(row => {
        return row.OBS_VALUE !== null && 
               row.OBS_VALUE !== undefined && 
               row.OBS_VALUE !== '' && 
               !isNaN(row.OBS_VALUE) &&
               row['Pacific Island Countries and territories'] !== null &&
               (row.INDICATOR === 'SH_H2O_SAFE' || 
                row.INDICATOR === 'SH_SAN_SAFE' || 
                row.INDICATOR === 'SPC_3_8_1');
      });
      
      // Separate data by indicator - SH_H2O_SAFE for water access
      // Filter for National values only (excluding Rural, Urban, etc.)
      const waterRawData = allData.filter(row => 
        row.INDICATOR === 'SH_H2O_SAFE' && 
        (row.Urbanization === 'National' || (!row.Urbanization && !row.Urban_Rural && !row.Location))
      );
      const sanitationRawData = allData.filter(row => 
        row.INDICATOR === 'SH_SAN_SAFE' && 
        (row.Urbanization === 'National' || (!row.Urbanization && !row.Urban_Rural && !row.Location))
      );
      const healthServicesRawData = allData.filter(row => 
        row.INDICATOR === 'SPC_3_8_1'
      );
      
      console.log('Filtered water data count:', waterRawData.length);
      console.log('Sample water data:', waterRawData.slice(0, 5));
      
      // Debug: Check what urbanisation values exist
      const allWaterData = allData.filter(row => row.INDICATOR === 'SH_H2O_SAFE');
      console.log('All water data sample to check fields:', allWaterData.slice(0, 3));
      
      // Check all possible field names that might contain urban/rural info
      if (allWaterData.length > 0) {
        console.log('Available fields:', Object.keys(allWaterData[0]));
        
        // Check for different possible field names
        const possibleFields = ['Urbanization'];
        possibleFields.forEach(field => {
          const values = [...new Set(allWaterData.map(row => row[field]))].filter(v => v !== undefined);
          if (values.length > 0) {
            console.log(`${field} values:`, values);
          }
        });
      }
      
      // Debug: Check Fiji specifically
      const fijiWaterData = waterRawData.filter(row => 
        row['Pacific Island Countries and territories'] === 'Fiji'
      );
      console.log('Fiji water records:', fijiWaterData.length);
      if (fijiWaterData.length > 0) {
        console.log('Fiji water sample:', fijiWaterData.slice(0, 3));
      }
      
      // Process data for comparison
      const processedWaterData = processDataForComparison(waterRawData);
      const processedSanitationData = processDataForComparison(sanitationRawData);
      const processedHealthServicesData = processDataForComparison(healthServicesRawData);
      
      setWaterAccessData(processedWaterData);
      setSanitationData(processedSanitationData);
      setHealthServicesData(processedHealthServicesData);
      
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

  const createClevelandPlot = useCallback((data, type) => {
    const svgElement = svgRef.current;
    d3.select(svgElement).selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 200 };
    
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

    g.selectAll(".domain")
      .style("stroke", colors.neutral400);

    g.selectAll(".tick line")
      .style("stroke", colors.neutral400);

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
      .attr("stroke", d => d.change >= 0 ? colors.primaryDeepBlue : colors.accentCoral)
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

    const getUnit = (type) => {
      switch(type) {
        case 'water': return '%';
        case 'sanitation': return '%';
        case 'healthServices': return 'points';
        default: return '';
      }
    };

    const unit = getUnit(type);
    const changeUnit = type === 'healthServices' ? 'pts' : 'pp';

    g.selectAll(".circle-first, .circle-last")
      .on("mouseover", function(event, d) {
        const isFirst = d3.select(this).classed("circle-first");
        const value = isFirst ? d.firstYear.value : d.lastYear.value;
        const year = isFirst ? d.firstYear.year : d.lastYear.year;
        const changeColor = d.change >= 0 ? colors.accentGreen : colors.accentCoral;
        
        tooltip.style("visibility", "visible")
          .html(`
            <div style="color: ${colors.neutral800}; font-weight: 600; margin-bottom: 8px; font-size: 14px;">${d.name}</div>
            <div style="color: ${colors.neutral700}; margin-bottom: 4px;">${year}: <strong style="color: ${colors.primaryOcean};">${value.toFixed(1)}${unit}</strong></div>
            <div style="color: ${colors.neutral600}; font-size: 12px; border-top: 1px solid ${colors.neutral200}; padding-top: 6px; margin-top: 6px;">
              <div>Change: <span style="color: ${changeColor}; font-weight: 600;">${d.change > 0 ? '+' : ''}${d.change.toFixed(1)} ${changeUnit}</span></div>
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
    const getAxisLabel = (type) => {
      switch(type) {
        case 'water': return 'Access to Improved Water Source (%)';
        case 'sanitation': return 'Access to Safe Sanitation (%)';
        case 'healthServices': return 'Essential Health Services Coverage (Index)';
        default: return '';
      }
    };

    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 40})`)
      .style("text-anchor", "middle")
      .style("fill", colors.neutral600)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(getAxisLabel(type));
  }, [colors]);

  useEffect(() => {
    if (!loading && !error) {
      if (activeChart === 'water' && Object.keys(waterAccessData).length > 0) {
        createClevelandPlot(waterAccessData, 'water');
      } else if (activeChart === 'sanitation' && Object.keys(sanitationData).length > 0) {
        createClevelandPlot(sanitationData, 'sanitation');
      } else if (activeChart === 'healthServices' && Object.keys(healthServicesData).length > 0) {
        createClevelandPlot(healthServicesData, 'healthServices');
      }
    }
  }, [activeChart, waterAccessData, sanitationData, healthServicesData, loading, error, createClevelandPlot]);

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
        <p>Loading infrastructure data...</p>
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
          width: ${isMobile ? '140px' : '180px'};
          flex-shrink: 0;
        }

        .controls-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend {
          margin-top: 24px;
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

        .legend-section {
          margin-bottom: 16px;
        }

        .legend-subtitle {
          font-size: ${isMobile ? '11px' : '12px'};
          font-weight: 500;
          margin-bottom: 8px;
          color: rgba(255, 255, 255, 0.9);
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

        .sort-button {
          padding: ${isMobile ? '8px 12px' : '12px 16px'};
          background: rgba(45, 108, 176, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 25px;
          color: ${colors.white};
          cursor: pointer;
          font-size: ${isMobile ? '11px' : '14px'};
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

        .stats-section {
          margin-bottom: 16px;
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
              className={`sort-button ${activeChart === 'water' ? 'active' : ''}`}
              onClick={() => setActiveChart('water')}
            >
              Water Access
            </button>
            <button 
              className={`sort-button ${activeChart === 'sanitation' ? 'active' : ''}`}
              onClick={() => setActiveChart('sanitation')}
            >
              Sanitation Access
            </button>
            <button 
              className={`sort-button ${activeChart === 'healthServices' ? 'active' : ''}`}
              onClick={() => setActiveChart('healthServices')}
            >
              Health Services
            </button>
          </div>
          
          {/* Legend */}
          <div className="legend">
            <div className="legend-title">Legend</div>
            
            <div className="legend-section">
              <div className="legend-subtitle">Trend Indicators</div>
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
        </div>

        {/* Chart Content */}
        <div className="chart-content">
          <svg ref={svgRef}></svg>
        </div>
      </div>
    </div>
  );
};

export default HealthcareSanitationChart;