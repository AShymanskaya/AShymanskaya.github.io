import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const HelpFisheriesChart = ({ transparent = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonData, setComparisonData] = useState({});
  const [stats, setStats] = useState({
    avgChange: '--',
    countriesCount: '--',
    topGainer: '--',
    dataSpan: '--'
  });
  const [insights, setInsights] = useState('Analyzing marine protection trends across Pacific Island countries...');
  const svgRef = useRef(null);

  // Define the same color palette as the renewable energy chart
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
    if (!loading && !error && Object.keys(comparisonData).length > 0) {
      createClevelandPlot(comparisonData);
    }
  }, [loading, error, comparisonData]);

  const loadAndProcessData = async () => {
    try {
      console.log('Loading fisheries CSV file...');
      
      let csvContent = '';
      let dataLoaded = false;
      try {
        const response = await fetch('/data/helping_fisheries.csv');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        csvContent = await response.text();
        console.log('Successfully loaded via fetch');
        dataLoaded = true;

      } catch (fetchError) {
        console.log('Fetch failed:', fetchError.message);
        csvContent = generateDemoData();
        dataLoaded = true;
      }
      
      // Parse CSV data
      const parsed = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });
      
      // Filter marine protection data
      const marineData = parsed.data.filter(row => {
        return row.OBS_VALUE !== null && 
               row.OBS_VALUE !== undefined && 
               row.OBS_VALUE !== '' && 
               !isNaN(row.OBS_VALUE) &&
               row['Pacific Island Countries and territories'] !== null &&
               row.INDICATOR === 'ER_MRN_MARINKBA';
      });
      
      // Process data for comparison
      const processedData = processDataForComparison(marineData);
      setComparisonData(processedData);
      
      // Update stats
      updateStats(processedData);
      updateInsights(processedData);
      
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading and processing data:', error);
      setError('Error loading data: ' + error.message);
      setLoading(false);
    }
  };

  const generateDemoData = () => {
    // Generate demo data if file reading fails
    const countries = ['Fiji', 'Tonga', 'Samoa', 'Vanuatu', 'Solomon Islands', 'Kiribati', 'Palau', 'Marshall Islands'];
    const years = [2018, 2019, 2020, 2021, 2022, 2023];
    let csvData = 'INDICATOR,Pacific Island Countries and territories,GEO_PICT,TIME_PERIOD,OBS_VALUE,Unit of measure,Indicator\n';
    
    countries.forEach((country, countryIndex) => {
      years.forEach((year, yearIndex) => {
        const baseValue = 20 + (countryIndex * 8) + Math.random() * 10;
        const trend = yearIndex * (2 + Math.random() * 2);
        const value = Math.min(baseValue + trend, 95);
        csvData += `ER_MRN_MARINKBA,"${country}",${country.substring(0, 3).toUpperCase()},${year},${value.toFixed(1)},Percentage,Marine Protected Areas\n`;
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

  const createClevelandPlot = (data) => {
    const svgElement = svgRef.current;
    d3.select(svgElement).selectAll("*").remove();

    const margin = { top: 20, right: 40, bottom: 50, left: 420 };
    const width = 700 - margin.left - margin.right;
    const height = 620 - margin.top - margin.bottom;

    const svg = d3.select(svgElement)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const countries = Object.values(data).sort((a, b) => b.change - a.change);
    
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
      .style("font-size", "13px")
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
      .attr("r", 6);

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
      .attr("r", 8);

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
            <div style="color: ${colors.neutral700}; margin-bottom: 4px;">${year}: <strong style="color: ${colors.primaryOcean};">${value.toFixed(1)}%</strong></div>
            <div style="color: ${colors.neutral600}; font-size: 12px; border-top: 1px solid ${colors.neutral200}; padding-top: 6px; margin-top: 6px;">
              <div>Change: <span style="color: ${changeColor}; font-weight: 600;">${d.change > 0 ? '+' : ''}${d.change.toFixed(1)}pp</span></div>
              <div>Growth: <span style="color: ${changeColor}; font-weight: 600;">${d.percentChange > 0 ? '+' : ''}${d.percentChange.toFixed(1)}%</span></div>
            </div>
          `);
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isFirst ? 8 : 10)
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
          .attr("r", isFirst ? 6 : 8)
          .style("filter", "none");
      });

    // Legend
    const legend = g.append("g")
      .attr("transform", `translate(${width + 25}, 30)`);

    legend.append("rect")
      .attr("x", -15)
      .attr("y", -15)
      .attr("width", 110)
      .attr("height", 105)
      .attr("fill", colors.glassBg)
      .attr("stroke", colors.glassBorder)
      .attr("stroke-width", 1)
      .attr("rx", 8)
      .style("backdrop-filter", "blur(10px)");

    // Baseline circles
    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 6)
      .style("fill", colors.neutral500)
      .style("stroke", colors.neutral600)
      .style("stroke-width", 2);

    legend.append("text")
      .attr("x", 15)
      .attr("y", 5)
      .style("fill", colors.neutral700)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(`${firstYear} (baseline)`);

    // Increase circles
    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 25)
      .attr("r", 8)
      .style("fill", colors.primaryOcean)
      .style("stroke", colors.primaryDeepBlue)
      .style("stroke-width", 2.5);

    legend.append("text")
      .attr("x", 15)
      .attr("y", 30)
      .style("fill", colors.neutral700)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(`${lastYear} (increase)`);

    // Decrease circles
    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 50)
      .attr("r", 8)
      .style("fill", colors.accentCoral)
      .style("stroke", colors.accentCoral)
      .style("stroke-width", 2.5);

    legend.append("text")
      .attr("x", 15)
      .attr("y", 55)
      .style("fill", colors.neutral700)
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text(`${lastYear} (decrease)`);

    // X-axis label
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 40})`)
      .style("text-anchor", "middle")
      .style("fill", colors.neutral600)
      .style("font-size", "14px")
      .style("font-weight", "500")
      .style("font-family", "'Inter', sans-serif")
      .text('Marine Protected Area Coverage (%)');
  };

  const updateStats = (data) => {
    const countries = Object.values(data);
    
    if (countries.length === 0) return;
    
    const changes = countries.map(country => country.change).filter(change => !isNaN(change) && isFinite(change));
    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    
    const topGainer = countries.reduce((max, country) => 
      country.change > max.change ? country : max, 
      countries[0] || { name: '--', change: 0 }
    );
    
    const allYears = countries.flatMap(country => [country.firstYear.year, country.lastYear.year]);
    const yearSpan = countries.length > 0 ? `${Math.min(...allYears)}-${Math.max(...allYears)}` : '--';
    
    setStats({
      avgChange: (avgChange > 0 ? '+' : '') + avgChange.toFixed(1) + 'pp',
      countriesCount: countries.length,
      topGainer: topGainer.name,
      dataSpan: yearSpan
    });
  };

  const updateInsights = (data) => {
    const countries = Object.values(data);
    
    if (countries.length === 0) return;
    
    const latestPerformance = countries.map(country => ({
      name: country.name,
      latest: country.lastYear.value,
      first: country.firstYear.value,
      change: country.change
    })).sort((a, b) => b.latest - a.latest);
    
    const topPerformer = latestPerformance[0];
    const biggestGainer = countries.sort((a, b) => b.change - a.change)[0];
    
    let insightText = `${topPerformer.name} leads with ${topPerformer.latest.toFixed(1)}% marine area coverage. `;
    
    if (biggestGainer.change > 0) {
      insightText += `${biggestGainer.name} shows the most improvement with +${biggestGainer.change.toFixed(1)}pp increase over the period.`;
    } else {
      const avgCoverage = latestPerformance.reduce((sum, c) => sum + c.latest, 0) / latestPerformance.length;
      insightText += `Regional average coverage is ${avgCoverage.toFixed(1)}%.`;
    }
    
    setInsights(insightText);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '500px',
        background: `linear-gradient(135deg, ${colors.primaryDeepBlue} 0%, ${colors.primaryOcean} 100%)`,
        borderRadius: '20px',
        border: `1px solid ${colors.neutral300}`,
        color: colors.white,
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          border: `3px solid ${colors.neutral300}`,
          borderTop: `3px solid ${colors.white}`,
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading marine protection data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '500px',
        background: `linear-gradient(135deg, ${colors.neutral100} 0%, ${colors.neutral50} 100%)`,
        borderRadius: '20px',
        border: `1px solid ${colors.neutral300}`,
        color: colors.accentCoral,
        fontSize: '16px',
        fontWeight: '500',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: "'Inter', sans-serif"
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '700px',
      background: 'transparent',
      borderRadius: '20px',
      padding: '32px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Title Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h3 style={{
          fontSize: '2rem',
          fontWeight: '700',
          margin: '0 0 12px 0',
          color: colors.neutral800,
          fontFamily: "'Space Grotesk', 'Inter', sans-serif"
        }}>
          Marine Protected Area Coverage Trends
        </h3>
        <p style={{
          fontSize: '16px',
          margin: 0,
          color: colors.neutral600,
          fontWeight: '400',
          lineHeight: '1.5'
        }}>
          Protected area coverage for marine Key Biodiversity Areas across Pacific Island countries (%)
        </p>
      </div>

      {/* Chart Container */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        marginBottom: '32px',
        background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${colors.neutral200}`,
        boxShadow: `0 4px 12px ${colors.glassShadow}`
      }}>
        <svg ref={svgRef}></svg>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '24px 20px',
          background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: '16px',
          boxShadow: `0 4px 12px ${colors.glassShadow}`
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: colors.primaryOcean,
            marginBottom: '8px',
            fontFamily: "'Space Grotesk', 'Inter', sans-serif"
          }}>{stats.avgChange}</div>
          <div style={{
            fontSize: '13px',
            color: colors.neutral600,
            textTransform: 'uppercase',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>Average Change</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '24px 20px',
          background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: '16px',
          boxShadow: `0 4px 12px ${colors.glassShadow}`
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: colors.accentTeal,
            marginBottom: '8px',
            fontFamily: "'Space Grotesk', 'Inter', sans-serif"
          }}>{stats.countriesCount}</div>
          <div style={{
            fontSize: '13px',
            color: colors.neutral600,
            textTransform: 'uppercase',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>Countries</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '24px 20px',
          background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: '16px',
          boxShadow: `0 4px 12px ${colors.glassShadow}`
        }}>
          <div style={{
            fontSize: '1.125rem',
            fontWeight: '700',
            color: colors.accentGreen,
            marginBottom: '8px',
            lineHeight: '1.2',
            fontFamily: "'Space Grotesk', 'Inter', sans-serif"
          }}>{stats.topGainer}</div>
          <div style={{
            fontSize: '13px',
            color: colors.neutral600,
            textTransform: 'uppercase',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>Top Gainer</div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '24px 20px',
          background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
          border: `1px solid ${colors.neutral200}`,
          borderRadius: '16px',
          boxShadow: `0 4px 12px ${colors.glassShadow}`
        }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: colors.accentCoral,
            marginBottom: '8px',
            fontFamily: "'Space Grotesk', 'Inter', sans-serif"
          }}>{stats.dataSpan}</div>
          <div style={{
            fontSize: '13px',
            color: colors.neutral600,
            textTransform: 'uppercase',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>Years Covered</div>
        </div>
      </div>

      {/* Key Insights */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.neutral50} 100%)`,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: '16px',
        boxShadow: `0 4px 12px ${colors.glassShadow}`,
        padding: '24px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: colors.neutral800,
          marginBottom: '12px',
          fontFamily: "'Inter', sans-serif"
        }}>Key Insights</div>
        <div style={{
          fontSize: '14px',
          color: colors.neutral600,
          lineHeight: '1.6',
          fontFamily: "'Inter', sans-serif"
        }}>{insights}</div>
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

export default HelpFisheriesChart;