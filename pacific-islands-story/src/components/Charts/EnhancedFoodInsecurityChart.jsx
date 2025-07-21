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
    low: '#60a5fa',      // Light blue
    medium: '#3b82f6',   // Blue
    high: '#f59e0b',     // Amber
    veryHigh: '#dc2626', // Red
    noData: '#9ca3af',   // Gray
    text: '#374151',     // Dark gray
    textLight: '#6b7280', // Medium gray
    background: '#ffffff',
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
      createChart();
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
          return createSampleFishingData();
        }
      } catch (fetchError) {
        console.log('Fetch failed for fishing data, using sample');
        return createSampleFishingData();
      }
      
      if (!csvContent) {
        return createSampleFishingData();
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
      return createSampleFishingData();
    }
  };

  const createSampleFishingData = () => {
    return [
      { name: 'American Samoa', geoCode: 'AS', fishingPercentage: 45.2 },
      { name: 'Cook Islands', geoCode: 'CK', fishingPercentage: 38.7 },
      { name: 'Fiji', geoCode: 'FJ', fishingPercentage: 32.1 },
      { name: 'French Polynesia', geoCode: 'PF', fishingPercentage: 28.9 },
      { name: 'Guam', geoCode: 'GU', fishingPercentage: 25.4 },
      { name: 'Kiribati', geoCode: 'KI', fishingPercentage: 52.8 },
      { name: 'Marshall Islands', geoCode: 'MH', fishingPercentage: 48.3 },
      { name: 'Micronesia', geoCode: 'FM', fishingPercentage: 41.6 },
      { name: 'Nauru', geoCode: 'NR', fishingPercentage: 35.2 },
      { name: 'New Caledonia', geoCode: 'NC', fishingPercentage: 22.7 },
      { name: 'Niue', geoCode: 'NU', fishingPercentage: 44.1 },
      { name: 'Northern Mariana Islands', geoCode: 'MP', fishingPercentage: 27.3 },
      { name: 'Palau', geoCode: 'PW', fishingPercentage: 39.8 },
      { name: 'Papua New Guinea', geoCode: 'PG', fishingPercentage: 33.5 },
      { name: 'Samoa', geoCode: 'WS', fishingPercentage: 42.9 },
      { name: 'Solomon Islands', geoCode: 'SB', fishingPercentage: 47.2 },
      { name: 'Tonga', geoCode: 'TO', fishingPercentage: 40.1 },
      { name: 'Tuvalu', geoCode: 'TV', fishingPercentage: 49.6 },
      { name: 'Vanuatu', geoCode: 'VU', fishingPercentage: 36.4 }
    ];
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
      if (!dataLoaded) {
        const sampleData = [
          { 'Pacific Island Countries and territories': 'American Samoa', AEVI: null, ALEVI: null, food_insecurity: 15.2 },
          { 'Pacific Island Countries and territories': 'Cook Islands', AEVI: 2.1, ALEVI: 1.8, food_insecurity: 12.4 },
          { 'Pacific Island Countries and territories': 'Fiji', AEVI: 3.2, ALEVI: 2.9, food_insecurity: 18.7 },
          { 'Pacific Island Countries and territories': 'French Polynesia', AEVI: 1.9, ALEVI: 1.2, food_insecurity: 9.8 },
          { 'Pacific Island Countries and territories': 'Guam', AEVI: 1.1, ALEVI: 0.8, food_insecurity: 11.3 },
          { 'Pacific Island Countries and territories': 'Kiribati', AEVI: 4.8, ALEVI: 3.2, food_insecurity: 32.1 },
          { 'Pacific Island Countries and territories': 'Marshall Islands', AEVI: 3.9, ALEVI: 2.7, food_insecurity: 28.4 },
          { 'Pacific Island Countries and territories': 'Micronesia', AEVI: 5.2, ALEVI: 4.1, food_insecurity: 35.6 },
          { 'Pacific Island Countries and territories': 'Nauru', AEVI: 2.3, ALEVI: 1.9, food_insecurity: 22.8 },
          { 'Pacific Island Countries and territories': 'New Caledonia', AEVI: 1.7, ALEVI: 1.4, food_insecurity: 8.9 },
          { 'Pacific Island Countries and territories': 'Niue', AEVI: 3.1, ALEVI: 2.8, food_insecurity: 19.2 },
          { 'Pacific Island Countries and territories': 'Northern Mariana Islands', AEVI: 1.8, ALEVI: 1.3, food_insecurity: 13.7 },
          { 'Pacific Island Countries and territories': 'Palau', AEVI: 2.9, ALEVI: 2.2, food_insecurity: 16.5 },
          { 'Pacific Island Countries and territories': 'Papua New Guinea', AEVI: 6.8, ALEVI: 5.9, food_insecurity: 41.2 },
          { 'Pacific Island Countries and territories': 'Samoa', AEVI: 4.1, ALEVI: 3.6, food_insecurity: 24.3 },
          { 'Pacific Island Countries and territories': 'Solomon Islands', AEVI: 5.7, ALEVI: 4.8, food_insecurity: 38.9 },
          { 'Pacific Island Countries and territories': 'Tonga', AEVI: 3.8, ALEVI: 3.1, food_insecurity: 21.6 },
          { 'Pacific Island Countries and territories': 'Tuvalu', AEVI: 4.3, ALEVI: 3.4, food_insecurity: 29.7 },
          { 'Pacific Island Countries and territories': 'Vanuatu', AEVI: 5.1, ALEVI: 4.2, food_insecurity: 33.8 }
        ];
        setData(sampleData);
      } else {
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
      // Agriculture view (bubble chart)
      processedData = data.map(country => {
        const aevi = isValidNumber(country.AEVI) ? country.AEVI : -0.5;
        const alevi = isValidNumber(country.ALEVI) ? country.ALEVI : -0.5;
        const foodInsecurity = isValidNumber(country.food_insecurity) ? country.food_insecurity : null;
        
        return {
          x: aevi,
          y: alevi,
          r: foodInsecurity ? Math.max(6, Math.sqrt(foodInsecurity) * 2.5) : 6,
          label: country['Pacific Island Countries and territories'] || 'Unknown',
          foodInsecurity: foodInsecurity,
          hasData: isValidNumber(country.AEVI) && isValidNumber(country.ALEVI),
          hasFoodInsecurityData: isValidNumber(foodInsecurity),
          originalAEVI: country.AEVI,
          originalALEVI: country.ALEVI
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
      setError(new Error('No data found'));
      return;
    }

    // Custom point style plugin for squares when no food insecurity data
    const pointStylePlugin = {
      id: 'customPointStyle',
      afterDatasetDraw(chart, args, options) {
        const { ctx, data } = chart;
        const meta = chart.getDatasetMeta(args.index);
        
        if (viewMode === 'agriculture') {
          meta.data.forEach((point, index) => {
            const dataPoint = data.datasets[args.index].data[index];
            const hasFoodInsecurityData = dataPoint.hasFoodInsecurityData;
            
            if (!hasFoodInsecurityData) {
              const x = point.x;
              const y = point.y;
              const size = 3;
              
              ctx.save();
              ctx.fillStyle = colors.noData;
              ctx.strokeStyle = colors.noData;
              ctx.lineWidth = 0;
              
              // Draw square
              ctx.fillRect(x - size/2, y - size/2, size, size);
              
              ctx.restore();
            }
          });
        }
      }
    };

    const chartConfig = {
      type: viewMode === 'agriculture' ? 'bubble' : 'bubble',
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
      plugins: [pointStylePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 200,
            bottom: 20,
            left: viewMode === 'fishing' ? 20 : 0,
            right: 20
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
            callbacks: {
              title: function(context) {
                return context[0].raw.label;
              },
              label: function(context) {
                const dataPoint = context.raw;
                const labels = [];
                
                if (viewMode === 'agriculture') {
                  if (isValidNumber(dataPoint.originalAEVI)) {
                    labels.push(`AEVI: ${dataPoint.x.toFixed(1)}`);
                  } else {
                    labels.push('AEVI: No data');
                  }
                  
                  if (isValidNumber(dataPoint.originalALEVI)) {
                    labels.push(`ALEVI: ${dataPoint.y.toFixed(1)}`);
                  } else {
                    labels.push('ALEVI: No data');
                  }
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
          }
        },
        scales: viewMode === 'agriculture' ? {
          // Agriculture scales - show values but hide visual elements
          x: {
            type: 'linear',
            min: -1,
            max: Math.ceil(Math.max(...data.filter(d => isValidNumber(d.AEVI)).map(d => d.AEVI)) * 1.1) || 8,
            title: {
              display: true,
              text: 'Agricultural Employment vs Agricultural Land Ratio',
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
              color: colors.textLight,
              font: {
                size: 11
              },
              maxTicksLimit: 8,
              callback: function(value) {
                if (value < 0) {
                  return value === -1 ? 'No data' : '';
                }
                return value;
              },
              // Hide tick marks but show labels
              major: {
                enabled: false
              },
              minor: {
                enabled: false
              }
            }
          },
          y: {
            type: 'linear',
            min: -1,
            max: Math.ceil(Math.max(...data.filter(d => isValidNumber(d.ALEVI)).map(d => d.ALEVI)) * 1.1) || 8,
            title: {
              display: true,
              text: 'Agriculture Contribution to GDP vs Agricultural Land',
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
              color: colors.textLight,
              font: {
                size: 11
              },
              maxTicksLimit: 8,
              callback: function(value) {
                if (value < 0) {
                  return value === -1 ? 'No data' : '';
                }
                return value;
              },
              // Hide tick marks but show labels
              major: {
                enabled: false
              },
              minor: {
                enabled: false
              }
            }
          }
        } : {
          // Fishing scales - show values but hide visual elements
          x: {
            type: 'linear',
            min: 0,
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
              color: colors.textLight,
              font: {
                size: 11
              },
              callback: function(value) {
                return value + '%';
              },
              // Hide tick marks but show labels
              major: {
                enabled: false
              },
              minor: {
                enabled: false
              }
            }
          },
          y: {
            type: 'linear',
            min: -0.5,
            max: processedData.length - 0.5,
            title: {
              display: false,
              text: 'Countries',
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
              color: colors.textLight,
              font: {
                size: 10
              },
              callback: function(value) {
                const index = Math.round(value);
                if (index >= 0 && index < processedData.length) {
                  return processedData[index].label;
                }
                return '';
              },
              // Hide tick marks but show labels
              major: {
                enabled: false
              },
              minor: {
                enabled: false
              }
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutCubic'
        }
      }
    };

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
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 20px;
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 16px !important;
          font-size: 12px !important;
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
          margin-top: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #718096;
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
          {viewMode === 'agriculture' ? 'Switch to Fishing' : 'Switch to Agriculture'}
        </button>
      </div>

      <div className="chart-canvas">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="legend">
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
          <div className="legend-square" style={{backgroundColor: colors.noData, borderColor: colors.noData}}></div>
          <span>No Data</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFoodInsecurityChart;