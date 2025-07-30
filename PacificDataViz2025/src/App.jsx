import React, { useState, useEffect } from 'react';
import './App.css';

// Import chart components
import PacificMap from './components/Charts/PacificMap';
import SeaLevelChart from './components/Charts/SeaLevelChart';
import {UnifiedTemperatureChart} from './components/Charts/UnifiedTemperatureChart';
import SimplifiedDisasterChart from './components/Charts/SimplifiedDisasterChart';
import EnhancedFoodInsecurityChart from './components/Charts/EnhancedFoodInsecurityChart';
import PacificDiseasesDashboard from './components/Charts/PacificDiseasesDashboard';
import HelpFisheriesChart from './components/Charts/HelpFisheriesChart';
import RenewableEnergyChart from './components/Charts/RenewableEnergyChart';
import DisasterMitigationsChart from './components/Charts/DisasterMitigationsChart';
import InternetElectricityChart from './components/Charts/InternetElectricityChart';
import InfrastructureChart from './components/Charts/InfrastructureChart';
import HealthcareSanitationChart from './components/Charts/HealthcareSanitationChart';
import HealthcareChart from './components/Charts/HealthcareChart';

const CONTAINER_WIDTH = 1200;

// Simple Progress Bar
const ProgressBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrolled = window.pageYOffset;
      const maxHeight = document.body.scrollHeight - window.innerHeight;
      const progress = maxHeight > 0 ? (scrolled / maxHeight) * 100 : 0;
      setProgress(Math.min(progress, 100));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '4px',
      background: 'rgba(0, 0, 0, 0.1)',
      zIndex: 1000
    }}>
      <div style={{
        height: '100%',
        background: '#f59e0b', 
        transition: 'width 0.3s ease',
        width: `${progress}%`
      }} />
    </div>
  );
};

