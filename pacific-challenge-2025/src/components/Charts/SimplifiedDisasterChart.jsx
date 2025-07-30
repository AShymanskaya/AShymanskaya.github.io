import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';

const countryMapping = {
  'CK': 'Cook Islands', 'FJ': 'Fiji', 'FM': 'Micronesia', 'KI': 'Kiribati',
  'MH': 'Marshall Islands', 'NC': 'New Caledonia', 'NR': 'Nauru', 'NU': 'Niue',
  'PF': 'French Polynesia', 'PG': 'Papua New Guinea', 'PW': 'Palau',
  'SB': 'Solomon Islands', 'TO': 'Tonga', 'TV': 'Tuvalu', 'VU': 'Vanuatu', 'WS': 'Samoa'
};

const SimplifiedDisasterChart = () => {
  const [data, setData] = useState([]);
  const [rawDisasters, setRawDisasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const colors = {
    primaryDeepBlue: '#1a365d',
    primaryOcean: '#2b6cb0',
    primaryLight: '#3182ce',
    accentCoral: '#ed8936',
    accentWarm: '#f6ad55',
    accentLight: '#fbd38d',
    accentGreen: '#38a169',
    accentTeal: '#319795',
    dangerRed: '#c53030',
    warningOrange: '#dd6b20',
    neutral700: '#4a5568',
    neutral300: '#e2e8f0',
    white: '#ffffff'
  };

  const loadCSVFile = async (filename) => {
    try {
      if (window.fs && window.fs.readFile) {
        return await window.fs.readFile(filename, { encoding: 'utf8' });
      } else {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
      }
    } catch (error) {
      throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Starting data load process...');
        
        let climateData, disastersData;
        
        try {
          const climateText = await loadCSVFile(`${process.env.PUBLIC_URL}/data/climate.csv`);
          const disastersText = await loadCSVFile(`${process.env.PUBLIC_URL}/data/disasters_overview.csv`);
          
          const parsedClimate = Papa.parse(climateText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
          });
          
          const parsedDisasters = Papa.parse(disastersText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: ['\t', ',', '|', ';']
          });

          console.log('Loaded climate data:', parsedClimate.data.length, 'rows');
          console.log('Loaded disaster data:', parsedDisasters.data.length, 'rows');
          
          climateData = parsedClimate.data;
          disastersData = parsedDisasters.data;
          
        } catch (loadError) {
          console.error('Error loading CSV files:', loadError);
          throw loadError;
        }

        const disastersByCountry = _.groupBy(disastersData, (row) => {
          // Handle special case for Micronesia
          if (row.Country === 'Micronesia (Federated States of)') {
            return 'Micronesia';
          }
          return row.Country;
        });
        
        const disasterAffectedData = {};
        climateData
          .filter(row => row.INDICATOR === 'VC_DSR_AFFCT' && row.GEO_PICT && row.value !== null && row.value !== undefined)
          .forEach(row => {
            const countryCode = row.GEO_PICT;
            const value = parseFloat(row.value) || 0;
            const year = parseInt(row.TIME_PERIOD) || null;
            
            if (!disasterAffectedData[countryCode]) {
              disasterAffectedData[countryCode] = {
                totalValue: 0,
                years: [],
                yearCount: 0,
                minYear: year,
                maxYear: year
              };
            }
            
            disasterAffectedData[countryCode].totalValue += value;
            disasterAffectedData[countryCode].years.push({ year, value });
            disasterAffectedData[countryCode].yearCount++;
            disasterAffectedData[countryCode].minYear = Math.min(disasterAffectedData[countryCode].minYear, year);
            disasterAffectedData[countryCode].maxYear = Math.max(disasterAffectedData[countryCode].maxYear, year);
          });

        const combinedData = [];
        
        Object.keys(countryMapping).forEach(countryCode => {
          const countryName = countryMapping[countryCode];
          const disasters = disastersByCountry[countryName] || [];
          
          const climateAffected = disasterAffectedData[countryCode]?.totalValue || 0;
          const climateAffectedYearRange = disasterAffectedData[countryCode] ? 
            `${disasterAffectedData[countryCode].minYear}-${disasterAffectedData[countryCode].maxYear}` : null;
          const climateAffectedYearCount = disasterAffectedData[countryCode]?.yearCount || 0;
          
          const historicalAffected = _.sumBy(disasters, row => Number(row['Total Affected']) || 0);
          const totalDeaths = _.sumBy(disasters, row => Number(row['Total Deaths']) || 0);
          
          const disasterTypes = [...new Set(disasters
            .map(d => d['Disaster Type'])
            .filter(Boolean)
          )];

          const finalAffected = climateAffected || historicalAffected;
          
          console.log(`Processing ${countryName} (${countryCode}): climate=${climateAffected}, historical=${historicalAffected}, final=${finalAffected}`);
          
          if (finalAffected > 0 || disasters.length > 0) {
            combinedData.push({
              country: countryName,
              countryCode: countryCode,
              totalAffected: finalAffected,
              climateDataYearRange: climateAffectedYearRange,
              climateAffectedYears: climateAffectedYearCount,
              disasterFrequency: disasters.length,
              totalDeaths: totalDeaths,
              historicalAffected: historicalAffected,
              mainDisasters: disasterTypes.slice(0, 3),
              dataSource: climateAffected > 0 ? 'climate_indicators' : 'historical_records'
            });
          }
        });

        const filteredData = combinedData.filter(item => item.totalAffected > 0);

        console.log('Combined data for', filteredData.length, 'countries');
        console.log('All countries processed:');
        combinedData.forEach(item => {
          console.log(`- ${item.country}: ${item.totalAffected} affected (climate: ${item.climateDataYearRange ? 'YES' : 'NO'}, historical: ${item.historicalAffected})`);
        });
        console.log('Filtered data:');
        filteredData.forEach(item => {
          console.log(`- ${item.country}: ${item.totalAffected} affected`);
        });
        setData(filteredData);
        
        // Also set the raw disasters data for the disaster types chart
        setRawDisasters(disastersData);
        
      } catch (error) {
        setError(error);
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        width: '1000px',
        margin: '0 auto',
        padding: '20px', 
        textAlign: 'center', 
        color: colors.primaryDeepBlue,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          border: '3px solid rgba(26, 54, 93, 0.3)',
          borderTop: `3px solid ${colors.primaryDeepBlue}`,
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px auto'
        }} />
        <div>Loading Pacific Islands climate and disaster data...</div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div style={{ 
        width: '900px',
        margin: '0 auto',
        padding: '40px', 
        textAlign: 'center', 
        color: colors.dangerRed,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'rgba(197, 48, 48, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(197, 48, 48, 0.2)',
          marginBottom: '20px'
        }}>
          <p><strong>Data Loading Error</strong></p>
          <p>Could not load climate.csv and disasters_overview.csv files.</p>
          <p>Please upload the required CSV files to use this visualization.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '1000px',
      margin: '0 auto',
      padding: '5px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: 'transparent'
    }}>
      
      <div style={{ 
        display: 'flex',
        gap: '5px'
      }}>
        {/* Left side - Two charts */}
        <div style={{ 
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
          <ButterflyChart data={data} colors={colors} />
          <DisasterTypesChart data={data} rawDisasters={rawDisasters} colors={colors} />
        </div>
        
        {/* Right side - Top 3 Countries */}
        <div style={{ width: '300px' }}>
          <TopCountriesComparisonChart data={data} colors={colors} />
        </div>
      </div>
    </div>
  );
};

// Butterfly Chart combining People Affected and Disaster Frequency
const ButterflyChart = ({ data, colors }) => {
  // Get top 10 countries by people affected
  const sortedByAffected = [...data].sort((a, b) => b.totalAffected - a.totalAffected).slice(0, 10);
  const maxAffected = Math.max(...sortedByAffected.map(d => d.totalAffected));
  const maxFreq = Math.max(...sortedByAffected.map(d => d.disasterFrequency));

  return (
    <div style={{ 
      backgroundColor: 'transparent', 
      padding: '20px', 
      borderRadius: '8px', 
    }}>
      <h3 style={{ color: colors.primaryDeepBlue, marginBottom: '20px', fontSize: '16px', textAlign: 'center' }}>
        People Affected vs Disaster Frequency
      </h3>
      
      {/* Headers */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 140px 1fr',
        marginBottom: '10px',
        fontSize: '12px',
        fontWeight: '600',
        color: colors.neutral700
      }}>
        <div style={{ textAlign: 'right', paddingRight: '10px' }}>
          People Affected
        </div>
        <div style={{ textAlign: 'center' }}>Country</div>
        <div style={{ paddingLeft: '10px' }}>
          Disaster Events
        </div>
      </div>

      {/* Data rows */}
      {sortedByAffected.map((item, index) => (
        <div key={index} style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 140px 1fr',
          alignItems: 'center',
          marginBottom: '8px',
          height: '24px'
        }}>
          {/* Left side - People Affected */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: colors.neutral700, minWidth: '35px', textAlign: 'right' }}>
                {item.totalAffected >= 1000 ? `${(item.totalAffected / 1000).toFixed(0)}k` : item.totalAffected}
              </span>
              <div
                style={{
                  height: '20px',
                  width: `${(item.totalAffected / maxAffected) * 180}px`,
                  backgroundColor: colors.primaryOcean,
                  borderRadius: '10px 0 0 10px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Center - Country name */}
          <div style={{ 
            minWidth: '140px',
            width: '140px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: colors.primaryDeepBlue,
            padding: '4px 8px',
            backgroundColor: 'rgba(248, 250, 252, 0.7)',
            borderRadius: '6px',
            flexShrink: 0
          }}>
            {item.country}
          </div>

          {/* Right side - Disaster Frequency */}
          <div style={{ paddingLeft: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  height: '20px',
                  width: `${(item.disasterFrequency / maxFreq) * 180}px`,
                  backgroundColor: colors.accentCoral,
                  borderRadius: '0 10px 10px 0',
                  transition: 'width 0.3s ease'
                }}
              />
              <span style={{ fontSize: '10px', color: colors.neutral700 }}>
                {item.disasterFrequency} events
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Chart 3: Disaster Types Distribution
const DisasterTypesChart = ({ data, rawDisasters, colors }) => {
  // Count disaster types from raw disasters data
  const disasterTypeCounts = {};
  
  // Check if rawDisasters exists and has data
  if (rawDisasters && rawDisasters.length > 0) {
    rawDisasters.forEach(disaster => {
      const disasterType = disaster['Disaster Type'];
      if (disasterType) {
        disasterTypeCounts[disasterType] = (disasterTypeCounts[disasterType] || 0) + 1;
      }
    });
  }
  
  // Sort by count descending
  const sortedDisasters = Object.entries(disasterTypeCounts)
    .sort(([,a], [,b]) => b - a);
  
  const maxCount = sortedDisasters.length > 0 ? Math.max(...Object.values(disasterTypeCounts)) : 1;
  const disasterColors = [
    colors.primaryOcean, colors.accentCoral, colors.accentGreen, colors.warningOrange,
    colors.accentTeal, colors.primaryLight, colors.accentWarm, colors.dangerRed
  ];

  // Debug logging
  console.log('Raw disasters count:', rawDisasters?.length);
  console.log('Disaster type counts:', disasterTypeCounts);

  return (
    <div style={{ 
      backgroundColor: 'transparent', 
      padding: '15px', 
      borderRadius: '8px', 
    }}>
      <h3 style={{ color: colors.primaryDeepBlue, marginBottom: '15px', fontSize: '16px' }}>
        Most Common Disaster Types
      </h3>
      <div>
        {sortedDisasters.length === 0 ? (
          <div style={{ fontSize: '12px', color: colors.neutral700 }}>
            No disaster type data available
          </div>
        ) : (
          sortedDisasters.map(([disaster, count], index) => (
            <div key={index} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '6px',
              gap: '8px'
            }}>
              <div style={{ 
                minWidth: '140px', 
                fontSize: '11px', 
                fontWeight: '600',
                color: colors.neutral700
              }}>
                {disaster}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    height: '20px',
                    width: `${(count / maxCount) * 140}px`,
                    minWidth: '30px',
                    backgroundColor: disasterColors[index % disasterColors.length],
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.white,
                    fontSize: '10px',
                    fontWeight: '600'
                  }}
                >
                  {count}
                </div>
                <span style={{ fontSize: '10px', color: colors.neutral700 }}>occurrences</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Top 3 Countries Comparison (Right panel)
const TopCountriesComparisonChart = ({ data, colors }) => {
  const topCountries = [...data].sort((a, b) => b.totalAffected - a.totalAffected).slice(0, 3);

  return (
    <div style={{ 
      backgroundColor: 'transparent', 
      padding: '15px', 
      borderRadius: '8px', 
      height: '100%'
    }}>
      <h3 style={{ color: colors.primaryDeepBlue, marginBottom: '15px', fontSize: '16px' }}>
        Top 3 Countries - Multi-Metric
      </h3>
      <div>
        {topCountries.map((item, index) => (
          <div key={index} style={{ 
            marginBottom: '15px',
            padding: '12px',
            backgroundColor: 'rgba(248, 250, 252, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.7)'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '700',
              color: colors.primaryDeepBlue,
              marginBottom: '10px'
            }}>
              {index + 1}. {item.country}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: colors.neutral700 }}>People Affected:</strong>
                <div style={{ 
                  color: colors.white, 
                  backgroundColor: colors.primaryOcean,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '600' 
                }}>
                  {item.totalAffected >= 1000 ? `${(item.totalAffected/1000).toFixed(0)}k` : item.totalAffected}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: colors.neutral700 }}>Disaster Events:</strong>
                <div style={{ 
                  color: colors.white,
                  backgroundColor: colors.accentCoral,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '600' 
                }}>
                  {item.disasterFrequency}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: colors.neutral700 }}>Total Deaths:</strong>
                <div style={{ 
                  color: colors.white,
                  backgroundColor: colors.dangerRed,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: '600' 
                }}>
                  {item.totalDeaths}
                </div>
              </div>
              <div style={{ marginTop: '4px' }}>
                <strong style={{ color: colors.neutral700 }}>Main Disaster Types:</strong>
                <div style={{ 
                  color: colors.accentGreen, 
                  fontWeight: '600', 
                  fontSize: '11px',
                  marginTop: '4px' 
                }}>
                  {item.mainDisasters.length > 0 ? item.mainDisasters.join(', ') : 'No specific types recorded'}
                </div>
              </div>
              {item.climateDataYearRange && (
                <div style={{ 
                  marginTop: '4px',
                  fontSize: '10px',
                  color: colors.neutral700,
                  fontStyle: 'italic'
                }}>
                  Data period: {item.climateDataYearRange}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimplifiedDisasterChart;