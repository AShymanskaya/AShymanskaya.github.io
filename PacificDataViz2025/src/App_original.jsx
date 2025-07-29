import React from 'react';
// Import CSS files 
import './App.css';
import './styles/variables.css';
import './styles/globals.css';
import './styles/charts.css';
import './styles/animations.css';

// Import individual components
import { ProgressBar } from './components/Navigation/NavigationComponents';
import Hero from './components/Hero/Hero';
import StorySection from './components/Story/StorySection';
import {UnifiedTemperatureChart} from './components/Charts/UnifiedTemperatureChart';
import PacificMap from './components/Charts/PacificMap';
import SeaLevelChart from './components/Charts/SeaLevelChart';
import SimplifiedDisasterChart from './components/Charts/SimplifiedDisasterChart';
import EnhancedFoodInsecurityChart from './components/Charts/EnhancedFoodInsecurityChart';
import NarrativeTransition from './components/Story/NarrativeTransition';
import PacificDiseasesDashboard from './components/Charts/PacificDiseasesDashboard';
import HelpFisheriesChart from './components/Charts/HelpFisheriesChart';
import RenewableEnergyChart from './components/Charts/RenewableEnergyChart';
import DisasterMitigationsChart from './components/Charts/DisasterMitigationsChart';
import InternetElectricityChart from './components/Charts/InternetElectricityChart';
import InfrastructureChart from './components/Charts/InfrastructureChart';
import HealthcareSanitationChart from './components/Charts/HealthcareSanitationChart';
import HealthcareChart from './components/Charts/HealthcareChart';

function App() {
  const handleScrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="App">
      <ProgressBar />
      
      <Hero onScrollToNext={handleScrollToSection} />
      
      {/* Blue Continent section with PacificMap as background */}
      <StorySection
          id="blue-continent"
          chapter="The Beginning"
          title="The Blue Pacific Continent"
          stats={[
            { number: '20%', label: "of Earth's ocean surface under their stewardship" },
            { number: '1%', label: 'of global emissions' }
          ]}
          className="story-blue-continent"
          backgroundChart={<PacificMap showTitle={false}/>}
          overlayElements={[
            {
              content: (
                <div style={{
                  background: 'transparent',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '30px',
                  boxShadow: 'none', 
                  border: 'none',    
                  maxWidth: '500px',
                  color: '#4a5568',
                  fontSize: '1.125rem',
                  lineHeight: 1.7
                }}>
                  14.2M Pacific Islanders live across 22 countries. From the coral atolls of Kiribati to the volcanic islands of Vanuatu, these communities have lived in harmony with the ocean for thousands of years. Their lives are deeply intertwined with the sea: fishing feeds families, coastal agriculture sustains communities, and traditional knowledge guides sustainable living practices that have endured for generations. 
                </div>
              ),
              bottom: '40px',
              right: '40px',
              width: '500px',
              height: 'auto',
              transparent: true 

            },
            {
              content: (
                <div style={{
                  background: 'transparent',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '30px',
                  boxShadow: 'none', 
                  border: 'none',    
                  maxWidth: '500px',
                  color: '#4a5568',
                  fontSize: '0.5rem',
                  fontStyle:'italic',
                  lineHeight: 1.7
                }}>
                  Map source: <a href="https://geojson-maps.kyd.au/" target="_blank" rel="noopener noreferrer"> https://geojson-maps.kyd.au/ </a>
                  Numbers in text: 2050 Strategy for the Blue Pacific Continent; population data:<a href=" https://stats.pacificdata.org/" target="_blank" rel="noopener noreferrer">  https://stats.pacificdata.org/ </a>, DF_POP_PROJ
                </div>
              ),
              bottom: '0px',
              left: '0px',
              width: '500px',
              height: 'auto',
              transparent: true 

            }
          ]}
        />

      
      {/* Sea Level section with SeaLevelChart as background */}
      <StorySection
        id="sea-level"
        chapter="Chapter 1"
        title="When the Ocean Rises"
        stats={[
          { number: '5mm/year', label: 'Regional sea level rise' },
          { number: '56%', label: 'Population within 5m of sea level' }
        ]}
        className="story-sea-level"
        backgroundChart={<SeaLevelChart transparent={false}/>}
        overlayElements={[
          {
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '30px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '1.125rem',
                lineHeight: 1.7
              }}>
           
Imagine waking up to find the ocean has crept closer to your home overnight. For Pacific Islanders, this isn't imagination—it's reality. Sea levels around their islands have been rising at 5mm per year, twice the global average.  Vulnerability score is calculated from the sea level rise and the proportion of population living in the zone 0-20 km to the sea.         </div>
            ),
            top: '200px',
            left: '0px',
            width: '400px',
            height: 'auto',
            transparent: true 

          },
          {
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '30px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '0.5rem',
                fontStyle:'italic',
                lineHeight: 1.7
              }}>
                Sea level source: Australian Government, Bureau of Meteorology, <a href="http://www.bom.gov.au/oceanography/projects/spslcmp/data/monthly.shtml" target="_blank" rel="noopener noreferrer"> http://www.bom.gov.au/oceanography/projects/spslcmp/data/monthly.shtml </a>. Rise rate estimated with linear regression.
                Coastal population source: <a href=" https://stats.pacificdata.org/" target="_blank" rel="noopener noreferrer">  https://stats.pacificdata.org/ </a>, SPC:DF_POP_LECZ(1.0)/LECZPOPAF
              </div>
            ),
            bottom: '0px',
            left: '0px',
            width: '500px',
            height: 'auto',
            transparent: true 

          }
        ]}
      />
      
      {/* Temperature section with TemperatureChart as background and OceanTemperatureChart as overlay */}
      <StorySection
        id="temperature"
        title="When the Temperatures Surge"
        stats={[
          { number: 'ca. +1°C', label: 'Ocean warming since 1981' },
          { number: 'ca. +1°C', label: 'Land temperature rise since 1876' }
        ]}
        className="story-temperature"
        backgroundChart={<UnifiedTemperatureChart />}
        overlayElements={[
          {
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '30px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '1.125rem',
                lineHeight: 1.7
              }}>
The Pacific Ocean is running a fever. Surface temperatures have climbed 2°C above normal, sending ripples through marine ecosystems that have supported Pacific communities for millennia.         </div>   ),
            bottom: '340px',
            left: '30px',
            width: '600px',
            height: 'auto',
            transparent: true 

          },
          {
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '0px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '0.5rem',
                fontStyle:'italic',
                lineHeight: 1.7
              }}>
                Land surface temperature source: Climate Data Portal, Berkeley Earth Temperature Record for Oceania  <a href="https://berkeleyearth.org/temperature-region/oceania" target="_blank" rel="noopener noreferrer"> https://berkeleyearth.org/temperature-region/oceania </a>
                Ocean surface temperature source: Copernicus Marine Service <a href=" https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_REP_OBSERVATIONS_010_011/description" target="_blank" rel="noopener noreferrer">  https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_REP_OBSERVATIONS_010_011/description </a>
              </div>
            ),
            bottom: '0px',
            left: '0px',
            width: '500px',
            height: 'auto',
            transparent: true 

          }
        ]}
      />
      
      
      {/* Disasters section with HumanLossDisastersChart as background */}
      <StorySection
        id="disasters"
        title="When Nature Unleashes Fury"
        backgroundChart={< SimplifiedDisasterChart />}
        stats={[
          { number: '198', label: 'Total disasters since 2000' },
          { number: '$856.6M', label: 'Economic loss since 2005' }
        ]}
        overlayElements={[
          {
            content: (
              <div style={{
                background: 'transparent',
                borderRadius: '20px',
                padding: '30px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
              }}>
Climate change doesn't just gradually warm the Pacific — it supercharges extreme weather.              </div>
            ),
            top: '300px',
            right: '0px',
            transparent:true
          },
          {
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '0px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '0.5rem',
                fontStyle:'italic',
                lineHeight: 1.7
              }}>
                Natural disasters data: EMDAT database  <a href="https://www.emdat.be/" target="_blank" rel="noopener noreferrer"> https://www.emdat.be/ </a>
                Blue Pacific 2050: Climate Change And Disasters (Thematic Area 5): indicators VC_DSR_AFFCT and VC_DSR_AALT.
              </div>
            ),
            bottom: '0px',
            left: '0px',
            width: '500px',
            height: 'auto',
            transparent: true 

          }
        ]}
      />
      
      <NarrativeTransition>
        As the environment transforms around them, Pacific Islander families face a critical question: How do you preserve a way of life when the very foundation of that life is changing?
      </NarrativeTransition>
      
      <StorySection
        id="livelihoods"
        chapter="Chapter 2"

        title="Livelihoods on the Line"
        backgroundChart={<EnhancedFoodInsecurityChart transparent={true} />}
        
        stats={[
          { number: '20%', label: 'families in agriculture      '},
          { number: '15%', label: 'average contribution of agriculture to GDP '  },
          { number: '24%', label: 'families in fishing '  },

        ]}
        overlayElements={[
          {
            content: (
              <div style={{
                background: 'transparent',
                padding: '30px',
                maxWidth: '500px'
              }}>
                
                <p style={{ color: '#4a5568', lineHeight: 1.7 }}>
                  Rising seas and changing weather patterns threaten traditional fishing and farming practices that have sustained island communities for generations.
                </p>
              </div>
            ),
            top: '20px',
            left: '400px',
            transparent:true

          },{
            content: (
              <div style={{
                background: 'transparent',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '0px',
                boxShadow: 'none', 
                border: 'none',    
                maxWidth: '500px',
                color: '#4a5568',
                fontSize: '0.5rem',
                fontStyle:'italic',
                lineHeight: 1.7
              }}>
                Blue Pacific 2050: : indicators NV_AGR_TOTL_ZS, AG_LND_AGRI_ZS,  and VC_DSR_AALT.
              </div>
            ),
            bottom: '0px',
            left: '0px',
            width: '500px',
            height: 'auto',
            transparent: true 

          }
        ]}
      />
      
      {/* Diseases section with InfectiousDiseasesChart as background and HealthChart as overlay */}
      <StorySection
        id="health"
        title="                  Climate and Health Crisis        "
        backgroundChart={<PacificDiseasesDashboard transparent={true} />}
        overlayElements={[
          
          {
            content: (
              <div style={{
                background: 'transparent',
                padding: '30px',
                maxWidth: '600px'
              }}>
               
                <p style={{ color: '#4a5568', lineHeight: 1.7 }}>
                  Warming temperatures and extreme weather events are creating ideal conditions for disease outbreaks, while healthcare systems struggle to keep pace.
                </p>
              </div>
            ),
            bottom: '0px',
            left: '300px',
            transparent:true
          }
        ]}
      />
      
      <NarrativeTransition>
        In the face of such overwhelming challenges, many might despair. But Pacific Islanders have something the world desperately needs: the wisdom of elders who've weathered countless storms, and the courage to turn crisis into opportunity.
      </NarrativeTransition>
      <StorySection
        id="blue-pacific-rises"
        chapter="Chapter 3"
        title="The Blue Pacific Rises"
        className="story-blue-pacific-rises"
        backgroundChart={
          <div 
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `
                linear-gradient(180deg, rgba(30, 58, 138, 0.1) 0%, rgba(45, 108, 176, 0.5) 100%),
                url(/images/hero_background.jpeg)
              `,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
        }        stats={[
          { number: '2050', label: 'Target year for regional transformation' },
          { number: '7', label: 'Thematic areas working together' },
          { number: '22', label: 'Countries & territories united' }
        ]}
        overlayElements={[
          {
            content: (
              <div className="linked-image">
                <a
                  href="https://forumsec.org/2050"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Blue Pacific 2050 strategy"
                >
                  <img
                    src="/images/logo.webp"
                    alt="Blue Pacific 2050 Symbol"
                    title="Blue Pacific 2050"
                    style={{ maxWidth: '120px', height: 'auto' }}
                  />
                </a>
              </div>
            ),
            top: '200px',
            left: '500px',
            width: 'auto',
            height: 'auto',
            transparent:true

          },
          {
            content: (
              <div
                style={{
                  background: 'transparent',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: '10px',
                  maxWidth: '80%',
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }}
              >
                

                {/* Vision pillars */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '1.5rem'
                  }}
                >
                  {[
                    {
                      title: 'Resilient Communities',
                      text:
                        'Every Pacific community will have the infrastructure, knowledge, and resources to weather climate impacts and bounce back stronger.  Traditional knowledge and cultural practices will be preserved and strengthened, with young Pacific Islanders proud of their heritage. Blue economy innovations will provide good jobs and economic security while protecting ocean ecosystems. Ancient wisdom becomes the foundation for cutting-edge climate solutions through strategic action. ',
                      color: 'rgba(45, 108, 176, 0.1)'
                    }
                  ].map((pillar, index) => (
                    <div
                      key={index}
                      style={{
                        background: pillar.color.replace('0.1', '0.05'),
                        borderRadius: '12px',
                        padding: '1rem',
                        border: `1px solid ${pillar.color}`
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#1a365d',
                          marginBottom: '0.75rem'
                        }}
                      >
                        {pillar.title}
                      </h4>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          color: '#4a5568'
                        }}
                      >
                        {pillar.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Seven pillars badges */}
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(45, 108, 176, 0.05) 0%, rgba(26, 54, 93, 0.03) 100%)',
                    borderRadius: '16px',
                    padding: '1rem',
                    border: '1px solid rgba(45, 108, 176, 0.1)'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    {[
                      { label: 'Political Leadership & Regionalism', color: '#2b6cb0' },
                      { label: 'People-Centered Development', color: '#ed8936' },
                      { label: 'Peace & Security', color: '#38a169' },
                      { label: 'Climate Action', color: '#319795' },
                      { label: 'Ocean Stewardship', color: '#2b6cb0' },
                      { label: 'Economic Development', color: '#ed8936' },
                      { label: 'Technology Innovation', color: '#38a169' }
                    ].map((item, index) => (
                      <div
                        key={index}
                        style={{
                          background: 'rgba(255, 255, 255, 0.8)',
                          borderRadius: '8px',
                          padding: '1rem',
                          textAlign: 'center',
                          border: `2px solid ${item.color}20`
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: item.color,
                            margin: '0 auto 0.75rem'
                          }}
                        />
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#4a5568',
                            lineHeight: '1.3'
                          }}
                        >
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
            top: '200px',
            left: '10px',
            width: '80%',
            height: '80%',
            transparent:true

          }
        ]}
      />


      <StorySection
        id="local_improvements"
        title="Battling Climate Change Locally"
        content="While the challenges are immense, Pacific Island nations are not waiting for global action. They're pioneering innovative solutions in renewable energy and marine conservation, transforming their vulnerabilities into opportunities for sustainable development. 100% New Caledonia | 80% Palau Marine Zones Using Ecosystem-Based Conservation (2017-2018). 6 of 16 countries: High Performance Against Illegal Fishing (Level 4-5); 7 of 16 countries:Strong Small-Scale Fisheries Protection (Level 4-5)"
        stats={[
            { 
              number: '28,745 tons', 
              label: 'Waste Recycled (2007-2017)' 
            },
            { 
              number: '30%', 
              label: 'Sustainable Agriculture in Papua New Guinea (2016)' 
            },
            
            { 
              number: '1.4M tons', 
              label: 'Sustainable Fish Stocks in Papua New Guinea (2018)' 
            },
            
        ]}
        className="story-local_improvements"
        backgroundChart={<  RenewableEnergyChart  />}
        overlayElements={[
          {
            content: <HelpFisheriesChart transparent={true} />,
            bottom: '20px',
            right: '40px',
            width: '600px',
            height: '350px'
          }
        ]}
      />
<StorySection
        id="disasters-mitigation-infrastructure"
        title="Disasters Mitigation: Infrastructure"
        stats={[
          { number: '16 countries', label: 'with legislative and/or regulatory provisions been made for managing disaster risk' },


        ]}

        className="story-disasters-mitigation-infrastructure"
        backgroundChart={<DisasterMitigationsChart  transparent={true} />}
        overlayElements={[
          
           {
             content: "Pacific Island nations face an unprecedented challenge: they are among the most vulnerable to natural disasters globally, yet often have the least robust infrastructure to respond effectively. Physical connectivity through roads, airports, and shipping lanes determines how quickly aid can reach affected communities. Island nations are investing in climate-resilient infrastructure to maintain connectivity even during extreme weather. The most effective approaches combine digital and physical connectivity strategies, creating redundant systems that work even when primary infrastructure fails.",
             top: '300px',
             left: '40px',
             width: '800px',
             height: '200px',
             background:'transparent'
           },
           {
            content: < InfrastructureChart transparent={true} />,
            top: '300px',
            right: '50px',
            width: '500px',
            height: '420px'
          }
        ]}
      />
      <StorySection
        id="disasters-mitigation"
        title="Disasters Mitigation"
        // stats={[
        //   { number: '16 countries', label: 'with legislative and/or regulatory provisions been made for managing disaster risk' },


        // ]}
        
        className="story-disasters-mitigation"
        backgroundChart={<InternetElectricityChart 
          height="200px" 
          transparent={false} 
        />}
        overlayElements={[
          
           {
             content: " When disasters strike, reliable communication becomes a matter of life and death. However, internet access varies dramatically across the Pacific, from 95% in developed territories to as low as 20% in remote atolls. Modern early warning systems combine satellite technology, mobile networks, and community radio to deliver life-saving alerts. Countries with higher internet penetration can deploy sophisticated multi-channel warning systems. Physical connectivity through roads, airports, and shipping lanes determines how quickly aid can reach affected communities. Island nations are investing in climate-resilient infrastructure to maintain connectivity even during extreme weather. The most effective approaches combine digital and physical connectivity strategies, creating redundant systems that work even when primary infrastructure fails.",
             top: '200px',
             left: '40px',
             width: '500px',
             height: '550px',
             background:'transparent'
           }
        ]}
      />

      
      <StorySection
        id="healthcare-sanitation"
        title="Healthcare Actions: Sanitation"
        stats={[
          { number: '88.3%', label: 'average percentage of population using safely managed drinking water services' },
          { number: '86.3%', label: 'average percentage of population using improved sanitation services' },

        ]}

        className="story-healthcare-sanitation"
        backgroundChart={<HealthcareSanitationChart transparent={true} />}
        overlayElements={[
          {
            content: 'Access to improved drinking water sources from first to latest available data            ',
            bottom: '40px',
            right: '40px',
            width: '600px',
            height: '450px'
          }
        ]}
      />
      { <StorySection
        id="healthcare-aid"
        title="Healthcare Actions: Coverage"
        stats={[
          { number: '88.3%', label: 'average percentage of population using safely managed drinking water services' },
          { number: '86.3%', label: 'average percentage of population using improved sanitation services' },

        ]}

        className="story-healthcare-aid"
        backgroundChart={<HealthcareChart transparent={true} />}
        overlayElements={[
          {
            content: 'Access to improved drinking water sources from first to latest available data            ',
            bottom: '40px',
            right: '40px',
            width: '600px',
            height: '450px'
          }
        ]}
      /> }
      
      <StorySection
        id="summary"
        title="Summary"
        content="xxx"
        
        className="story-summary"
        

      />
    </div>
    
  );
  
}

export default App;