// Stat Component
const StatCard = ({ number, label }) => (
  <div style={{
    background: 'rgba(247, 250, 252, 0.8)',
    borderRadius: '8px',
    padding: window.innerWidth < 768 ? '6px' : '8px',
    textAlign: 'center',
    border: '1px solid rgba(226, 232, 240, 0.6)'
  }}>
    <div style={{
      fontSize: window.innerWidth < 768 ? '20px' : '24px',
      fontWeight: 'bold',
      color: '#2b6cb0',
      marginBottom: '4px'
    }}>{number}</div>
    <div style={{
      fontSize: window.innerWidth < 768 ? '10px' : '12px',
      color: '#718096',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>{label}</div>
  </div>
);

// Chapter Label Component
const ChapterLabel = ({ chapter }) => (
  <div style={{
    fontSize: '0.875rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#ed8936',
    marginBottom: '12px'
  }}>
    {chapter}
  </div>
);

// Helper function to convert URLs in text to clickable links
const makeLinksClickable = (text) => {
  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Split the text by URLs
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    // Check if this part is a URL
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            textUnderlineOffset: '2px'
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Updated Chart Container Component - Replace your existing ChartContainer with this
const ChartContainer = ({ children, caption, height = '500px', noPadding = true, fullWidth = false }) => {
  const mobileHeight = parseInt(height) * 0.6 + 'px'; // Reduce height on mobile by 40%
  const actualHeight = window.innerWidth < 768 ? mobileHeight : height;
  
  return (
    <div style={{ 
      margin: fullWidth ? '32px -24px' : '3px 0',
      width: fullWidth ? 'calc(100% + 48px)' : '100%'
    }}>
      <div style={{
        width: '100%',
        background: 'transparent', 
        borderRadius: fullWidth ? '0' : '8px',
        padding: 0,
        border: 'none', 
        overflow: 'hidden'
      }}>
        <div className="chart-container-wrapper" style={{ 
          height: actualHeight, 
          position: 'relative',
          width: fullWidth ? '100vw' : '100%',
          marginLeft: fullWidth ? 'calc(50% - 50vw)' : '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Wrapper to contain chart */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {children}
          </div>
        </div>
      </div>
      {caption && (
        <p style={{
          fontSize: window.innerWidth < 768 ? '12px' : '14px',
          color: '#1a365d',
          marginTop: '1px',
          fontStyle: 'italic',
          paddingLeft: fullWidth ? '6px' : '0',
          paddingRight: fullWidth ? '6px' : '0'
        }}>
          {makeLinksClickable(caption)}
        </p>
      )}
    </div>
  );
};

// Section Component with optional transparent white background
const Section = ({ children, className = '', noBackground = false, chapter = null }) => (
  <div style={{
    maxWidth: CONTAINER_WIDTH,
    margin: '0 auto',
    padding: window.innerWidth < 768 ? '4px 4px' : '8px 8px',
    background: noBackground ? 'transparent' : 'rgba(255, 255, 255, 0.4)',
    borderRadius: window.innerWidth < 768 ? '8px' : '12px'
  }} className={className}>
    {chapter && <ChapterLabel chapter={chapter} />}
    {children}
  </div>
);

// Main App Component
export default function App() {
  return (
    <main style={{ 
      background: `linear-gradient(0deg, rgba(43,108,176, 0.5) 20%, rgba(26,54,93, 1) 100%), 
      url('./images/hero_background.jpeg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: '100vh'
    }}>
      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        
        /* Mobile Styles */
        @media (max-width: 768px) {
          h1 {
            font-size: 3rem !important;
          }
          
          h2 {
            font-size: 1.75rem !important;
            margin-bottom: 1rem !important;
          }
          
          h3 {
            font-size: 1.5rem !important;
          }
          
          p {
            font-size: 1rem !important;
            line-height: 1.6 !important;
          }
          
          /* Hide logos on mobile */
          .logo-container {
            display: none !important;
          }
          
          /* Stack grid items on mobile */
          .stats-grid {
            grid-template-columns: 1fr !important;
            gap: 0.75rem !important;
          }
          
          /* Adjust chart heights on mobile */
          .chart-container-wrapper {
            height: 300px !important;
          }
          
          /* Stack paired charts vertically on mobile */
          .chart-pair {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
        }
      `}</style>
      <ProgressBar />
      
      {/* Hero Section */}
<div style={{
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative'
}}>
  <Section noBackground={true}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{
        fontSize: 'clamp(4rem, 10vw, 10rem)',
        fontWeight: '900',
        letterSpacing: '0.08em', 
        textTransform: 'uppercase',
        lineHeight: 1,
        color: 'rgba(255, 255, 255, 0.95)', 
        marginBottom: '3rem', 
        textShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)', 
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}>
        BLUE PACIFIC
      </h1>
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(20px)', 
        WebkitBackdropFilter: 'blur(20px)', 
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '1.5rem', 
        padding: window.innerWidth < 768 ? '2rem' : '3rem', 
        maxWidth: window.innerWidth < 768 ? '90%' : '800px',
        height: window.innerWidth < 768 ? 'auto' : '400px', 
        margin: '0 auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.05)', 
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 15px 50px rgba(0, 0, 0, 0.2), 0 5px 15px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.05)';
      }}>
        <span style={{
          fontSize: window.innerWidth < 768 ? 'clamp(2.5rem, 10vw, 3.5rem)' : 'clamp(3rem, 6vw, 5rem)', 
          fontWeight: '800', 
          color: '#0f172a',
          display: 'block',
          marginBottom: '1.5rem',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          7 000 000
        </span>
        <p style={{
          fontSize: window.innerWidth < 768 ? '1.05rem' : 'clamp(1.125rem, 2.2vw, 1.25rem)', 
          lineHeight: '1.8', 
          color: '#334155', 
          margin: '0 auto',
          marginBottom: '2rem',
          maxWidth: '90%', 
          fontWeight: '400',
          letterSpacing: '-0.01em',
        }}>
          children and young people will call the Pacific home in 2050. Whether they inherit resilient communities or abandoned islands depends on the actions we take today. This is the story of climate change, and what is done to fight its consequences.
        </p>
        
        {/* Pacific Data Viz Challenge logo */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: 'translateY(0)',
          transition: 'transform 0.3s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <a 
            href="https://pacificdatavizchallenge.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              opacity: 1, 
              transition: 'opacity 0.3s ease',
              display: 'block'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <img 
              src="${process.env.PUBLIC_URL}/images/favicon.ico" 
              alt="Pacific Data Viz Challenge" 
              style={{ 
                height: '65px',
                display: 'block',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
              }} 
            />
          </a>
        </div>
      </div>
      
      <div style={{ 
        marginTop: '4rem',
        fontSize: '1rem',
        color: 'rgba(255, 255, 255, 0.9)', 
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)', 
        cursor: 'pointer',
        animation: 'bounce 2s infinite',
        transition: 'opacity 0.3s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
        <div style={{ fontWeight: '500', letterSpacing: '0.05em' }}>Scroll to explore more</div>
        <div style={{ 
          fontSize: '1.5rem', 
          marginTop: '0.5rem',
          transform: 'translateX(-50%)',
          position: 'relative',
          left: '50%',
        }}>↓</div>
      </div>
    </div>
  </Section>
</div>

      {/* Blue Continent Section */}
      <Section noBackground={false} chapter="The Beginning">
        <h2>The Blue Pacific Continent</h2>
        <p>
        Across 22 nations spanning 20% of Earth's ocean, communities that have thrived for millennia through deep knowledge of land and sea now face unprecedented change. Despite contributing just 1% of global emissions, these islands are heavily influenced by the climate change. 
        The Pacific Islands form a vast maritime civilisation where ocean and land intertwine. For 14.2 million people, the sea provides food, connects communities, and shapes cultural identity. Traditional navigation, sustainable fishing practices, and coastal agriculture have sustained these societies for thousands of years. Today, this intricate relationship between people and place faces systematic disruption as warming seas and changing weather patterns rewrite the rules of island life.
                </p>
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: window.innerWidth < 768 ? '12px' : '16px',
          margin: window.innerWidth < 768 ? '16px 0' : '5px 0'
        }}>
          <StatCard number="20%" label="of Earth's ocean surface" />
          <StatCard number="1%" label="of global emissions" />
          <StatCard number="14.2M" label="Pacific Islanders" />
        </div>

        <ChartContainer caption="Map source: https://geojson-maps.kyd.au/ | Numbers: 2050 Strategy for the Blue Pacific Continent; population data: https://stats.pacificdata.org/, indicator DF_POP_PROJ." height="600px" noPadding={true}>
          <PacificMap showTitle={false} />
        </ChartContainer>
      </Section>

      {/* Sea Level Section */}
      <Section chapter="Chapter 1">
        <h2>When the Ocean Rises</h2>
        <p>
        Across the Pacific, the ocean's advance transforms daily life in profound ways. Rising at 5mm per year — twice the global average — seawater doesn't just claim beaches. It infiltrates underground freshwater reserves, damaging crops. With 56% of Pacific Islanders living within five metres of current sea level, this slow-motion crisis touches most households directly. Vulnerability score depicts a combination of the proportion of populating living close to water, and of the sea level rise rate.
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          margin: '5px 0'
        }}>
          <StatCard number="5mm/year" label="Regional sea level rise" />
          <StatCard number="56%" label="Population within 5m of sea level" />
        </div>

        <ChartContainer caption="Sea level source: Australian Government, Bureau of Meteorology, http://www.bom.gov.au/oceanography/projects/spslcmp/data/monthly.shtml. Rise rate estimated with linear regression. Coastal population source: https://stats.pacificdata.org/, DF_POP_LECZ(1.0), indicator LECZPOPAF." height="750px" noPadding={true}>
          <SeaLevelChart transparent={true} />
        </ChartContainer>
      </Section>

      {/* Temperature Section */}
      <Section>
        <h2>When the Temperatures Surge</h2>
        <p>
        A single degree of warming has reordered Pacific life in unexpected ways. Warmer waters influence fish populations, while ocean acidification leads to coral bleaching, disrupting entire food chains. On land, where temperatures have risen similarly since 1876, aggriculture and population health are affected. 
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          margin: '5px 0'
        }}>
          <StatCard number="ca. +1°C" label="Ocean warming since 1981" />
          <StatCard number="ca. +1°C" label="Land temperature rise since 1876" />
        </div>

        <ChartContainer caption="Land surface temperature source: Climate Data Portal, Berkeley Earth Temperature Record for Oceania https://berkeleyearth.org/temperature-region/oceania | Ocean surface temperature source: Copernicus Marine Service https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_REP_OBSERVATIONS_010_011/description" height="400px" noPadding={true}>
          <UnifiedTemperatureChart transparent={true} />
        </ChartContainer>
      </Section>

      {/* Disasters Section */}
      <Section>
        <h2>When Nature Unleashes Fury</h2>
        <p>
        The Pacific has always known storms, but climate change has intensified nature's fury. Since 2000, 198 disasters have struck these islands, affecting millions and destroying $856.6 million worth of homes, schools, and infrastructure. These aren't just statistics: apart from human and economic loss, each cyclone means months without power for schools and hospitals, targeting most vulnerable. After each disaster, communities have to rebuild.     </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          margin: '5px 0'
        }}>
          <StatCard number="198 " label="total disasters since 2000" />
          <StatCard number="$856.6M" label="economic losses since 2005" />
        </div>
        <ChartContainer caption="Natural disasters data: EMDAT database https://www.emdat.be/ | Blue Pacific 2050: Climate Change And Disasters (Thematic Area 5): indicators VC_DSR_AFFCT and VC_DSR_AALT." height="800px" noPadding={true}>
          <SimplifiedDisasterChart transparent={true} />
        </ChartContainer>
      </Section>

      {/* Transition */}
      <Section noBackground={true}>
        <div style={{
          background: 'rgba(247, 250, 252, 0.8)',
          padding: '4px',
          borderRadius: '12px',
          textAlign: 'center',
          margin: '0px 0',
        }}>
          <p style={{
            fontSize: '20px',
            lineHeight: '1.8',
            color: '#4a5568',
            fontStyle: 'italic'
          }}>
            As environmental pressures mount, they trigger chain reactions through islands' societies. What begins as rising seas or warming temperatures cascades into challenges that touch every aspect of daily life, from the food on family tables to the spread of disease.


          </p>
        </div>
      </Section>


      {/* Livelihoods Section */}
      <Section chapter="Chapter 2">
        <h2>Livelihoods on the Line</h2>
        <p>
        The climate crisis strikes at the heart of Pacific livelihoods. For the 20% of families who farm and 24% who fish, environmental changes mean rethinking way of living. Farmers find that salt contamination ruins soil, and crops that once thrived now wilt in heat or rot in unexpected deluges.
