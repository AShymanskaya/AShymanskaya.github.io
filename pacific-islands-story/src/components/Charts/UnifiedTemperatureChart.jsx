import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import Papa from 'papaparse';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Custom plugin to add inline labels and custom legend
const inlineLabelsPlugin = {
  id: 'inlineLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    
    // Draw custom legend inside chart area
    this.drawCustomLegend(chart, ctx);
    
    // Draw dataset labels and temperature values
    
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      const data = dataset.data;
      
      // Find valid data points
      const validPoints = [];
      data.forEach((value, index) => {
        if (value !== null && value !== undefined && !isNaN(value)) {
          const point = meta.data[index];
          if (point) {
            validPoints.push({
              x: point.x,
              y: point.y,
              value: value,
              year: chart.data.labels[index]
            });
          }
        }
      });
      
      if (validPoints.length === 0) return;
      
      // Better distribution of temperature value labels
      const pointsToLabel = [];
      const totalPoints = validPoints.length;
      
      // For annual data, show fewer labels to reduce clutter
      const isAnnualData = !dataset.label.includes('Trend');
      const labelInterval = isAnnualData ? Math.max(25, Math.floor(totalPoints / 4)) : Math.max(20, Math.floor(totalPoints / 5));
      
      // Always include first and last points
      pointsToLabel.push(validPoints[0]);
      if (totalPoints > 1) {
        pointsToLabel.push(validPoints[totalPoints - 1]);
      }
      
      // Add evenly distributed points in between
      for (let i = labelInterval; i < totalPoints - labelInterval; i += labelInterval) {
        pointsToLabel.push(validPoints[i]);
      }
      
      // Remove duplicates and sort by x position
      const uniquePoints = pointsToLabel.filter((point, index, self) => 
        index === self.findIndex(p => Math.abs(p.x - point.x) < 10)
      ).sort((a, b) => a.x - b.x);
      
      // Draw temperature value labels with better spacing
      ctx.save();
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      
      // Set color to match line color
      ctx.fillStyle = dataset.borderColor;
      
      uniquePoints.forEach((point, index) => {
        // Only show temperature labels for trend lines to reduce clutter
        if (!dataset.label.includes('Trend')) return;
        
        const label = `${point.value.toFixed(1)}°C`;
        
        // Smart positioning to avoid overlap
        const isEven = index % 2 === 0;
        const baseOffset = -20;
        const offsetY = baseOffset + (isEven ? -15 : 15);
        
        ctx.textBaseline = 'bottom';
        
        // Add background for better readability
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(point.x - textWidth/2 - 3, point.y + offsetY - 12, textWidth + 6, 14);
        
        ctx.fillStyle = dataset.borderColor;
        ctx.fillText(label, point.x, point.y + offsetY);
        
        // Add year labels only for first and last points
        if (index === 0 || index === uniquePoints.length - 1) {
          ctx.save();
          ctx.font = 'bold 9px Arial';
          ctx.textBaseline = 'top';
          const yearOffsetY = offsetY + (isEven ? 5 : -5);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          const yearWidth = ctx.measureText(point.year).width;
          ctx.fillRect(point.x - yearWidth/2 - 2, point.y + yearOffsetY, yearWidth + 4, 12);
          
          ctx.fillStyle = dataset.borderColor;
          ctx.fillText(point.year, point.x, point.y + yearOffsetY + 2);
          ctx.restore();
        }
      });
      
      ctx.restore();

      // Remove dataset label section - commented out to eliminate land/ocean labels
      /*
      // Add dataset label intelligently positioned
      if (validPoints.length > 0) {
        const lastPoint = validPoints[validPoints.length - 1];
        const firstPoint = validPoints[0];
        
        ctx.save();
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = dataset.borderColor;
        
        // Clean up the dataset label text
        let labelText = dataset.label;
        if (labelText.includes('(Annual)')) {
          labelText = labelText.replace(' (Annual)', '');
        }
        if (labelText.includes('(10-Year Trend)')) {
          labelText = labelText.replace(' Temperature (10-Year Trend)', ' Trend');
        }
        
        // Smart positioning: choose between start, middle, or end based on available space
        const chartWidth = chart.width - chart.chartArea.left - chart.chartArea.right;
        const middlePoint = validPoints[Math.floor(validPoints.length / 2)];
        
        let labelX, labelY, textAlign;
        
        // For trend lines (thicker lines), position them in the middle-right area
        if (labelText.includes('Trend')) {
          labelX = middlePoint.x + 30;
          labelY = middlePoint.y - 20;
          textAlign = 'left';
        } else {
          // For main lines, position at the end with some offset
          labelX = lastPoint.x - 50;
          labelY = lastPoint.y - 25;
          textAlign = 'center';
        }
        
        // Add semi-transparent background for better readability
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(labelText).width;
        const padding = 6;
        
        let rectX = labelX;
        if (textAlign === 'center') {
          rectX = labelX - textWidth/2;
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(rectX - padding/2, labelY - 8, textWidth + padding, 16);
        
        // Add subtle border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX - padding/2, labelY - 8, textWidth + padding, 16);
        
        // Draw the text
        ctx.fillStyle = dataset.borderColor;
        ctx.fillText(labelText, labelX, labelY);
        
        ctx.restore();
      }
      */
    });
  },

  drawCustomLegend(chart, ctx) {
    const { chartArea } = chart;
    const datasets = chart.data.datasets;
    
    // Legend positioning
    const legendX = chartArea.left + 20;
    const legendY = chartArea.top + 30;
    const lineHeight = 25;
    const lineWidth = 20;
    
    ctx.save();
    
    datasets.forEach((dataset, index) => {
      const y = legendY + (index * lineHeight);
      const meta = chart.getDatasetMeta(index);
      const isVisible = meta.visible !== false;
      
      // Draw legend background with transparency
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';  // Made more transparent
      ctx.fillRect(legendX - 5, y - 8, 140, 20);
      
      // Draw border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX - 5, y - 8, 140, 20);
      
      // Draw line sample
      ctx.strokeStyle = dataset.borderColor;
      ctx.lineWidth = dataset.borderWidth;
      ctx.globalAlpha = isVisible ? 1 : 0.3;
      
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + lineWidth, y);
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = isVisible ? '#2d3748' : '#a0aec0';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      // Clean up label text
      let labelText = dataset.label;
      if (labelText.includes('(Annual)')) {
        labelText = labelText.replace(' (Annual)', '');
      }
      if (labelText.includes('(10-Year Trend)')) {
        labelText = labelText.replace(' Temperature (10-Year Trend)', ' Trend');
      }
      
      ctx.fillText(labelText, legendX + lineWidth + 8, y);
      
      ctx.globalAlpha = 1;
    });
    
    ctx.restore();
    
    // Add click handler for legend
    if (!chart.legendClickHandler) {
      chart.legendClickHandler = (event) => {
        const rect = chart.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const legendX = chartArea.left + 20;
        const legendY = chartArea.top + 30;
        const lineHeight = 25;
        
        datasets.forEach((dataset, index) => {
          const itemY = legendY + (index * lineHeight);
          
          if (x >= legendX - 5 && x <= legendX + 135 && 
              y >= itemY - 8 && y <= itemY + 12) {
            
            const meta = chart.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
            chart.update();
          }
        });
      };
      
      chart.canvas.addEventListener('click', chart.legendClickHandler);
    }
  }
};

