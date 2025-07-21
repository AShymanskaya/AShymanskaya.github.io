import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const PacificHealthDashboard = ({ 
  dataFile = '/data/health_data.csv',
  transparent = false 
}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState(['All Countries']);
  const [currentView, setCurrentView] = useState('overview');
  const [currentIndicator, setCurrentIndicator] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, data: null, position: { x: 0, y: 0 } });

  const healthIndicators = {
    'Malaria incidence per 1,000 population at risk': {
      name: 'Malaria',
      category: 'Infectious Disease',
      unit: 'per 1,000 at risk',
      color: '#e53e3e',
      thresholds: { high: 100, medium: 50, low: 20 }
    },
    'Number of new HIV infections per 1,000 uninfected population': {
      name: 'HIV Infections',
      category: 'Infectious Disease', 
      unit: 'per 1,000 uninfected',
      color: '#c53030',
      thresholds: { high: 1, medium: 0.5, low: 0.1 }
    },
    'Tuberculosis incidence': {
      name: 'Tuberculosis',
      category: 'Infectious Disease',
      unit: 'per 100,000',
      color: '#f56565',
      thresholds: { high: 300, medium: 150, low: 50 }
    },
    'Mortality rate attributed to cardiovascular disease, cancer, diabetes or chronic respiratory disease': {
      name: 'NCDs Mortality',
      category: 'Non-Communicable Disease',
      unit: '% mortality rate',
      color: '#ed8936',
      thresholds: { high: 25, medium: 20, low: 15 }
    },
    'Mortality rate attributed to unsafe water, unsafe sanitation and lack of hygiene': {
      name: 'Water & Sanitation',
      category: 'Environmental Health',
      unit: 'per 100,000',
      color: '#38a169',
      thresholds: { high: 15, medium: 8, low: 3 }
    }
  };

  

  const allCountries = Object.keys(countryProfiles);

  useEffect(() => {
    loadHealthData();
  }, [dataFile]);

  useEffect(() => {
    if (Object.keys(data).length > 0 && !currentIndicator) {
      setCurrentIndicator(Object.keys(healthIndicators)[0]);
    }
  }, [data]);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      let csvContent = '';
      let dataLoaded = false;

      try {
        const response = await fetch(dataFile);
        if (response.ok) {
          csvContent = await response.text();
          dataLoaded = true;
        }
      } catch (err) {
        console.log('Could not load health data, using fallback');
      }

      let parsedData = [];
      
      if (dataLoaded && csvContent) {
        parsedData = Papa.parse(csvContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimitersToGuess: [',', '\t', '|', ';']
        }).data;
      }

      const processedData = {};

      Object.entries(healthIndicators).forEach(([indicator, config]) => {
        let indicatorData = [];
        
        if (parsedData.length > 0) {
          indicatorData = parsedData.filter(row => 
            row['Indicator'] === indicator &&
            row['OBS_VALUE'] !== null &&
            row['OBS_VALUE'] !== undefined &&
            !isNaN(row['OBS_VALUE']) &&
            row['TIME_PERIOD'] >= 2010
          );
        }

        // Fallback demo data if no real data
        if (indicatorData.length === 0) {
          indicatorData = generateFallbackData(indicator, config);
        }

        const countryStats = {};
        
        indicatorData.forEach(row => {
          const country = row['Pacific Island Countries and territories'] || row.country;
          const year = row['TIME_PERIOD'] || row.year;
          const value = parseFloat(row['OBS_VALUE'] || row.value);
          
          if (!countryStats[country]) {
            countryStats[country] = [];
          }
          countryStats[country].push({ year, value });
        });

        // Calculate trends and latest values
        Object.entries(countryStats).forEach(([country, values]) => {
          if (values.length > 0) {
            values.sort((a, b) => a.year - b.year);
            const latest = values[values.length - 1];
            const earliest = values[0];
            const trend = values.length > 1 ? 
              ((latest.value - earliest.value) / earliest.value) * 100 : 0;
            
            countryStats[country] = {
              country,
              latest: latest.value,
              trend,
              dataPoints: values.length,
              latestYear: latest.year,
              earliestYear: earliest.year,
              severity: getSeverityLevel(config, latest.value),
              allValues: values,
              profile: countryProfiles[country] || { population: 0, region: 'Unknown', income: 'Unknown' }
            };
          }
        });

        processedData[indicator] = countryStats;
      });

      setData(processedData);
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackData = (indicator, config) => {
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
    const fallbackData = [];
    
    allCountries.forEach(country => {
      years.forEach(year => {
        let baseValue = 0;
        
        // Generate realistic values based on indicator type
        switch(config.name) {
          case 'Malaria':
            baseValue = country === 'Papua New Guinea' ? 150 : 
                      country === 'Solomon Islands' ? 90 : 
                      country === 'Vanuatu' ? 40 : Math.random() * 10;
            break;
          case 'HIV Infections':
            baseValue = country === 'Papua New Guinea' ? 0.9 : Math.random() * 0.5;
            break;
          case 'Tuberculosis':
            baseValue = country === 'Marshall Islands' ? 480 :
                      country === 'Kiribati' ? 300 :
                      country === 'Papua New Guinea' ? 400 : Math.random() * 150 + 50;
            break;
          case 'NCDs Mortality':
            baseValue = Math.random() * 10 + 15;
            break;
          case 'Water & Sanitation':
            baseValue = Math.random() * 20;
            break;
        }
        
        // Add year variation
        const variation = (Math.random() - 0.5) * 0.2;
        const value = baseValue * (1 + variation);
        
        fallbackData.push({
          'Pacific Island Countries and territories': country,
          'TIME_PERIOD': year,
          'OBS_VALUE': Math.max(0, value)
        });
      });
    });
    
    return fallbackData;
  };

  const getSeverityLevel = (config, value) => {
    if (value >= config.thresholds.high) return 'high';
    if (value >= config.thresholds.medium) return 'medium';
    if (value >= config.thresholds.low) return 'low';
    return 'minimal';
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'linear-gradient(135deg, #c53030, #e53e3e)';
      case 'medium': return 'linear-gradient(135deg, #ed8936, #f6ad55)';
      case 'low': return 'linear-gradient(135deg, #f6ad55, #fbd38d)';
      case 'minimal': return 'linear-gradient(135deg, #38a169, #48bb78)';
      default: return 'linear-gradient(135deg, #718096, #a0aec0)';
    }
  };

  const getTrendIcon = (trend) => {
    if (trend < -5) return <span className="text-green-400 font-bold">↓</span>;
    if (trend > 5) return <span className="text-red-400 font-bold">↑</span>;
    return <span className="text-yellow-400 font-bold">→</span>;
  };

  const formatValue = (indicator, value) => {
    const config = healthIndicators[indicator];
    if (!config) return value.toString();
    
    if (config.unit === 'per 1,000 at risk' || config.unit === 'per 1,000 uninfected') {
      return `${value.toFixed(2)}`;
    } else if (config.unit === 'per 100,000') {
      return `${Math.round(value)}`;
    } else if (config.unit === '% mortality rate') {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(1);
  };

  const getFilteredCountries = () => {
    if (selectedCountries.includes('All Countries')) {
      return allCountries;
    }
    return selectedCountries;
  };

  const getOverviewData = () => {
    const overview = [];
    const countries = getFilteredCountries();
    
    Object.entries(healthIndicators).forEach(([indicator, config]) => {
      const indicatorData = data[indicator] || {};
      const countryValues = countries
        .map(country => indicatorData[country])
        .filter(Boolean);
      
      if (countryValues.length > 0) {
        const avgValue = countryValues.reduce((sum, item) => sum + item.latest, 0) / countryValues.length;
        const avgTrend = countryValues.reduce((sum, item) => sum + item.trend, 0) / countryValues.length;
        const highRisk = countryValues.filter(item => item.severity === 'high').length;
        
        overview.push({
          indicator,
          config,
          avgValue,
          avgTrend,
          highRisk,
          totalCountries: countryValues.length,
          severity: getSeverityLevel(config, avgValue)
        });
      }
    });
    
    return overview;
  };

  const renderOverview = () => {
    const overviewData = getOverviewData();
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {overviewData.map(({ indicator, config, avgValue, avgTrend, highRisk, totalCountries }) => (
            <div 
              key={indicator}
              className="bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 rounded-lg p-4 cursor-pointer hover:bg-opacity-20 transition-all duration-300"
              onClick={() => {
                setCurrentIndicator(indicator);
                setCurrentView('detailed');
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{config.name}</h3>
                <div className="flex items-center gap-2">
                  {getTrendIcon(avgTrend)}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    highRisk > totalCountries / 2 ? 'bg-red-500' : 
                    highRisk > 0 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {highRisk} high risk
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-80">Average:</span>
                  <span className="text-sm font-mono">{formatValue(indicator, avgValue)} {config.unit}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-80">Trend:</span>
                  <span className={`text-sm font-mono ${
                    avgTrend > 0 ? 'text-red-300' : avgTrend < 0 ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    {avgTrend > 0 ? '+' : ''}{avgTrend.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-80">Countries:</span>
                  <span className="text-sm">{totalCountries}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetailed = () => {
    if (!currentIndicator || !data[currentIndicator]) return null;

    const indicatorData = data[currentIndicator];
    const config = healthIndicators[currentIndicator];
    const countries = getFilteredCountries();
    
    const countryValues = countries
      .map(country => indicatorData[country])
      .filter(Boolean);

    let sortedData = [...countryValues];
    
    switch(sortBy) {
      case 'latest':
        sortedData.sort((a, b) => b.latest - a.latest);
        break;
      case 'trend':
        sortedData.sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
        break;
      case 'improving':
        sortedData.sort((a, b) => a.trend - b.trend);
        break;
      case 'population':
        sortedData.sort((a, b) => b.profile.population - a.profile.population);
        break;
    }

    const maxValue = Math.max(...sortedData.map(item => item.latest));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{config.name}</h3>
            <p className="text-sm opacity-80">{config.category} • {config.unit}</p>
          </div>
          
          <div className="flex gap-2">
            {['latest', 'trend', 'improving', 'population'].map(sort => (
              <button
                key={sort}
                className={`px-3 py-1 text-xs rounded-full transition-all ${
                  sortBy === sort 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-white bg-opacity-10 hover:bg-opacity-20'
                }`}
                onClick={() => setSortBy(sort)}
              >
                {sort === 'latest' ? 'Highest' : 
                 sort === 'trend' ? 'Most Change' :
                 sort === 'improving' ? 'Most Improved' : 'Population'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedData.map((item, index) => {
            const barWidth = Math.max(20, (item.latest / maxValue) * 300);
            
            return (
              <div key={item.country} className="flex items-center gap-4 p-3 bg-white bg-opacity-5 rounded-lg hover:bg-opacity-10 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs opacity-60 w-6">{index + 1}</span>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{item.country}</span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(item.trend)}
                        <span className="text-xs opacity-80">{item.profile.region}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ 
                          width: `${barWidth}px`,
                          background: getSeverityColor(item.severity),
                          minWidth: '60px'
                        }}
                      >
                        <span className="text-white text-xs font-mono">
                          {formatValue(currentIndicator, item.latest)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs opacity-80">
                        <span>{item.trend > 0 ? '+' : ''}{item.trend.toFixed(1)}%</span>
                        <span>•</span>
                        <span>{(item.profile.population / 1000).toFixed(0)}k pop</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full h-96 bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading Pacific health data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${transparent ? 'bg-transparent' : 'bg-gradient-to-br from-blue-900 to-blue-700'} rounded-lg overflow-hidden`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-white border-opacity-20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌏</span>
              <div>
                <h1 className="text-xl font-bold text-white">Pacific Health Overview</h1>
                <p className="text-sm text-blue-200">Regional health indicators & trends</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Country Selector */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 rounded-lg text-white hover:bg-opacity-20 transition-all"
                  onClick={() => setShowCountrySelector(!showCountrySelector)}
                >
                  <span className="text-sm">
                    {selectedCountries.length === 1 && selectedCountries[0] === 'All Countries' 
                      ? 'All Countries' 
                      : selectedCountries.length === 1 
                        ? selectedCountries[0]
                        : `${selectedCountries.length} countries`}
                  </span>
                  <span className="text-white">▼</span>
                </button>
                
                {showCountrySelector && (
                  <div className="absolute top-full right-0 mt-2 w-80 max-h-80 overflow-y-auto bg-white bg-opacity-95 backdrop-blur-sm border border-white border-opacity-30 rounded-lg shadow-xl z-10">
                    <div className="p-3 border-b border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCountries.includes('All Countries')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCountries(['All Countries']);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="font-medium text-gray-800">All Countries</span>
                      </label>
                    </div>
                    
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                      {allCountries.map(country => (
                        <label key={country} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCountries.includes(country) && !selectedCountries.includes('All Countries')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newSelection = selectedCountries.filter(c => c !== 'All Countries');
                                if (!newSelection.includes(country)) {
                                  newSelection.push(country);
                                }
                                setSelectedCountries(newSelection);
                              } else {
                                setSelectedCountries(selectedCountries.filter(c => c !== country));
                              }
                            }}
                            className="rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800 text-sm">{country}</div>
                            <div className="text-xs text-gray-500">
                              {countryProfiles[country]?.region} • {(countryProfiles[country]?.population / 1000).toFixed(0)}k pop
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* View Toggle */}
              <div className="flex bg-white bg-opacity-10 rounded-lg overflow-hidden">
                <button
                  className={`px-4 py-2 text-sm transition-all ${
                    currentView === 'overview' 
                      ? 'bg-white bg-opacity-20 text-white' 
                      : 'text-blue-200 hover:text-white hover:bg-opacity-10'
                  }`}
                  onClick={() => setCurrentView('overview')}
                >
                  Overview
                </button>
                <button
                  className={`px-4 py-2 text-sm transition-all ${
                    currentView === 'detailed' 
                      ? 'bg-white bg-opacity-20 text-white' 
                      : 'text-blue-200 hover:text-white hover:bg-opacity-10'
                  }`}
                  onClick={() => setCurrentView('detailed')}
                >
                  Detailed
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto text-white">
          {currentView === 'overview' ? renderOverview() : renderDetailed()}
        </div>

        {/* Footer Info */}
        <div className="border-t border-white border-opacity-20 p-4">
          <div className="flex items-center justify-between text-sm text-blue-200">
            <div className="flex items-center gap-4">
              <span>Data: 2010-2022</span>
              <span>•</span>
              <span>{getFilteredCountries().length} countries selected</span>
              <span>•</span>
              <span>{Object.keys(healthIndicators).length} health indicators</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs">High Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-xs">Medium Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs">Low Risk</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close country selector */}
      {showCountrySelector && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowCountrySelector(false)}
        />
      )}
    </div>
  );
};

export default PacificHealthDashboard;