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

const temperatureChartLabelsPlugin = {
  id: 'temperatureChartLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    
    
    // Draw dataset labels and temperature values
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      // Safety check for dataset properties
      if (!dataset || !dataset.data) return;
      
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data) return;
      
      const data = dataset.data;
      
      // Find valid data points with their original indices
      const validPoints = [];
      data.forEach((value, index) => {
        if (value !== null && value !== undefined && !isNaN(value)) {
          const point = meta.data[index];
          if (point) {
            validPoints.push({
              x: point.x,
              y: point.y,
              value: value,
              year: chart.data.labels[index],
              originalIndex: index
            });
          }
        }
      });
      
      if (validPoints.length === 0) return;
      
      // For annual data (not averages), label only first and last actual datapoints
      const pointsToLabel = [];
      const isAnnualData = !dataset.label || !dataset.label.includes('Average');
      
      if (isAnnualData) {
        // Only label first and last actual datapoints for annual data
        pointsToLabel.push(validPoints[0]); // First datapoint
        if (validPoints.length > 1) {
          pointsToLabel.push(validPoints[validPoints.length - 1]); // Last datapoint
        }
      } else {
        // For average lines, label first and last points
        pointsToLabel.push(validPoints[0]); // First average point
        if (validPoints.length > 1) {
          pointsToLabel.push(validPoints[validPoints.length - 1]); // Last average point
        }
      }
      
      // Draw temperature value labels with manual positioning
      ctx.save();
      ctx.font = 'bold 16px Arial';  // Slightly larger font
      ctx.textAlign = 'center';
      
      // Set color to match line color with proper fallback and safety checks
      let labelColor = '#4a5568'; // Default fallback color
      if (dataset.borderColor) {
        if (typeof dataset.borderColor === 'string') {
          labelColor = dataset.borderColor;
          // Only modify if it contains rgba
          if (labelColor.includes('rgba')) {
            labelColor = labelColor.replace(/0\.4/g, '0.8').replace(/0\.6/g, '1.0');
          }
        } else {
          // If borderColor is not a string, use the fallback
          labelColor = '#4a5568';
        }
      }
      ctx.fillStyle = labelColor;
      
      pointsToLabel.forEach((point, index) => {
        const label = `${point.value.toFixed(1)}°C`;
        
        // Manual positioning based on dataset and point position
        const isFirst = index === 0;
        const isLast = index === pointsToLabel.length - 1;
        const isLandData = dataset.label && dataset.label.includes('Land');
        const isOceanData = dataset.label && dataset.label.includes('Ocean');
        
        // Use chart area for more reliable positioning
        const { chartArea } = chart;
        let offsetX = 0;
        let offsetY = -40;
        
        // Fixed positioning relative to chart area rather than point position
        if (isLandData) {
          if (isFirst) {
            offsetX = -40;  // Move further left for first land point
            offsetY = -20;  // Move up more
          } else if (isLast) {
            offsetX = 40;   // Move further right for last land point
            offsetY = -20;  // Move up more
          }
        } else if (isOceanData) {
          if (isFirst) {
            offsetX = -30;   // Move further right for first ocean point
            offsetY = -20;  // Move up even more
          } else if (isLast) {
            offsetX = 30;  // Move further left for last ocean point
            offsetY = -20;  // Move up even more
          }
        }
        
        ctx.textBaseline = 'bottom';
        
        // Draw the temperature label with manual positioning
        ctx.fillStyle = labelColor;
        ctx.fillText(label, point.x + offsetX, point.y + offsetY);
        
        // Add year labels for first and last points
        if (index === 0 || index === pointsToLabel.length - 1) {
          ctx.save();
          ctx.font = 'bold 15px Arial';  // Slightly larger year font
          ctx.textBaseline = 'top';
          
          // Position year labels with proper spacing
          const yearOffsetY = offsetY + 30; // Below temperature label
          
          // Draw the year label with same styling as temperature
          ctx.fillStyle = labelColor;
          ctx.fillText(point.year, point.x + offsetX, point.y + yearOffsetY);
          ctx.restore();
        }
      });
      
      // Add dataset title over the line (center of the chart area)
      this.drawDatasetTitle(chart, ctx, dataset, datasetIndex, meta);
      
      ctx.restore();
    });
  },

  drawDatasetTitle(chart, ctx, dataset, datasetIndex, meta) {
    const { chartArea } = chart;
    
    // Safety checks
    if (!dataset || !meta || !meta.data) return;
    
    const validPoints = meta.data.filter(point => point && !isNaN(point.y));
    
    if (validPoints.length === 0) return;
    
    // Use fixed positions relative to chart area instead of line positions
    const chartCenterX = chartArea.left + (chartArea.width / 2);
    const chartCenterY = chartArea.top + (chartArea.height / 2);
    
    ctx.save();
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Clean up dataset label for title with safety checks
    let title = 'Temperature';
    if (dataset.label) {
      title = dataset.label;
      title = title.replace(' (Annual)', '');
      title = title.replace(' Temperature', '');
    }
    
    // Fixed positioning for dataset titles relative to chart area
    const isLandData = dataset.label && dataset.label.includes('Land');
    const isOceanData = dataset.label && dataset.label.includes('Ocean');
    
    let titleX = chartCenterX;
    let titleY = chartCenterY;
    
    if (isLandData) {
      titleX = chartArea.left + (chartArea.width * 0.8);  // 25% from left
      titleY = chartArea.top + (chartArea.height * 0.65);   // 30% from top
    } else if (isOceanData) {
      titleX = chartArea.left + (chartArea.width * 0.8);  // 75% from left
      titleY = chartArea.top + (chartArea.height * 0.05);   // 70% from top
    }
    if (isLandData) {
      title = 'Land Surface Temperature';
    } else if (isOceanData) {
      title = 'Ocean Surface Temperature';
    }
    
    // Draw title background for better readability
    const titleMetrics = ctx.measureText(title);
    const padding = 12;
    const bgX = titleX - (titleMetrics.width / 2) - padding;
    const bgY = titleY - 12 - padding;
    const bgWidth = titleMetrics.width + (padding * 2);
    const bgHeight = 24 + (padding * 2);
    
    ctx.fillStyle = 'transparent';
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    
    
    
    // Draw title text with safe color handling
    let titleColor = '#1a365d'; // Default fallback color
    if (dataset.borderColor) {
      if (typeof dataset.borderColor === 'string') {
        titleColor = dataset.borderColor;
        // Only modify if it contains rgba
        if (titleColor.includes('rgba')) {
          titleColor = titleColor.replace(/0\.4/g, '0.9').replace(/0\.6/g, '1.0');
        }
      }
    }
    if (isLandData) {
      titleColor = 'rgba(74, 85, 104, 0.6)' ;
    } else if (isOceanData) {
      titleColor = '#1a365d';
    }
    
    ctx.fillStyle = titleColor;
    ctx.fillText(title, titleX, titleY);
    
    ctx.restore();
  },

  
};