// Register the plugin
ChartJS.register(inlineLabelsPlugin);

// Custom hook for loading data
const useTemperatureData = (dataFile) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        let csvText = '';
        let dataLoaded = false;

        // Try to load real data
        try {
          const response = await fetch(`/data/${dataFile}`);
          if (response.ok) {
            csvText = await response.text();
            dataLoaded = true;
          }
        } catch (err) {
          console.log(`Could not load ${dataFile}, using sample data`);
        }

        if (dataLoaded) {
          // Parse CSV data
          const parsed = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          });

          setData(parsed.data);
        } 
        
      } catch (err) {
        setError(err);
        // Fallback to sample data on error
        
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFile]);

  return { data, loading, error };
};

// Apply 10-year smoothing function
const apply10YearSmoothing = (data) => {
  if (!data || data.length === 0) return [];
  
  const sortedData = [...data].sort((a, b) => a.Year - b.Year);
  const smoothedData = [];
  const windowSize = 10;
  
  // Use a trailing moving average to preserve more data points
  for (let i = windowSize - 1; i < sortedData.length; i++) {
    const window = sortedData.slice(i - windowSize + 1, i + 1);
    
    // Filter out any invalid data points within the window
    const validWindowData = window.filter(d => 
      d.Annual_Temperature_C !== null && 
      d.Annual_Temperature_C !== undefined && 
      !isNaN(d.Annual_Temperature_C)
    );
    
    if (validWindowData.length >= windowSize * 0.7) { // Require at least 70% valid data
      const avgTemp = validWindowData.reduce((sum, d) => sum + d.Annual_Temperature_C, 0) / validWindowData.length;
      
      smoothedData.push({
        Year: sortedData[i].Year,
        Annual_Temperature_C: avgTemp
      });
    }
  }
  
  return smoothedData;
};

