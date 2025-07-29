import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';

const EnhancedFoodInsecurityChart = ({ transparent = false }) => {
  const [data, setData] = useState([]);
  const [fishingData, setFishingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('agriculture'); // 'agriculture' or 'fishing'
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const colors = {
    primaryDeepBlue:'#1a365d',
    low: '#60a5fa',      // Light blue
    medium: '#3b82f6',   // Blue
    high: '#f59e0b',     // Amber
    veryHigh: '#dc2626', // Red
    noData: '#ffffff',   // Gray
    text: '#374151',     // Dark gray
    textLight: '#6b7280', // Medium gray
    background: '#ffffff',
    backgroundGradient: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)', // White to gray gradient
    border: '#e5e7eb'    // Light border
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if ((data.length > 0 && viewMode === 'agriculture') || (fishingData.length > 0 && viewMode === 'fishing')) {
      loadChartJS();
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, fishingData, viewMode]);

  const loadChartJS = () => {
    if (window.Chart) {
      createChart();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
    script.onload = () => {
      // Load the datalabels plugin after Chart.js
      const datalabelsScript = document.createElement('script');
      datalabelsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js';
      datalabelsScript.onload = () => {
        createChart();
      };
      datalabelsScript.onerror = () => {
        // Create chart without labels if plugin fails to load
        createChart();
      };
      document.head.appendChild(datalabelsScript);
    };
    script.onerror = () => {
      setError(new Error('Failed to load Chart.js'));
    };
    document.head.appendChild(script);
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const loadFishingData = async () => {
    try {
      let csvContent = '';
      
      try {
        const response = await fetch('/data/fishing_total.csv');
        if (response.ok) {
          csvContent = await response.text();
        } else {
          console.log('Fishing CSV not found, creating sample data');
        }
      } catch (fetchError) {
        console.log('Fetch failed for fishing data, using sample');
      }
      
      // Parse CSV data
      const lines = csvContent.trim().split('\n');
      const headers = parseCSVLine(lines[0]);
      
      const allData = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCSVLine(lines[i]);
          const row = {};
          
          headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
          });
          
          // Filter for valid fishing data
          if (row.OBS_VALUE !== null && 
              row.OBS_VALUE !== undefined && 
              row.OBS_VALUE !== '' && 
              !isNaN(row.OBS_VALUE) &&
              row['Pacific Island Countries and territories'] !== null &&
              row['Pacific Island Countries and territories'] !== undefined &&
              row.INDICATOR === 'PERCENT') {
            allData.push(row);
          }
        }
      }
      
      // Group data by region and get latest data
      const regionData = {};
      
      allData.forEach(row => {
        const geoCode = row.GEO_PICT;
        const regionName = row['Pacific Island Countries and territories'];
        const year = parseInt(row.TIME_PERIOD);
        const percentage = parseFloat(row.OBS_VALUE);
        
        if (!regionData[geoCode] || regionData[geoCode].year < year) {
          regionData[geoCode] = {
            name: regionName,
            geoCode: geoCode,
            fishingPercentage: percentage,
            year: year
          };
        }
      });
      
      return Object.values(regionData);
      
    } catch (error) {
      console.error('Error loading fishing data:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      let csvContent = '';
      let dataLoaded = false;

      // Try to load real data first
      try {
        const response = await fetch('/data/alevi.csv');
        if (response.ok) {
          csvContent = await response.text();
          dataLoaded = true;
        }
      } catch (err) {
        console.log('CSV file not found, using sample data');
      }

      // Load agriculture data
      if (dataLoaded) {
        const parsed = Papa.parse(csvContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        if (parsed.errors.length > 0) {
          console.warn('CSV parsing warnings:', parsed.errors);
        }

        setData(parsed.data);
      }

      // Load fishing data
      const fishingDataResult = await loadFishingData();
      setFishingData(fishingDataResult);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const isValidNumber = (value) => {
    return value != null && !isNaN(value) && isFinite(value);
  };

  const getColor = (foodInsecurity) => {
    if (!isValidNumber(foodInsecurity)) return colors.noData;
    if (foodInsecurity < 20) return colors.low;
    if (foodInsecurity < 35) return colors.medium;
    if (foodInsecurity < 50) return colors.high;
    return colors.veryHigh;
  };

  const createChart = () => {
    if (!canvasRef.current || !window.Chart) {
      return;
    }

    const ctx = canvasRef.current.getContext('2d');

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    let processedData = [];

    if (viewMode === 'agriculture') {
      // Agriculture view (bubble chart) - Only include points with valid AEVI and ALEVI data
      processedData = data
        .filter(country => isValidNumber(country.AEVI) && isValidNumber(country.ALEVI))
        .map(country => {
          const aevi = country.AEVI;
          const alevi = country.ALEVI;
          const foodInsecurity = isValidNumber(country.food_insecurity) ? country.food_insecurity : null;
          
          return {
            x: aevi,
            y: alevi,
            r: foodInsecurity ? Math.max(6, Math.sqrt(foodInsecurity) * 2.5) : 6,
            label: country['Pacific Island Countries and territories'] || 'Unknown',
            foodInsecurity: foodInsecurity,
            hasData: true, // All points now have data since we filtered them
            hasFoodInsecurityData: isValidNumber(foodInsecurity)
          };
        });
    } else {
      // Fishing view (horizontal bar chart with food insecurity bubbles)
      const mergedData = fishingData.map(fishingCountry => {
        const matchingAgData = data.find(agCountry => 
          agCountry['Pacific Island Countries and territories'] === fishingCountry.name
        );
        
        return {
          name: fishingCountry.name,
          fishingPercentage: fishingCountry.fishingPercentage,
          foodInsecurity: matchingAgData && isValidNumber(matchingAgData.food_insecurity) 
            ? matchingAgData.food_insecurity : null
        };
      });

      // Sort by fishing percentage
      mergedData.sort((a, b) => b.fishingPercentage - a.fishingPercentage);

      processedData = mergedData.map((country, index) => ({
        x: country.fishingPercentage,
        y: index,
        r: country.foodInsecurity ? Math.max(8, Math.sqrt(country.foodInsecurity) * 3) : 8,
        label: country.name,
        foodInsecurity: country.foodInsecurity,
        fishingPercentage: country.fishingPercentage,
        hasFoodInsecurityData: isValidNumber(country.foodInsecurity)
      }));
    }

    if (processedData.length === 0) {
      setError(new Error('No valid data found'));
      return;
    }

    // Remove the custom point style plugin since we no longer have points without data
    const chartConfig = {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Countries',
          data: processedData,
          backgroundColor: processedData.map(d => getColor(d.foodInsecurity) + 'CC'),
          borderColor: processedData.map(d => getColor(d.foodInsecurity)),
          borderWidth: 0,
          hoverBackgroundColor: processedData.map(d => getColor(d.foodInsecurity)),
          hoverBorderWidth: 0
        }]
      },
      plugins: window.ChartDataLabels ? [] : [],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 20,
            left: 10,
            right: viewMode === 'fishing' ? 40 : 60
          }
        },
        interaction: {
          mode: 'point',
          intersect: true
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: colors.background,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.border,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            titleFont: {
              size: 14,
              weight: '600'
            },
            bodyFont: {
              size: 12
            },
            // Show tooltip for all points now, but customize based on available data
            callbacks: {
              title: function(context) {
                if (context && context.length > 0 && context[0].raw) {
                  return context[0].raw.label;
                }
                return '';
              },
              label: function(context) {
                if (!context || !context.raw) return [];
                
                const dataPoint = context.raw;
                const labels = [];
                
                if (viewMode === 'agriculture') {
                  labels.push(`AEVI: ${dataPoint.x.toFixed(1)}`);
                  labels.push(`ALEVI: ${dataPoint.y.toFixed(1)}`);
                } else {
                  labels.push(`Fishing Families: ${dataPoint.fishingPercentage.toFixed(1)}%`);
                }
                
                if (dataPoint.foodInsecurity !== null) {
                  labels.push(`Food Insecurity: ${dataPoint.foodInsecurity.toFixed(1)}%`);
                } else {
                  labels.push('Food Insecurity: No data');
                }
                
                return labels;
              }
            }
          },
          datalabels: window.ChartDataLabels ? {
            display: true, // Show all labels since all points have valid coordinate data
            align: function(context) {
              const dataIndex = context.dataIndex;
              const datasetIndex = context.datasetIndex;
              const chart = context.chart;
              const data = chart.data;
              const dataset = data.datasets[datasetIndex];
              
              if (viewMode === 'fishing') {
                // For fishing, always align to the left of bubble
                return 'left';
              }
              
              // For agriculture view, use a radial distribution pattern
              const totalPoints = dataset.data.length;
              const angle = (dataIndex / totalPoints) * 2 * Math.PI - Math.PI / 2;
              
              // Determine alignment based on angle
              if (angle >= -Math.PI/4 && angle < Math.PI/4) return 'top';
              if (angle >= Math.PI/4 && angle < 3*Math.PI/4) return 'right';
              if (angle >= 3*Math.PI/4 || angle < -3*Math.PI/4) return 'bottom';
              return 'left';
            },
            anchor: function(context) {
              if (viewMode === 'fishing') {
                return 'end';
              }
              
              // For agriculture, anchor to edge of bubble
              const dataIndex = context.dataIndex;
              const totalPoints = context.dataset.data.length;
              const angle = (dataIndex / totalPoints) * 2 * Math.PI - Math.PI / 2;
              
              if (angle >= -Math.PI/4 && angle < Math.PI/4) return 'bottom';
              if (angle >= Math.PI/4 && angle < 3*Math.PI/4) return 'left';
              if (angle >= 3*Math.PI/4 || angle < -3*Math.PI/4) return 'top';
              return 'right';
            },
            offset: function(context) {
              const value = context.dataset.data[context.dataIndex];
              if (viewMode === 'fishing') {
                // Fixed offset for fishing view
                return 8;
              }
              // Larger offset for agriculture to prevent overlap
              return Math.max(8, value.r + 8);
            },
            color: colors.text,
            font: {
              size: viewMode === 'fishing' ? 11 : 9,
              weight: '500'
            },
            formatter: function(value, context) {
              // For fishing view, show country name directly on the row
              if (viewMode === 'fishing') {
                return value.label;
              }
              // For agriculture, use abbreviated names if needed
              const label = value.label;
              if (label.length > 15) {
                return label.substring(0, 12) + '...';
              }
              return label;
            },
            clip: false,
            clamp: false,
            textAlign: viewMode === 'fishing' ? 'right' : 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 4,
            borderWidth: 1,
            padding: {
              top: 2,
              right: 4,
              bottom: 2,
              left: 4
            }
          } : {}
        },
        scales: viewMode === 'agriculture' ? {
          // Agriculture scales - show labels and values but no lines
          x: {
            type: 'linear',
            min: -0.5,
            max: 9,
            title: {
              display: true,
              text: 'Agricultural Employment vs Agricultural Land Ratio (AEVI)',
              color: colors.text,
              font: {
                size: 13,
                weight: '500'
              }
            },
            grid: {
              display: false // No grid lines
            },
            border: {
              color: 'rgba(0, 0, 0, 0.5)',
            },
            ticks: {
              color: 'rgba(0, 0, 0, 0.5)',
              font: {
                size: 14
              },
              maxTicksLimit: 8,
              callback: function(value) {
                // Only show positive values
                return value >= 0 ? value : '';
              }
            }
          },
          y: {
            type: 'linear',
            min: -1,
            max: 9,
            title: {
              display: true,
              text: 'Agriculture Contribution to GDP vs Agricultural Land (ALEVI)',
              color: colors.text,
              font: {
                size: 13,
                weight: '500'
              }
            },
            grid: {
              display: false 
            },
            border: {
              display: false 
            },
            ticks: {
              color: 'rgba(0, 0, 0, 0.5)',
              font: {
                size: 14
              },
              maxTicksLimit: 8,
              callback: function(value) {
                // Only show positive values
                return value >= 0 ? value : '';
              }
            }
          }
        } : {
          // Fishing scales
          x: {
            type: 'linear',
            min: 5,
            max: 60,
            title: {
              display: true,
              text: '% of Families Involved in Fishing',
              color: colors.text,
              font: {
                size: 13,
                weight: '500'
              }
            },
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              color: 'rgba(0, 0, 0, 0.5)',
              font: {
                size: 14
              },
              callback: function(value) {
                return value + '%';
              }
            }
          },
          y: {
            display: false // Hide y-axis completely for fishing view
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutCubic'
        }
      }
    };

    // Register the datalabels plugin if available
    if (window.ChartDataLabels) {
      window.Chart.register(window.ChartDataLabels);
    }

    chartRef.current = new window.Chart(ctx, chartConfig);
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Toggle clicked, current viewMode:', viewMode);
    setViewMode(prevMode => {
      const newMode = prevMode === 'agriculture' ? 'fishing' : 'agriculture';
      console.log('Switching to:', newMode);
      return newMode;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        Loading data...
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-center">
        <div>
          <p className="font-medium text-red-500 mb-1">Error loading data</p>
          <p className="text-sm">Please ensure data files are available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`food-insecurity-chart ${transparent ? 'transparent-bg' : ''}`}>
      <style jsx>{`
        .food-insecurity-chart {
          background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
          border-radius: 16px;
          padding: 2px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .food-insecurity-chart.transparent-bg {
          background: transparent;
          box-shadow: none;
          border: none;
          backdrop-filter: none;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-shrink: 0;
          position: relative;
          z-index: 100;
        }

        .toggle-button {
          background: #1a365d !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 16px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
          position: relative !important;
          z-index: 999999 !important;
          outline: none !important;
          pointer-events: auto !important;
          user-select: none !important;
          touch-action: manipulation !important;
        }

        .toggle-button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
        }

        .toggle-button:active {
          transform: translateY(0px) !important;
          box-shadow: 0 1px 4px rgba(102, 126, 234, 0.3) !important;
        }

        .chart-title-spacer {
          flex: 1;
        }

        .chart-canvas {
          position: relative;
          width: 100%;
          flex: 1;
          min-height: 0;
          z-index: 1;
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 12px;
          bottom: 100px !important;
          flex-wrap: wrap;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }

        .legend.legend-fishing {
          position: absolute;
          right:0px !important;
          bottom: 400px !important;
          margin: 0;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: 'rgba(255, 255, 255, 0.85)',
          ;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid;
        }

        .legend-square {
          width: 12px;
          height: 12px;
          border: 1px solid;
        }
      `}</style>

      <div className="chart-header">
        <div className="chart-title-spacer"></div>
        <button 
          className="toggle-button"
          onClick={handleToggle}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          type="button"
        >
          {viewMode === 'agriculture' ? 'View Fishing Data' : 'View Agriculture Data'}
        </button>
      </div>

      <div className="chart-canvas">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className={`legend ${viewMode === 'fishing' ? 'legend-fishing' : ''}`}>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: colors.low, borderColor: colors.low}}></div>
          <span>Low (&lt;20%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: colors.medium, borderColor: colors.medium}}></div>
          <span>Med (20-35%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: colors.high, borderColor: colors.high}}></div>
          <span>High (35-50%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: colors.veryHigh, borderColor: colors.veryHigh}}></div>
          <span>V.High (&gt;50%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: colors.noData, borderColor: colors.noData}}></div>
          <span>No Food Insecurity Data</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFoodInsecurityChart;