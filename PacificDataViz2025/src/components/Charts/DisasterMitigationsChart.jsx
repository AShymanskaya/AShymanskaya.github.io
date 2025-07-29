import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const DisasterMitigationsChart = ({ transparent = true }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Updated vibrant color palette
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

  // Data from the user
  const data = [
    { country: 'Vanuatu', coverage: 100 },
    { country: 'Palau', coverage: 100 },
    { country: 'Tuvalu', coverage: 100 },
    { country: 'Marshall Islands', coverage: 75 },
    { country: 'Tonga', coverage: 33.5 },
    { country: 'Kiribati', coverage: 26.1 },
    { country: 'Micronesia (F.S.)', coverage: 11.7 }
  ];

  useEffect(() => {
    createDonutCharts();
    
    // Add resize listener
    const handleResize = () => {
      createDonutCharts();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const createDonutCharts = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get container dimensions
    const containerWidth = containerRef.current?.clientWidth || 1200;
    const containerHeight = containerRef.current?.clientHeight || 400;
    
    // Responsive dimensions
    const isMobile = window.innerWidth < 768;
    const donutRadius = isMobile ? 35 : 45;
    const donutThickness = isMobile ? 10 : 12;
    const cols = isMobile ? 2 : 4;
    const rows = Math.ceil(data.length / cols);
    
    svg.attr("width", containerWidth).attr("height", containerHeight);

    // Calculate positions for donuts
    const xSpacing = containerWidth / cols;
    const ySpacing = containerHeight / rows;

    // Create vibrant color scale using the palette
    const vibrantColors = [
      colors.primaryDeepBlue,    // High coverage (100%)
      colors.accentGreen,     // High coverage (75%+)
      colors.primaryOcean,   // Medium coverage (50%+)
      colors.primaryLight,   // Medium-low coverage (25%+)
      colors.accentWarm,     // Low coverage (10%+)
      colors.accentCoral     // Very low coverage
    ];

    const getVibrantColor = (coverage) => {
      if (coverage >= 100) return vibrantColors[0]; // Green
      if (coverage >= 75) return vibrantColors[1];  // Teal
      if (coverage >= 50) return vibrantColors[2];  // Ocean
      if (coverage >= 25) return vibrantColors[3];  // Light blue
      if (coverage >= 10) return vibrantColors[4];  // Warm orange
      return vibrantColors[5]; // Coral
    };

    // Create pie generator
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(donutRadius - donutThickness)
      .outerRadius(donutRadius);

    // Tooltip with transparent background
    const tooltip = d3.select("body").append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", `rgba(26, 32, 44, 0.95)`) // Dark semi-transparent
      .style("border", `1px solid ${colors.neutral600}`)
      .style("border-radius", "12px")
      .style("padding", "12px 16px")
      .style("font-size", "15px")
      .style("font-family", "'Inter', sans-serif")
      .style("box-shadow", `0 10px 25px rgba(0, 0, 0, 0.3)`)
      .style("backdrop-filter", "blur(10px)")
      .style("z-index", "1000")
      .style("max-width", "200px")
      .style("color", colors.white);

    data.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * xSpacing + xSpacing / 2;
      const y = row * ySpacing + ySpacing / 2 + 20;

      // Create group for each donut
      const g = svg.append("g")
        .attr("transform", `translate(${x}, ${y})`);

      // Prepare data for pie chart
      const pieData = pie([
        { label: 'Protected', value: d.coverage },
        { label: 'Unprotected', value: 100 - d.coverage }
      ]);

      // Create donut segments
      const segments = g.selectAll(".arc")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "arc");

      segments.append("path")
        .attr("d", arc)
        .style("fill", (segmentData, segmentIndex) => 
          segmentIndex === 0 ? getVibrantColor(d.coverage) : 'transparent')
        .style("stroke", 'transparent')
        .style("stroke-width", 2)
        .style("opacity", 0)
        .on("mouseover", function(event, segmentData) {
          const currentColor = getVibrantColor(d.coverage);
          tooltip.style("visibility", "visible")
            .html(`
              <div style="color: ${colors.white}; font-weight: 600; margin-bottom: 8px; font-size: 18px;">${d.country}</div>
              <div style="color: ${colors.neutral200}; margin-bottom: 4px;">
                With DRR Strategy: <strong style="color: ${currentColor};">${d.coverage}%</strong>
              </div>
              <div style="color: ${colors.neutral300}; font-size: 12px;">
                Without Strategy: ${(100 - d.coverage).toFixed(1)}%
              </div>
            `);
          
          d3.select(this)
            .transition()
            .duration(200)
            .style("filter", "drop-shadow(0 4px 12px rgba(0,0,0,0.4)) brightness(1.1)")
            .attr("transform", "scale(1.05)");
        })
        .on("mousemove", function(event) {
          tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
          
          d3.select(this)
            .transition()
            .duration(200)
            .style("filter", "none")
            .attr("transform", "scale(1)");
        })
        .transition()
        .duration(800)
        .delay(i * 100)
        .style("opacity", 1)
        .attrTween("d", function(segmentData) {
          const interpolate = d3.interpolate(
            { startAngle: 0, endAngle: 0 },
            segmentData
          );
          return function(t) {
            return arc(interpolate(t));
          };
        });

      // Add percentage text in center with vibrant color
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("font-size", isMobile ? "12px" : "18px")
        .style("font-weight", "700")
        .style("fill", getVibrantColor(d.coverage))
        .style("font-family", "'Inter', sans-serif")
        .style("opacity", 0)
        .text(`${d.coverage}%`)
        .transition()
        .duration(600)
        .delay(i * 100 + 400)
        .style("opacity", 1);

      // Add country name below with darker text
      const countryName = d.country.length > 12 ? 
        d.country.split(' ')[0] + (d.country.includes('(') ? ' (F.S.)' : '') : 
        d.country;
        
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", `${donutRadius + 25}px`)
        .style("font-size", isMobile ? "10px" : "14px")
        .style("font-weight", "600")
        .style("fill", colors.neutral700)
        .style("font-family", "'Inter', sans-serif")
        .style("opacity", 0)
        .text(countryName)
        .transition()
        .duration(600)
        .delay(i * 100 + 600)
        .style("opacity", 1);
    });

    // Add title with darker color
    svg.append("text")
      .attr("x", containerWidth / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", isMobile ? "14px" : "18px")
      .style("font-weight", "700")
      .style("fill", colors.neutral900)
      .style("font-family", "'Space Grotesk', 'Inter', sans-serif")
      .style("opacity", 0)
      .text("Local Disaster Risk Reduction Strategy Implementation")
      .transition()
      .duration(800)
      .delay(200)
      .style("opacity", 1);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '0px',
        background: 'transparent',
        borderRadius: '0',
        fontFamily: "'Inter', sans-serif",
        position: 'relative'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        background: 'transparent',
        width: '100%',
        height: '100%'
      }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default DisasterMitigationsChart;