Meanwhile, fishing families face empty nets since the fish move to cooler waters. With agriculture and fishing contributing significantly to national incomes, these shifts ripple through entire economies. Such changes might make societies depend on expensive imports. ALEVI and AEVI ratios are calculated to demonstrate importance of agricultural contribution to economy and employment relative to the agricultural land. Shrinkage of the land would mean dire consequences for the countries more dependent on the agriculture. The existing food insecurity would thus increase. 
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          margin: '5px 0'
        }}>
          <StatCard number="20%" label="families in agriculture" />
          <StatCard number="15%" label="agriculture contribution to GDP" />
          <StatCard number="24%" label="families in fishing" />
        </div>

        <ChartContainer caption="Pacific Data Hub: https://stats.pacificdata.org/: indicators NV_AGR_TOTL_ZS, AG_LND_AGRI_ZS, SL_AGR_EMPL_ZS and VC_DSR_AALT." height="500px">
          <EnhancedFoodInsecurityChart transparent={true} />
        </ChartContainer>
      </Section>

      {/* Health Section */}
      <Section>
        <h2>Climate and Health Crisis</h2>
        <p>
        Rising temperatures have turned the Pacific into an expanding frontier for disease. Mosquitoes carrying malaria and dengue now breed in puddles at elevations once too cool for their survival. Heatwaves cause more cardiovascular problems, while contaminated water sources spread diarrheal diseases.
        </p>

        <ChartContainer caption="Blue Pacific 2050: People-Centered Development (Thematic Area 2); indicators SH_STA_MALR, SH_TBS_INCD, SH_STA_WASH, SH_DTH_NCD, and SH_HIV_INCD." height="600px">
          <PacificDiseasesDashboard transparent={true} />
        </ChartContainer>

      </Section>
{/* Second Transition - with favicon centered under text */}
<Section noBackground={true}>
        <div style={{
          background: 'rgba(247, 250, 252, 0.8)',
          padding: '4px',
          borderRadius: '12px',
          textAlign: 'center',
          margin: '0px 0',
        }}>
          <p style={{
            fontSize: '20px',
            lineHeight: '1.8',
            color: '#4a5568',
            fontStyle: 'italic',
            marginBottom: '24px'
          }}>
      Faced with existential challenges, Pacific communities are transforming rather than surrendering. They face the challenges together through Blue Pacific 2050 strategy.
          </p>
          
          {/* Blue Pacific 2050 Strategy favicon centered under the text */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <a 
              href="https://forumsec.org/2050" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                opacity: 0.8, 
                transition: 'opacity 0.3s',
                display: 'block'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '1'}
              onMouseLeave={(e) => e.target.style.opacity = '0.8'}
            >
              <img 
                src="${process.env.PUBLIC_URL}/images/logo.webp" 
                alt="Blue Pacific 2050" 
                style={{ 
                  height: '80px',
                  display: 'block'
                }} 
              />
            </a>
          </div>
        </div>
      </Section>
      {/* Solutions Section */}
      <Section chapter="Chapter 3">
        <h2>The Blue Pacific Rises</h2>
        <p>
         The Blue Pacific 2050 Strategy represents a regional determination to thrive despite climate change. Seven interconnected pillars guide this transformation.
        </p>

        <div style={{
          background: 'rgba(247, 250, 252, 0.8)',
          padding: '32px',
          borderRadius: '12px',
          margin: '32px 0'
        }}>
          <h3 style={{ color: '#1a365d', marginBottom: '16px' }}>
            The 2050 Vision: Seven Pillars of Transformation
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {[
              'Political Leadership & Regionalism',
              'People-Centered Development',
              'Peace & Security',
              'Climate Change & Disasters',
              'Ocean & Natural Environment',
              'Resource & Economic Development',
              'Technology & Connectivity'
            ].map((pillar, index) => (
              <div key={index} style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(226, 232, 240, 0.6)',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#2b6cb0',
                  margin: '0 auto 12px'
                }} />
                <p style={{ fontSize: '14px', color: '#4a5568', margin: 0 }}>
                  {pillar}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Local Improvements Section */}
      <Section>
        <h2>Battling Climate Change Locally</h2>
        <p>
        The regional push toward renewable energy means more than reducing emissions. Solar panels and wind turbines provide energy independence for islands tired of depending on expensive diesel shipments. In education and health facilities, reliable power enables computers, refrigeration, and communications that connect remote communities to the world.
Ocean conservation tells a similar story. When New Caledonia protected 100%, and Palau 80% of its marine zones using ecosystem-based conservation, it preserved not just fish stocks but a way of life. 6 of 16 countries have high performance against illegal fishing, while 7 of 16 countries have strong small-scale fisheries protection.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '4px',
          margin: '4px 0'
        }}>
          <StatCard number="28,745 tons" label="Waste Recycled (2007-2017)" />
          <StatCard number="30%" label="Sustainable Agriculture in Papua New Guinea (2016)" />
          <StatCard number="1.4M tons" label="Sustainable Fish Stocks in Papua New Guinea (2018)" />
        </div>

        <ChartContainer caption="Blue Pacific 2050: Climate Change And Disasters (Thematic Area 5): indicators SPC_7_b_1 and EG_FEC_RNEW, as well as  SPC_12_5_1, SPC_14_2_1, ER_H2O_FWTL, SPC_14_6_1, SPC_14_b_1."  height="500px">
          <RenewableEnergyChart transparent={true} />
        </ChartContainer>

        <ChartContainer caption="Blue Pacific 2050: Ocean And Environment (Thematic Area 6): indicator ER_MRN_MARINKBA."  height="500px">
          <HelpFisheriesChart transparent={true} />
        </ChartContainer>
      </Section>

      {/* Infrastructure Section */}
      <Section chapter="Chapter 4">
        <h2>Building Resilient Infrastructure</h2>
        <p>
        Adaptation requires foundations. Sixteen countries have developed disaster risk reduction laws that mandate stronger building codes and protective infrastructure. 
