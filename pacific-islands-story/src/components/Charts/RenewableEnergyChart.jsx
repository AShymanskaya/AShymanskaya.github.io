import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const RenewableEnergyChart = ({ transparent = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capacityData, setCapacityData] = useState({});
  const [shareData, setShareData] = useState({});
  const [activeChart, setActiveChart] = useState('capacity');
  const [stats, setStats] = useState({
    capacity: { avgGrowth: '--', topGainer: '--', countries: 0 },
    share: { avgGrowth: '--', topGainer: '--', countries: 0 }
  });
  
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Define the color palette
  const colors = {
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
  };

  useEffect(() => {
    loadAndProcessData();
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      if (activeChart === 'capacity' && Object.keys(capacityData).length > 0) {
        createClevelandPlot(capacityData, 'capacity');
      } else if (activeChart === 'share' && Object.keys(shareData).length > 0) {
        createClevelandPlot(shareData, 'share');
      }
      
      // Add resize listener
      const handleResize = () => {
        if (activeChart === 'capacity' && Object.keys(capacityData).length > 0) {
          createClevelandPlot(capacityData, 'capacity');
        } else if (activeChart === 'share' && Object.keys(shareData).length > 0) {
          createClevelandPlot(shareData, 'share');
        }
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [activeChart, capacityData, shareData, loading, error]);

  const loadAndProcessData = async () => {
    try {
      console.log('Loading renewable energy CSV file...');
      
      let csvContent = '';
      let dataLoaded = false;
      
      // Try to fetch the data file
      try {
        const dataFile = '/data/renewable_energy.csv';
        const response = await fetch(dataFile);
        if (response.ok) {
          csvContent = await response.text();
          dataLoaded = true;
          console.log('Successfully loaded via fetch');
        }
      } catch (error) {
        console.log('Could not load CSV file via fetch:', error);
      }
      
      if (!dataLoaded) {
        csvContent = generateDemoData();
        dataLoaded = true;
      }
      
      const parsed = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });
      
      const allData = parsed.data.filter(row => {
        return row.OBS_VALUE !== null && 
               row.OBS_VALUE !== undefined && 
               row.OBS_VALUE !== '' && 
               !isNaN(row.OBS_VALUE) &&
               row['Pacific Island Countries and territories'] !== null &&
               (row.INDICATOR === 'SPC_7_b_1' || row.INDICATOR === 'EG_FEC_RNEW');
      });
      
      const capacityRawData = allData.filter(row => row.INDICATOR === 'SPC_7_b_1');
      const shareRawData = allData.filter(row => row.INDICATOR === 'EG_FEC_RNEW');
      
      const processedCapacityData = processDataForComparison(capacityRawData);
      const processedShareData = processDataForComparison(shareRawData);
      
      setCapacityData(processedCapacityData);
      setShareData(processedShareData);
      
      updateStats('capacity', processedCapacityData);
      updateStats('share', processedShareData);
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading and processing data:', error);
      setError('Error loading data: ' + error.message);
      setLoading(false);
    }
  };

  const generateDemoData = () => {
    const countries = ['Fiji', 'Tonga', 'Samoa', 'Vanuatu', 'Solomon Islands', 'Kiribati', 'Palau', 'Marshall Islands', 'Cook Islands', 'Tuvalu'];
    const years = [2018, 2019, 2020, 2021, 2022, 2023];
    let csvData = 'INDICATOR,Pacific Island Countries and territories,GEO_PICT,TIME_PERIOD,OBS_VALUE,Unit of measure,Indicator\n';
    
    countries.forEach((country, countryIndex) => {
      years.forEach((year, yearIndex) => {
        const capacityBase = 50 + (countryIndex * 30) + Math.random() * 50;
        const capacityTrend = yearIndex * (10 + Math.random() * 20);
        const capacityValue = capacityBase + capacityTrend;
        csvData += `SPC_7_b_1,"${country}",${country.substring(0, 3).toUpperCase()},${year},${capacityValue.toFixed(1)},Watts per capita,Renewable Energy Capacity\n`;
        
        const shareBase = 15 + (countryIndex * 5) + Math.random() * 20;
        const shareTrend = yearIndex * (1 + Math.random() * 2);
        const shareValue = Math.min(shareBase + shareTrend, 85);
        csvData += `EG_FEC_RNEW,"${country}",${country.substring(0, 3).toUpperCase()},${year},${shareValue.toFixed(1)},Percentage,Renewable Energy Share\n`;
      });
    });
    
    return csvData;
  };

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

  const createClevelandPlot = (data, type) => {
    const svgElement = svgRef.current;
    d3.select(svgElement).selectAll("*").remove();

    // Get container dimensions
    const containerRect = containerRef.current?.getBoundingClientRect();
    const containerWidth = containerRect?.width || 800;
    const containerHeight = containerRect?.height || 500;
    const isMobile = window.innerWidth < 768;
    
    const margin = { 
      top: 10, 
      right: isMobile ? 10 : 20, 
      bottom: 60, 
      left: isMobile ? 120 : 200 
    };
    
    // Calculate available space
    const totalHeight = containerHeight - 80; // Account for buttons and title
    const width = containerWidth - margin.left - margin.right;
    const height = totalHeight - margin.top - margin.bottom;

    const svg = d3.select(svgElement)
      .attr("width", containerWidth)
      .attr("height", totalHeight)
      .attr("viewBox", `0 0 ${containerWidth} ${totalHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const countries = Object.values(data)
      .sort((a, b) => b.change - a.change)
      .slice(0, 8); // Limit to 8 countries to fit better
    
    if (countries.length === 0) return;

    const firstYear = countries[0].firstYear.year;
    const lastYear = countries[0].lastYear.year;

    // Scales
    const allValues = countries.flatMap(d => [d.firstYear.value, d.lastYear.value]);
    const xScale = d3.scaleLinear()
      .domain(d3.extent(allValues))
      .nice()
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(countries.map(d => d.name))
      .range([0, height])
      .padding(0.3);

    // Background grid lines
    g.selectAll(".grid-line")
      .data(xScale.ticks(isMobile ? 4 : 6))
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
      .call(d3.axisBottom(xScale).ticks(isMobile ? 4 : 6))
      .selectAll("text")
      .style("fill", colors.neutral600)
      .style("font-size", isMobile ? "10px" : "12px")
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
      .style("font-size", isMobile ? "10px" : "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(function(d) {
        // Don't truncate on desktop, only on mobile if really long
        return isMobile && d.length > 15 ? d.substring(0, 15) + '...' : d;
      });

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
      .attr("stroke-width", 2)
      .attr("opacity", 0.7)
      .style("opacity", 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 50)
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
      .style("stroke-width", 1.5)
      .transition()
      .duration(600)
      .delay((d, i) => i * 50 + 200)
      .attr("r", isMobile ? 3 : 5);

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
      .style("stroke-width", 2)
      .transition()
      .duration(600)
      .delay((d, i) => i * 50 + 400)
      .attr("r", isMobile ? 5 : 7);

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

    const unit = type === 'capacity' ? 'W/capita' : '%';
    const changeUnit = type === 'capacity' ? 'W/capita' : 'pp';

    g.selectAll(".circle-first, .circle-last")
      .on("mouseover", function(event, d) {
        const isFirst = d3.select(this).classed("circle-first");
        const value = isFirst ? d.firstYear.value : d.lastYear.value;
        const year = isFirst ? d.firstYear.year : d.lastYear.year;
        const changeColor = d.change >= 0 ? colors.accentGreen : colors.accentCoral;
        
        tooltip.style("visibility", "visible")
          .html(`
            <div style="color: ${colors.neutral800}; font-weight: 600; margin-bottom: 8px; font-size: 14px;">${d.name}</div>
            <div style="color: ${colors.neutral700}; margin-bottom: 4px;">${year}: <strong style="color: ${colors.primaryOcean};">${value.toFixed(1)} ${unit}</strong></div>
            <div style="color: ${colors.neutral600}; font-size: 12px; border-top: 1px solid ${colors.neutral200}; padding-top: 6px; margin-top: 6px;">
              <div>Change: <span style="color: ${changeColor}; font-weight: 600;">${d.change > 0 ? '+' : ''}${d.change.toFixed(1)} ${changeUnit}</span></div>
              <div>Growth: <span style="color: ${changeColor}; font-weight: 600;">${d.percentChange > 0 ? '+' : ''}${d.percentChange.toFixed(1)}%</span></div>
            </div>
          `);
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isFirst ? (isMobile ? 5 : 7) : (isMobile ? 7 : 9))
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
          .attr("r", isFirst ? (isMobile ? 3 : 5) : (isMobile ? 5 : 7))
          .style("filter", "none");
      });

    // Compact Legend - move it more to the right to avoid overlapping
    if (!isMobile && width > 300) {
      const legend = g.append("g")
        .attr("transform", `translate(${width - 60}, 5)`);

      legend.append("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", 75)
        .attr("height", 65)
        .attr("fill", colors.glassBg)
        .attr("stroke", colors.glassBorder)
        .attr("stroke-width", 1)
        .attr("rx", 6)
        .style("backdrop-filter", "blur(10px)");

      // First year
      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 4)
        .style("fill", colors.neutral500)
        .style("stroke", colors.neutral600)
        .style("stroke-width", 1.5);

      legend.append("text")
        .attr("x", 10)
        .attr("y", 3)
        .style("fill", colors.neutral700)
        .style("font-size", "10px")
        .style("font-weight", "400")
        .style("font-family", "'Inter', sans-serif")
        .text(`${firstYear}`);

      // Last year increase
      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 18)
        .attr("r", 6)
        .style("fill", colors.primaryOcean)
        .style("stroke", colors.primaryDeepBlue)
        .style("stroke-width", 2);

      legend.append("text")
        .attr("x", 10)
        .attr("y", 21)
        .style("fill", colors.neutral700)
        .style("font-size", "10px")
        .style("font-weight", "400")
        .style("font-family", "'Inter', sans-serif")
        .text(`${lastYear} ↑`);

      // Last year decrease
      legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 36)
        .attr("r", 6)
        .style("fill", colors.accentCoral)
        .style("stroke", colors.accentCoral)
        .style("stroke-width", 2);

      legend.append("text")
        .attr("x", 10)
        .attr("y", 39)
        .style("fill", colors.neutral700)
        .style("font-size", "10px")
        .style("font-weight", "400")
        .style("font-family", "'Inter', sans-serif")
        .text(`${lastYear} ↓`);
    }
    
    // X-axis label
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 45})`)
      .style("text-anchor", "middle")
      .style("fill", colors.neutral600)
      .style("font-size", isMobile ? "11px" : "13px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(type === 'capacity' ? 'Renewable Capacity (W/capita)' : 'Renewable Energy Share (%)');
  };

  const updateStats = (type, data) => {
    const countries = Object.values(data);
    
    if (countries.length === 0) return;
    
    const growthRates = countries.map(country => country.percentChange).filter(rate => !isNaN(rate) && isFinite(rate));
    const avgGrowth = growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;
    
    const topGainer = countries.reduce((max, country) => 
      country.change > max.change ? country : max, 
      countries[0] || { name: '--', change: 0 }
    );
    
    setStats(prev => ({
      ...prev,
      [type]: {
        avgGrowth: (avgGrowth > 0 ? '+' : '') + avgGrowth.toFixed(1) + '%',
        topGainer: topGainer.name,
        countries: countries.length
      }
    }));
  };

  if (loading) {
    return (
      <div 
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: transparent ? 'transparent' : `linear-gradient(135deg, ${colors.primaryDeepBlue} 0%, ${colors.primaryOcean} 100%)`,
          borderRadius: '20px',
          border: transparent ? 'none' : `1px solid ${colors.neutral300}`,
          color: colors.neutral600,
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <div style={{
          border: `3px solid ${colors.neutral300}`,
          borderTop: `3px solid ${colors.primaryOcean}`,
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading renewable energy data...</p>
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: transparent ? 'transparent' : `linear-gradient(135deg, ${colors.neutral100} 0%, ${colors.neutral50} 100%)`,
          borderRadius: '20px',
          border: transparent ? 'none' : `1px solid ${colors.neutral300}`,
          color: colors.accentCoral,
          fontSize: '16px',
          fontWeight: '500',
          textAlign: 'center',
          padding: '2rem',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {error}
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
        background: 'transparent',
        borderRadius: '20px',
        padding: '0',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {/* Chart Toggle Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: isMobile ? '8px' : '12px',
        marginBottom: isMobile ? '8px' : '16px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveChart('capacity')}
          style={{
            padding: isMobile ? '4px 12px' : '6px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeChart === 'capacity' 
              ? `linear-gradient(135deg, ${colors.primaryOcean} 0%, ${colors.primaryLight} 100%)` 
              : colors.glassBg,
            color: activeChart === 'capacity' ? colors.white : colors.neutral700,
            fontWeight: '600',
            fontSize: isMobile ? '11px' : '13px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontFamily: "'Inter', sans-serif",
            backdropFilter: 'blur(10px)',
            border: `1px solid ${activeChart === 'capacity' ? 'transparent' : colors.glassBorder}`,
            boxShadow: activeChart === 'capacity' ? `0 4px 12px ${colors.primaryOcean}40` : 'none'
          }}
        >
          Renewable Energy Capacity 
        </button>
        <button
          onClick={() => setActiveChart('share')}
          style={{
            padding: isMobile ? '4px 12px' : '6px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeChart === 'share' 
              ? `linear-gradient(135deg, ${colors.primaryOcean} 0%, ${colors.primaryLight} 100%)` 
              : colors.glassBg,
            color: activeChart === 'share' ? colors.white : colors.neutral700,
            fontWeight: '600',
            fontSize: isMobile ? '11px' : '13px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Renewable Energy Share 
        </button>
      </div>

      {/* Chart Container */}
      <div style={{ 
        flex: 1,
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        background: 'transparent',
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%'
      }}>
        <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }}></svg>
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

export default RenewableEnergyChart;