import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const HumanLossDisastersChart = () => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const PEOPLE_INDICATOR = 'VC_DSR_AFFCT';
  const ECONOMIC_INDICATOR = 'VC_DSR_LSGP';
  
  // Country code mappings
  const COUNTRY_CODES = {
    'CK': 'Cook Islands',
    'FJ': 'Fiji',
    'FM': 'Federated States of Micronesia',
    'KI': 'Kiribati',
    'MH': 'Marshall Islands',
    'NR': 'Nauru',
    'NC': 'New Caledonia',
    'NU': 'Niue',
    'PF': 'French Polynesia',
    'PG': 'Papua New Guinea',
    'PW': 'Palau',
    'SB': 'Solomon Islands',
    'TO': 'Tonga',
    'TV': 'Tuvalu',
    'VU': 'Vanuatu',
    'WS': 'Samoa'
  };

  // Updated color palettes using the provided theme
  const HUMAN_COLORS = [
    'rgba(56, 161, 105, 0.8)',   // --accent-green
    'rgba(49, 151, 149, 0.8)',   // --accent-teal
    'rgba(49, 130, 206, 0.8)',   // --primary-light
    'rgba(43, 108, 176, 0.8)',   // --primary-ocean
    'rgba(56, 161, 105, 0.6)',   // --accent-green lighter
    'rgba(49, 151, 149, 0.6)',   // --accent-teal lighter
    'rgba(49, 130, 206, 0.6)',   // --primary-light lighter
    'rgba(43, 108, 176, 0.6)',   // --primary-ocean lighter
    'rgba(56, 161, 105, 0.9)',   // --accent-green darker
    'rgba(49, 151, 149, 0.9)',   // --accent-teal darker
    'rgba(49, 130, 206, 0.9)',   // --primary-light darker
    'rgba(43, 108, 176, 0.9)',   // --primary-ocean darker
    'rgba(26, 54, 93, 0.8)',     // --primary-deep-blue
    'rgba(26, 54, 93, 0.6)',     // --primary-deep-blue lighter
    'rgba(26, 54, 93, 0.9)',     // --primary-deep-blue darker
    'rgba(113, 128, 150, 0.8)'   // --neutral-600
  ];

  const ECONOMIC_COLORS = [
    'rgba(237, 137, 54, 0.8)',   // --accent-coral
    'rgba(246, 173, 85, 0.8)',   // --accent-warm
    'rgba(251, 211, 141, 0.8)',  // --accent-light
    'rgba(237, 137, 54, 0.9)',   // --accent-coral darker
    'rgba(246, 173, 85, 0.9)',   // --accent-warm darker
    'rgba(251, 211, 141, 0.9)',  // --accent-light darker
    'rgba(237, 137, 54, 0.6)',   // --accent-coral lighter
    'rgba(246, 173, 85, 0.6)',   // --accent-warm lighter
    'rgba(251, 211, 141, 0.6)',  // --accent-light lighter
    'rgba(237, 137, 54, 0.7)',   // --accent-coral medium
    'rgba(246, 173, 85, 0.7)',   // --accent-warm medium
    'rgba(251, 211, 141, 0.7)',  // --accent-light medium
    'rgba(26, 32, 44, 0.8)',     // --neutral-900
    'rgba(45, 55, 72, 0.8)',     // --neutral-800
    'rgba(74, 85, 104, 0.8)',    // --neutral-700
    'rgba(113, 128, 150, 0.8)'   // --neutral-600
  ];

  const getCountryDataByYear = (data, indicator) => {
    const countryYearData = {};
    
    data.filter(row => row.INDICATOR === indicator).forEach(row => {
      if (row.TIME_PERIOD && row.value && !isNaN(parseFloat(row.value)) && row.GEO_PICT) {
        const country = row.GEO_PICT;
        const year = parseInt(row.TIME_PERIOD);
        const value = parseFloat(row.value);
        
        if (!countryYearData[country]) {
          countryYearData[country] = {};
        }
        countryYearData[country][year] = value;
      }
    });
    
    return countryYearData;
  };

  const createStackedDatasets = (countryYearData, colors, isEconomic = false) => {
    const datasets = [];
    const countries = Object.keys(countryYearData);
    
    // Get all unique years across all countries
    const allYears = new Set();
    countries.forEach(country => {
      Object.keys(countryYearData[country]).forEach(year => {
        allYears.add(parseInt(year));
      });
    });
    const sortedYears = Array.from(allYears).sort();
    
    countries.forEach((country, index) => {
      const countryData = countryYearData[country];
      const dataPoints = sortedYears.map(year => {
        let value = countryData[year] || 0;
        // Scale economic data by 1000 to make 1% = 1000 units
        if (isEconomic && value !== 0) {
          value = value * 1000;
        }
        // Make economic values negative for bottom stacking
        if (isEconomic) {
          value = -value;
        }
        return {
          x: year,
          y: value
        };
      });
      
      if (dataPoints.some(point => point.y !== 0)) {
        datasets.push({
          label: COUNTRY_CODES[country] || country,
          data: dataPoints,
          backgroundColor: colors[index % colors.length],
          borderColor: colors[index % colors.length].replace(/0\.\d+/, '1'),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          stack: isEconomic ? 'economic' : 'people',
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors[index % colors.length].replace(/0\.\d+/, '1'),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1
        });
      }
    });
    
    return datasets;
  };

  const addCustomLabels = (ctx, years, peopleData, economicData) => {
    if (!chartRef.current) return;
    
    const chart = chartRef.current;
    const chartArea = chart.chartArea;
    
    ctx.save();
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#f7fafc';
    ctx.textAlign = 'center';
    
    // Add year labels
    years.forEach(year => {
      const xPos = chart.scales.x.getPixelForValue(year);
      if (xPos >= chartArea.left && xPos <= chartArea.right) {
        ctx.fillText(year.toString(), xPos, chartArea.bottom + 20);
      }
    });
    
    // Add max people affected label
    let maxPeople = 0;
    let maxPeopleYear = 0;
    Object.keys(peopleData).forEach(country => {
      Object.entries(peopleData[country]).forEach(([year, value]) => {
        if (value > maxPeople) {
          maxPeople = value;
          maxPeopleYear = parseInt(year);
        }
      });
    });
    
    if (maxPeople > 0) {
      const xPos = chart.scales.x.getPixelForValue(maxPeopleYear);
      const yPos = chart.scales.y.getPixelForValue(maxPeople);
      ctx.fillStyle = '#38a169';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`${maxPeople.toLocaleString()}`, xPos, yPos - 10);
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText('people affected', xPos, yPos + 5);
    }
    
    // Add max economic loss label
    let maxEconomic = 0;
    let maxEconomicYear = 0;
    Object.keys(economicData).forEach(country => {
      Object.entries(economicData[country]).forEach(([year, value]) => {
        if (value > maxEconomic) {
          maxEconomic = value;
          maxEconomicYear = parseInt(year);
        }
      });
    });
    
    if (maxEconomic > 0) {
      const xPos = chart.scales.x.getPixelForValue(maxEconomicYear);
      const yPos = chart.scales.y.getPixelForValue(-maxEconomic * 1000);
      ctx.fillStyle = '#ed8936';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillText(`${maxEconomic.toFixed(1)}%`, xPos, yPos + 25);
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText('GDP lost', xPos, yPos + 40);
    }
    
    ctx.restore();
  };

  const createChart = (data) => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Get country data by year for both indicators
    const peopleCountryData = getCountryDataByYear(data, PEOPLE_INDICATOR);
    const economicCountryData = getCountryDataByYear(data, ECONOMIC_INDICATOR);

    const datasets = [];

    // Add people affected datasets (positive values, stacked)
    const peopleDatasets = createStackedDatasets(peopleCountryData, HUMAN_COLORS, false);
    datasets.push(...peopleDatasets);

    // Add economic loss datasets (negative values, stacked)
    const economicDatasets = createStackedDatasets(economicCountryData, ECONOMIC_COLORS, true);
    datasets.push(...economicDatasets);

    if (datasets.length === 0) {
      setError('No data available for the indicators');
      return;
    }

    // Get year range for labels
    const allYears = new Set();
    datasets.forEach(dataset => {
      dataset.data.forEach(point => {
        if (point.y !== 0) allYears.add(point.x);
      });
    });
    const yearRange = Array.from(allYears).sort();

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
          line: {
            tension: 0.4
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1a365d',
            bodyColor: '#1a365d',
            borderColor: '#cbd5e0',
            borderWidth: 1,
            cornerRadius: 12,
            titleFont: {
              family: 'Inter, system-ui, sans-serif',
              size: 13,
              weight: '600'
            },
            bodyFont: {
              family: 'Inter, system-ui, sans-serif',
              size: 12
            },
            padding: 12,
            filter: function(tooltipItem) {
              // Only show tooltip items that have actual data (non-zero values)
              return tooltipItem.parsed.y !== 0;
            },
            callbacks: {
              title: function(context) {
                return `Year: ${context[0].parsed.x}`;
              },
              label: function(context) {
                const value = context.parsed.y;
                const country = context.dataset.label;
                
                if (value > 0) {
                  return `${country}: ${Math.abs(value).toLocaleString()} people affected`;
                } else if (value < 0) {
                  return `${country}: ${(Math.abs(value) / 100).toFixed(2)}% of GDP lost`;
                }
                // This case should never be reached due to the filter above
                return null;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            display: false
          },
          y: {
            stacked: true,
            display: false
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        animation: {
          duration: 2500,
          easing: 'easeOutQuart',
          onComplete: function() {
            // Add custom labels after animation
            addCustomLabels(ctx, yearRange, peopleCountryData, economicCountryData);
          }
        }
      }
    });
  };

  const loadData = async () => {
    try {
      console.log('Loading climate CSV file...');
      
      let csvText = '';
      
      // Try multiple approaches to load the data
      try {
        if (window.fs && window.fs.readFile) {
          csvText = await window.fs.readFile('/data/climate.csv', { encoding: 'utf8' });
          console.log('Successfully loaded via window.fs.readFile');
        } else {
          throw new Error('window.fs not available');
        }
      } catch (fsError) {
        console.log('window.fs.readFile failed:', fsError.message);
        
        try {
          const response = await fetch('/data/climate.csv');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          csvText = await response.text();
          console.log('Successfully loaded via fetch');
        } catch (fetchError) {
          console.log('Fetch failed:', fetchError.message);
          throw new Error('Unable to load CSV file');
        }
      }
      
      if (!csvText) {
        throw new Error('No CSV data available');
      }
      
      // Parse CSV data
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',');
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        return row;
      });
      
      console.log(`Data loaded: ${data.length} records`);
      createChart(data);
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error Loading Data</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-screen overflow-hidden relative"
      style={{
        backgroundColor: '#e2e8f0'
      }}
    >
      

      

      {/* Loading Indicator */}
      {loading && (
        <div 
          className="absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <div 
            className="text-center p-8 rounded-2xl backdrop-blur-md border"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#f7fafc'
            }}
          >
            <div 
              className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderTopColor: '#f7fafc'
              }}
            />
            <p 
              className="text-xl font-medium"
              style={{ 
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            >
              Loading disaster impact data...
            </p>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full h-full pt-32 pb-16 px-12">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default HumanLossDisastersChart;