Yet resilience means more than concrete. It requires communication systems that warn of approaching storms, transportation networks that function after floods, and governance structures that coordinate response across scattered islands. The connectivity scores reveal this broader infrastructure story — islands with better airports, shipping, and roads recover faster and adapt more successfully. 
        </p>

        <div className="chart-pair" style={{ 
          display: 'grid', 
          gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', 
          gap: window.innerWidth < 768 ? '16px' : '24px' 
        }}>
          <ChartContainer caption="Blue Pacific 2050: Climate Change And Disasters (Thematic Area 5): indicator SPC_11_b_2." height="500px">
            <DisasterMitigationsChart transparent={true} />
          </ChartContainer>

          <ChartContainer caption="Blue Pacific 2050: Technology And Connectivity (Thematic Area 7): indicator BPI_PRU." height="500px">
            <InfrastructureChart transparent={true} />
          </ChartContainer>
        </div>

      </Section>
      {/* Early Warning Section */}
      <Section>
        <h2>Enabling Early Warning</h2>
        <p>
        In the Pacific, information saves lives. The spread of mobile coverage has revolutionised disaster preparedness. Yet gaps remain stark: while some nations approach universal coverage, others struggle with basic connectivity. This digital divide increasingly determines who thrives and who merely survives.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '4px',
          margin: '4px 0'
        }}>
          <StatCard number="61.9%" label="population with 4G access" />
          <StatCard number="86.9%" label="population with electricity access" />
        </div>
        <ChartContainer caption="Pacific Data Hub: https://stats.pacificdata.org/ DF_WBWDI, indicator: EG_ELC_ACCS_ZS; Blue Pacific 2050: Technology And Connectivity (Thematic Area 7): indicator IT_MOB_4GNTWK." height="1000px">
          <InternetElectricityChart transparent={true} />
        </ChartContainer>
      </Section>
      {/* Healthcare Sanitation */}
      <Section>
        <h2>Strengthening Healthcare Systems: Sanitation</h2>
        <p>
        Clean water and sanitation form the foundation of climate-resilient health. With 88.3% accessing safely managed water and 86.3% using improved sanitation, the Pacific has made significant progress. But these achievements remain fragile, since one major storm can contaminate water supplies and destroy sanitation systems, triggering disease outbreaks.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          margin: '5px 0'
        }}>
          <StatCard number="88.3%" label="average percentage of 
          population using safely managed drinking water servicesP" />
          <StatCard number="86.3%" label="average percentage 
          of population using improved sanitation services." />
        </div>
        
          <ChartContainer caption="Blue Pacific 2050: People-Centered Development (Thematic Area 2), indicators: SH_H2O_SAFE, SH_SAN_SAFE, SPC_3_8_1." height="600px">
            <HealthcareSanitationChart transparent={true} />
          </ChartContainer>


      </Section>
{/* Healthcare Coverage */}
<Section>
        <h2>Strengthening Healthcare Systems: Coverage</h2>
        <p>
        Healthcare coverage varies dramatically across the region. Some nations provide comprehensive services; others struggle to staff remote clinics. As climate pressures intensify health challenges, this infrastructure becomes critical. Communities with strong health systems weather crises better, recovering faster from disasters and preventing disease outbreaks from becoming epidemics.

        </p>

          

          <ChartContainer caption="Blue Pacific 2050: People-Centered Development (Thematic Area 2), indicators: SH_STA_BRTC, SH_STA_MORT, SPC_3_8_1, BPI_MANAGL2, SH_MED_DEN." height="600px">
            <HealthcareChart transparent={true} />
          </ChartContainer>
      </Section>

      {/* Conclusion */}
      <Section chapter="The Call to Action">
        <h2>The Pacific Century</h2>
        <p>
          The transformation underway in the Pacific Islands offers lessons for a warming world. These communities demonstrate that adaptation requires more than seawalls and solar panels—it demands reimagining relationships with land and sea while preserving cultural identity.
        </p>
        <p>
          From renewable energy microgrids to community-based fisheries management, Pacific innovations show that small nations can lead global change. Their strategies blend traditional wisdom with modern technology, creating solutions scaled to local needs rather than imported wholesale.
        </p>
        <p>
          As climate impacts intensify globally, the Pacific's experience shifts from cautionary tale to instruction manual. These islands aren't just surviving climate change—they're showing how communities anywhere can adapt while maintaining their essential character. The question for the world is whether it will support these frontline innovations or force Pacific nations to bear the cost of changes they didn't create.
        </p>
        <p>
          The seven million young Pacific Islanders of 2050 will inherit either abandoned islands or resilient ocean states. That future depends on choices made today—both in Pacific capitals and global climate conferences. Time, like the tide, waits for no one.
        </p>

        {/* Call to action button */}
        <div style={{ textAlign: 'center', margin: '32px 0' }}>
          <a
            href="https://forumsec.org/2050"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#2b6cb0',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '50px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'background 0.3s',
              boxShadow: '0 4px 16px rgba(43, 108, 176, 0.3)'
            }}
            onMouseEnter={(e) => e.target.style.background = '#1a365d'}
            onMouseLeave={(e) => e.target.style.background = '#2b6cb0'}
          >
            Learn More About Blue Pacific 2050
          </a>
        </div>

        {/* Credits section */}
        <div style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(226, 232, 240, 0.6)',
          textAlign: 'center'
        }}>
          <p style={{ 
            color: '#718096', 
            fontSize: '14px',
            marginBottom: '8px'
          }}>
            Data visualization created by Aliaksandra Shymanskaya for the Pacific Data Viz Challenge 2025.
          </p>
          <p style={{ 
            color: '#718096', 
            fontSize: '14px',
            marginBottom: '8px'
          }}>
            Sources: Pacific Data Hub, Blue Pacific 2050 Strategy, and various regional climate databases.
          </p>
          <p style={{ 
            color: '#718096', 
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            Background art co-created by Laura Piacquadio based on the Voronoi diagram of the land surface of the Pacific Islands. Data: Pacific Data Hub, DF_LAND_USE.
          </p>
        </div>
      </Section>
    </main>
  );
}