// Process ocean temperature data to yearly averages
const processOceanDataToYearly = (data) => {
  if (!data || data.length === 0) return [];
  
  // Group by year and calculate average
  const yearlyData = {};
  
  data.forEach(d => {
    if (d.analysed_sst && !isNaN(d.analysed_sst) && d.time) {
      const year = typeof d.time === 'string' && d.time.includes('-') 
        ? parseInt(d.time.split('-')[0])
        : parseInt(d.time);
      
      if (!isNaN(year)) {
        if (!yearlyData[year]) {
          yearlyData[year] = { sum: 0, count: 0 };
        }
        yearlyData[year].sum += parseFloat(d.analysed_sst);
        yearlyData[year].count += 1;
      }
    }
  });
  
  // Convert to array and calculate averages
  return Object.keys(yearlyData)
    .map(year => ({
      Year: parseInt(year),
      Annual_Temperature_C: yearlyData[year].sum / yearlyData[year].count
    }))
    .sort((a, b) => a.Year - b.Year);
};

// Loading Component
const ChartLoading = ({ message = "Loading temperature data..." }) => (
  <div className="chart-loading">
    <style jsx>{`
      .chart-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #718096;
        font-size: 1.1rem;
      }

      .spinner {
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top: 3px solid #2b6cb0;
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
    <p>{message}</p>
  </div>
);

// United Temperature Chart Component
export const UnifiedTemperatureChart = () => {
  const { data: oceanData, loading: oceanLoading, error: oceanError } = useTemperatureData('total_average_sst.csv');
  const { data: landData, loading: landLoading, error: landError } = useTemperatureData('oceania_absolute_temperatures.csv');

  if (oceanLoading || landLoading) {
    return <ChartLoading message="Loading temperature data..." />;
  }

  // Process land temperature data (all available data)
  const validLandData = landData ? landData.filter(row => 
    row.Annual_Temperature_C !== null && 
    row.Annual_Temperature_C !== undefined && 
    !isNaN(row.Annual_Temperature_C) &&
    row.Year !== null && 
    row.Year !== undefined
  ) : [];

  // Process ocean temperature data to yearly averages (all available data)
  const yearlyOceanData = oceanData ? processOceanDataToYearly(oceanData) : [];

  if (yearlyOceanData.length === 0 && validLandData.length === 0) {
    return <ChartLoading message="No temperature data available" />;
  }

  // Sort both datasets by year
  const sortedOceanData = yearlyOceanData.sort((a, b) => a.Year - b.Year);
  const sortedLandData = validLandData.sort((a, b) => a.Year - b.Year);

  // Get all unique years from both datasets
  const allYears = new Set([
    ...sortedOceanData.map(d => d.Year),
    ...sortedLandData.map(d => d.Year)
  ]);
  const yearLabels = Array.from(allYears).sort((a, b) => a - b);

  const datasets = [];

  // Add land temperature dataset with all available data
  if (sortedLandData.length > 0) {
    datasets.push({
      label: 'Land Temperature (Annual)',
      data: yearLabels.map(year => {
        const dataPoint = sortedLandData.find(d => d.Year === year);
        return dataPoint ? dataPoint.Annual_Temperature_C : null;
      }),
      borderColor: '#2d3748',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(43, 108, 176, 0.1)');
        gradient.addColorStop(1, 'rgba(43, 108, 176, 0.02)');
        return gradient;
      },
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 6,
      pointBackgroundColor: '#2d3748',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      pointHoverBorderWidth: 2,
      spanGaps: true
    });

    // Add smoothed land temperature trend line
    const smoothedLandData = apply10YearSmoothing(validLandData);
    if (smoothedLandData.length > 0) {
      datasets.push({
        label: 'Land Temperature (10-Year Trend)',
        data: yearLabels.map(year => {
          const dataPoint = smoothedLandData.find(d => d.Year === year);
          return dataPoint ? dataPoint.Annual_Temperature_C : null;
        }),
        borderColor: '#2d3748',
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 7,
        pointBackgroundColor: '#2d3748',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        spanGaps: true
      });
    }
  }

  // Add ocean temperature dataset with all available data
  if (sortedOceanData.length > 0) {
    datasets.push({
      label: 'Ocean Temperature (Annual)',
      data: yearLabels.map(year => {
        const dataPoint = sortedOceanData.find(d => d.Year === year);
        return dataPoint ? dataPoint.Annual_Temperature_C : null;
      }),
      borderColor: '#2b6cb0',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(237, 131, 54, 0.15)');
        gradient.addColorStop(1, 'rgba(237, 131, 54, 0.02)');
        return gradient;
      },
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 6,
      pointBackgroundColor: '#1a365d',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      pointHoverBorderWidth: 2,
      spanGaps: true
    });

    // Add smoothed ocean temperature trend line
    const smoothedOceanData = apply10YearSmoothing(yearlyOceanData);
    if (smoothedOceanData.length > 0) {
      datasets.push({
        label: 'Ocean Temperature (10-Year Trend)',
        data: yearLabels.map(year => {
          const dataPoint = smoothedOceanData.find(d => d.Year === year);
          return dataPoint ? dataPoint.Annual_Temperature_C : null;
        }),
        borderColor: '#2b6cb0',
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 7,
        pointBackgroundColor: '#1a365d',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        spanGaps: true
      });
    }
  }

  const chartData = {
    labels: yearLabels,
    datasets: datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 150,   // Reduced since legend is now on left
        bottom: 40,
        left: 0, // Increased left padding for legend
        right: 80  
      }
    },
    interaction: {
      intersect: true,
      mode: 'point'
    },
    plugins: {
      legend: {
        display: false  // Hide default legend since we're using custom one
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        displayColors: true,
        filter: function(tooltipItem) {
          // Only show tooltip if the point has actual data
          return tooltipItem.parsed.y !== null && tooltipItem.parsed.y !== undefined;
        },
        callbacks: {
          title: function(context) {
            return `${context[0].label}`;
          },
          label: function(context) {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            
            // Show actual values, not averages
            const datasetLabel = context.dataset.label;
            return `${datasetLabel}: ${value.toFixed(2)}°C`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: { display: false },
        ticks: {
          display: false  // Hide x-axis labels
        },
        title: {
          display: false
        }
      },
      y: {
        min: 20,
        max: 30,
        grid: {
          display: false
        },
        border: { display: false },
        ticks: {
          display: false  // Hide y-axis labels
        },
        title: {
          display: false
        }
      }
    },
    elements: {
      point: { hoverBorderWidth: 3 }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart'
    }
  };

  return (
    <div className="united-temperature-chart">
      <style jsx>{`
        .united-temperature-chart {
          width: 100%;
          height: 100%;
          position: relative;
          background: #f4a261;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
      `}</style>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Export individual components for backward compatibility
export const OceanTemperatureChart = () => {
  return <UnifiedTemperatureChart />;
};

export const TemperatureChart = () => {
  return <UnifiedTemperatureChart />;
};