// Register the plugin with a unique name
ChartJS.register(temperatureChartLabelsPlugin);

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
export const UnifiedTemperatureChart = ({ transparent = false }) => {
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
      borderColor: 'rgba(74, 85, 104, 0.4)', // Dark gray, more transparent
      backgroundColor: 'transparent',
      borderWidth: 7, 
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgba(74, 85, 104, 0.3)', 
      pointBorderColor: 'rgba(74, 85, 104, 0.3)', 
      pointBorderWidth: 2,
      pointHoverBorderWidth: 2,
      spanGaps: true
    });

    
  }

  // Add ocean temperature dataset with all available data
  if (sortedOceanData.length > 0) {
    datasets.push({
      label: 'Ocean Temperature (Annual)',
      data: yearLabels.map(year => {
        const dataPoint = sortedOceanData.find(d => d.Year === year);
        return dataPoint ? dataPoint.Annual_Temperature_C : null;
      }),
      borderColor: 'rgba(26,54,93, 0.6)', 
      backgroundColor: 'transparent',
      borderWidth: 7, 
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgba(26,54,93, 0.6)', 
      pointBorderColor: 'rgba(26,54,93, 0.6)', 
      pointBorderWidth: 2,
      pointHoverBorderWidth: 2,
      spanGaps: true
    });

    
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
        top: 2,    
        bottom: 2,
        left: 100,   
        right: 100   
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
      temperatureChartLabels: {
        enabled: true  // Explicitly enable our custom plugin for this chart only
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
    <div 
      className="united-temperature-chart"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: transparent ? 'transparent' : '#f4a261',
        borderRadius: transparent ? '0' : '12px',
        padding: '0', // Removed padding
        boxShadow: transparent ? 'none' : '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}
    >
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