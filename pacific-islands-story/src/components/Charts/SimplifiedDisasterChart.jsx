import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import Papa from 'papaparse';
import _ from 'lodash';

const SimplifiedDisasterChart = () => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [climateData, setClimateData] = useState([]);
  const [error, setError] = useState(null);

  // Climate indicators
  const PEOPLE_INDICATOR = 'VC_DSR_AFFCT';
  const ECONOMIC_INDICATOR = 'VC_DSR_LSGP'; // Economic loss as % of GDP

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
    'WS': 'Samoa',
    'Australia': 'Australia',
    'China': 'China',
    'India': 'India',
    'Indonesia': 'Indonesia',
    'Japan': 'Japan',
    'Philippines': 'Philippines',
    'Thailand': 'Thailand',
    'United States': 'United States',
    'Bangladesh': 'Bangladesh',
    'Myanmar': 'Myanmar',
    'Vietnam': 'Vietnam'
  };

  // Color palette matching the design system
  const disasterColors = {
    'Earthquake': '#ed8936',
    'Storm': '#3182ce',
    'Flood': '#2b6cb0',
    'Drought': '#f6ad55',
    'Cyclone': '#1a365d',
    'Wildfire': '#38a169',
    'Tsunami': '#319795',
    'Volcanic activity': '#fbd38d',
    'Landslide': '#4a5568',
    'Epidemic': '#718096',
    'Extreme temperature': '#a0aec0',
    'Mass movement (dry)': '#cbd5e0',
    'Insect infestation': '#e2e8f0'
  };

  const createChart = (data) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Process data to get country-disaster type matrix and human loss
    const countryData = {};
    const allDisasterTypes = new Set();

    data.forEach(d => {
      const country = d['Country'];
      const disasterType = d['Disaster Type'];
      const deaths = parseInt(d['Total Deaths']) || 0;
      const affected = parseInt(d['Total Affected']) || 0;
      const damage = parseFloat(d["'Total Damage (''000 US$)'"]) || 0;
      
      // Use both people and economic indicators from climate data
      const peopleAffectedClimate = d.peopleAffectedClimate || 0;
      const economicLossClimate = d.economicLossGDP || 0;
      const hasClimateData = d.hasClimateData || false;

      if (country && disasterType && (deaths > 0 || affected > 0 || damage > 0)) {
        if (!countryData[country]) {
          countryData[country] = {
            disasters: {},
            totalDeaths: 0,
            totalAffected: 0,
            totalDamage: 0,
            climateHumanLoss: 0,
            climateEconomicLoss: 0,
            hasClimateData: false
          };
        }

        allDisasterTypes.add(disasterType);
        countryData[country].disasters[disasterType] = 
          (countryData[country].disasters[disasterType] || 0) + 1;
        countryData[country].totalDeaths += deaths;
        countryData[country].totalAffected += affected;
        countryData[country].totalDamage += damage;
        countryData[country].peopleAffectedClimate = Math.max(countryData[country].peopleAffectedClimate, peopleAffectedClimate);
        countryData[country].economicLossGDP = Math.max(countryData[country].economicLossGDP, economicLossClimate);
        countryData[country].hasClimateData = countryData[country].hasClimateData || (peopleAffectedClimate > 0 || economicLossClimate > 0);
      }
    });

    // Sort countries by total disasters (ascending order, top 12)
    const sortedCountries = Object.keys(countryData)
      .sort((a, b) => {
        const totalA = Object.values(countryData[a].disasters).reduce((sum, val) => sum + val, 0);
        const totalB = Object.values(countryData[b].disasters).reduce((sum, val) => sum + val, 0);
        return totalA - totalB; // Changed from totalB - totalA for ascending order
      })
      .slice(0, 12);

    // Sort disaster types by frequency (top 8)
    const disasterTypeFrequency = {};
    Array.from(allDisasterTypes).forEach(type => {
      disasterTypeFrequency[type] = 0;
      sortedCountries.forEach(country => {
        disasterTypeFrequency[type] += countryData[country].disasters[type] || 0;
      });
    });

    const sortedDisasterTypes = Object.entries(disasterTypeFrequency)
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type)
      .slice(0, 8);

    // Create datasets for each disaster type with NEGATIVE values to mirror
    const datasets = sortedDisasterTypes.map(disasterType => {
      const data = sortedCountries.map(country => 
        -(countryData[country].disasters[disasterType] || 0) // Negative values for mirroring
      );

      return {
        label: disasterType,
        data: data,
        backgroundColor: disasterColors[disasterType] || '#718096',
        borderWidth: 0,
        borderRadius: 4,
        maxBarThickness: 30
      };
    });

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedCountries,
        datasets: datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 200,
            bottom: 20,
            left: 20,
            right: 200 // Back to right side for true mirroring
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 15,
              font: {
                size: 11,
                weight: '500'
              },
              color: '#ffffff'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            titleColor: '#1a365d',
            bodyColor: '#2d3748',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              title: function(context) {
                const country = context[0].label;
                const humanLoss = countryData[country];
                return `${country}`;
              },
              afterTitle: function(context) {
                const country = context[0].label;
                const countryInfo = countryData[country];
                
                let lines = [
                  `Total Affected: ${countryInfo.totalAffected.toLocaleString()}`,
                  `Damage: ${(countryInfo.totalDamage / 1000).toFixed(1)}M USD`
                ];
                
                if (countryInfo.hasEconomicData) {
                  lines.push('--- Economic Impact (Climate Data) ---');
                  lines.push(`GDP Loss: ${countryInfo.economicLossGDP.toFixed(2)}% of GDP`);
                }
                
                return lines;
              },
              label: function(context) {
                const disasterType = context.dataset.label;
                const count = Math.abs(context.parsed.x); // Show positive value in tooltip
                return count > 0 ? `${disasterType}: ${count} disasters` : null;
              }
            },
            filter: function(tooltipItem) {
              return Math.abs(tooltipItem.parsed.x) > 0;
            }
          }
        },
        scales: {
          x: {
            display: false,  // This hides the entire x-axis including ticks and labels
            stacked: true,
            beginAtZero: true,
            max: 0, // Set maximum to 0 so bars extend leftward
            ticks: {
              stepSize: 1,
              font: { size: 10, weight: '500' },
              color: '#e2e8f0',
              callback: function(value) {
                return Math.abs(value); // Show positive values on axis
              }
            },
            grid: {
              display: true,
              color: 'rgba(255, 255, 255, 0.1)'
            },
            border: { display: false },
            title: {
              display: false,
              text: 'Number of Disasters',
              color: '#ffffff',
              font: { size: 12, weight: '600' },
              padding: { top: 10 }
            }
          },
          y: {
            stacked: true,
            ticks: {
              font: { size: 11, weight: '500' },
              color: '#ffffff'
            },
            grid: {
              display: false
            },
            border: { display: false }
          }
        },
        animation: {
          duration: 1200,
          easing: 'easeOutQuart'
        },
        onHover: (event, activeElements) => {
          event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: [{
        id: 'humanLossLabels',
        afterDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          
          chart.data.labels.forEach((country, index) => {
            // Calculate the minimum x position (leftmost bar end) for this country
            let minX = Infinity;
            let hasData = false;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
              const meta = chart.getDatasetMeta(datasetIndex);
              const bar = meta.data[index];
              if (bar && Math.abs(dataset.data[index]) > 0) {
                minX = Math.min(minX, bar.x);
                hasData = true;
              }
            });
            
            if (hasData) {
              const countryInfo = countryData[country];
              const x = chart.chartArea.right + 15; // Position labels to the right of chart area
              const meta = chart.getDatasetMeta(0);
              const bar = meta.data[index];
              const y = bar.y;
              
              // Display economic impact data
              const hasEconomicData = countryInfo.hasEconomicData;
              
              // Draw economic loss as % of GDP
              if (hasEconomicData) {
                ctx.fillStyle = '#dc2626';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`📊 ${countryInfo.economicLossGDP.toFixed(2)}% GDP`, x, y - 8);
              }
              
              // Draw total damage in USD
              ctx.fillStyle = hasEconomicData ? '#dc6a02' : '#ea580c';
              ctx.font = '10px Arial';
              ctx.fillText(`💰 ${(countryInfo.totalDamage / 1000).toFixed(1)}M`, x, y + 8);
            }
          });
        }
      }]
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to read both CSV files
        let disasterCsvText = '';
        let climateCsvText = '';
        let disasterDataLoaded = false;
        let climateDataLoaded = false;

        // Load disasters_overview.csv
        try {
          disasterCsvText = await window.fs.readFile('/data/disasters_overview.csv', { encoding: 'utf8' });
          disasterDataLoaded = true;
        } catch (fsError) {
          try {
            const response = await fetch('/data/disasters_overview.csv');
            if (response.ok) {
              disasterCsvText = await response.text();
              disasterDataLoaded = true;
            }
          } catch (fetchError) {
            console.log('Could not load disasters_overview.csv with either method');
          }
        }

        // Load climate.csv
        try {
          climateCsvText = await window.fs.readFile('/data/climate.csv', { encoding: 'utf8' });
          climateDataLoaded = true;
        } catch (fsError) {
          try {
            const response = await fetch('/data/climate.csv');
            if (response.ok) {
              climateCsvText = await response.text();
              climateDataLoaded = true;
            }
          } catch (fetchError) {
            console.log('Could not load climate.csv with either method');
          }
        }

        if (disasterDataLoaded) {
          // Parse disaster CSV data
          const disasterParsed = Papa.parse(disasterCsvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          });

          let combinedData = disasterParsed.data;

          // If climate data is available, process it for specific indicators
          if (climateDataLoaded) {
            const climateParsed = Papa.parse(climateCsvText, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              delimitersToGuess: [',', '\t', '|', ';']
            });

            setClimateData(climateParsed.data);

            // Create climate indicators lookup by country
            const climateByCountry = {};
            climateParsed.data.forEach(row => {
              if (row.GEO_PICT && row.INDICATOR && row.value) {
                const country = row.GEO_PICT;
                const indicator = row.INDICATOR;
                const value = parseFloat(row.value) || 0;
                
                if (!climateByCountry[country]) {
                  climateByCountry[country] = {};
                }
                
                if (!climateByCountry[country][indicator]) {
                  climateByCountry[country][indicator] = [];
                }
                
                climateByCountry[country][indicator].push(value);
              }
            });

            // Enhance disaster data with both people and economic indicators from climate data
            combinedData = disasterParsed.data.map(disaster => {
              const country = disaster.Country;
              const climateCountryData = climateByCountry[country] || climateByCountry[COUNTRY_CODES[country]] || {};
              
              // Get people affected from climate data (VC_DSR_AFFCT)
              const peopleAffectedClimate = climateCountryData[PEOPLE_INDICATOR] ? 
                Math.max(...climateCountryData[PEOPLE_INDICATOR]) : 0;
              
              // Get economic loss from climate data (VC_DSR_LSGP) - as % of GDP
              const economicLossClimate = climateCountryData[ECONOMIC_INDICATOR] ? 
                Math.max(...climateCountryData[ECONOMIC_INDICATOR]) : 0;
              
              return {
                ...disaster,
                peopleAffectedClimate: peopleAffectedClimate,
                economicLossGDP: economicLossClimate,
                hasClimateData: peopleAffectedClimate > 0 || economicLossClimate > 0
              };
            });
          }

          setAllData(combinedData);
        } else {
          throw new Error('Could not load disaster data file');
        }
        
      } catch (err) {
        setError(`Error loading data: ${err.message}`);
        console.error('Error loading data:', err);
        
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!loading && allData.length > 0) {
      createChart(allData);
    }
  }, [allData, loading]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #3182ce 0%, #60a5fa 50%, #93c5fd 100%)'
      }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-white font-medium">Loading disaster data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #3182ce 0%, #60a5fa 50%, #93c5fd 100%)'
      }}>
        <div className="text-center">
          <div className="text-lg text-white mb-2">Failed to load disaster data</div>
          <div className="text-blue-200">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen p-6" style={{
      background: 'linear-gradient(135deg, #3182ce 0%, #60a5fa 50%, #93c5fd 100%)'
    }}>
      
      {/* Chart Container */}
      <div className="rounded-xl shadow-xl p-6 h-5/6" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="h-full">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        
        {/* Legend for climate data indicators */}
        <div className="flex justify-center mt-4 space-x-6 text-sm text-blue-50">
          <div className="flex items-center">
            <span className="mr-1 text-green-400">👥</span>
            <span>People Affected (* = Climate Data VC_DSR_AFFCT)</span>
          </div>
          <div className="flex items-center">
            <span className="mr-1 text-red-400">📊</span>
            <span>Economic Loss (* = Climate Data % of GDP)</span>
          </div>
          <div className="flex items-center">
            <span className="mr-1 text-orange-400">💰</span>
            <span>Total Damage (Million USD)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedDisasterChart;