import React, { useState, useEffect } from 'react';
import './Hero.css';

const Hero = ({ onScrollToNext }) => {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!hasScrolled && window.pageYOffset > 0) {
        setHasScrolled(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasScrolled]);

  const handleScrollClick = () => {
    if (onScrollToNext) {
      onScrollToNext('blue-continent');
    } else {
      // Fallback scroll behavior
      const nextSection = document.getElementById('blue-continent');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="hero" id="hero">
      <style jsx>{`
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #1a365d;
          position: relative;
          overflow: hidden;
          background:linear-gradient(0deg, rgba(43,108,176, 0.5) 20%, rgba(26,54,93, 1) 100%);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          scroll-snap-align: start; 
        }

        .text-container {
          position: relative;
          z-index: 3;
          max-width: 1200px;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3rem;
        }

        .ocean-text {
          font-size: clamp(4rem, 12vw, 10rem);
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          line-height: 1.0;
          position: relative;
          color: transparent;
          background: 
            linear-gradient(135deg, rgba(173, 216, 230, 0.1) 0%, rgba(135, 206, 235, 0.4) 100%), 
            url('/images/hero_background.jpeg');
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          margin-bottom: 1rem;
          text-shadow: none;
        }

        .future-stakes {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 1rem;
          padding: 2rem;
          text-align: center;
          max-width: 800px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .stakes-number {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(3rem, 8vw, 5rem);
          font-weight: 700;
          color: #1a365d;
          line-height: 1;
          margin-bottom: 1rem;
          display: block;
          text-align: center;
        }

        .stakes-text {
          font-size: clamp(1.125rem, 2.5vw, 1.5rem);
          line-height: 1.6;
          color: #2d3748;
          margin: 0;
        }

        .connection-ico {
          position: absolute;
          bottom: 80px;
          left: 50px;
          z-index: 4;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }

        .connection-ico:hover {
          opacity: 1;
        }

        .connection-ico img {
          width: 120px;
          height: 120px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          object-fit: contain;
        }

        .connection-ico:hover img {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
        }

        .linked-image {
          position: absolute;
          bottom: 80px;
          right: 50px;
          z-index: 4;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }

        .linked-image:hover {
          opacity: 1;
        }

        .linked-image img {
          width: 200px;
          height: 150px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          object-fit: contain;
        }

        .linked-image:hover img {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
        }

        .scroll-indicator {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          color: #1a365d;
          opacity: ${hasScrolled ? '0' : '0.8'};
          cursor: pointer;
          transition: opacity 0.3s ease;
          z-index: 4;
          text-align: center;
          pointer-events: ${hasScrolled ? 'none' : 'auto'};
        }

        .scroll-indicator:hover {
          opacity: 1;
        }

        .scroll-indicator div {
          margin-bottom: 0.5rem;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .text-container {
            padding: 1rem;
            gap: 2rem;
          }

          .future-stakes {
            padding: 1.5rem;
            margin: 0 1rem;
          }

          .stakes-number {
            font-size: clamp(2rem, 10vw, 3rem);
          }

          .stakes-text {
            font-size: clamp(1rem, 4vw, 1.25rem);
          }

          .connection-ico {
            bottom: 100px;
            left: 20px;
          }

          .connection-ico img {
            width: 80px;
            height: 80px;
          }

          .linked-image {
            bottom: 100px;
            right: 20px;
          }

          .linked-image img {
            width: 120px;
            height: 90px;
          }

          .scroll-indicator {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .ocean-text {
            font-size: clamp(3rem, 15vw, 6rem);
          }

          .future-stakes {
            padding: 1rem;
          }

          .connection-ico,
          .linked-image {
            bottom: 80px;
          }

          .connection-ico {
            left: 10px;
          }

          .linked-image {
            right: 10px;
          }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
          .connection-ico,
          .linked-image,
          .scroll-indicator {
            transition: none;
          }
        }

        /* High contrast mode */
        @media (prefers-contrast: high) {
          .ocean-text {
            text-shadow: 2px 2px 0 #000;
          }
          
          .future-stakes {
            border: 2px solid #000;
            background: rgba(255, 255, 255, 0.95);
          }
        }
      `}</style>
      
      <div className="text-container">
        <div className="ocean-text">
          BLUE PACIFIC
        </div>
        
        <div className="future-stakes">
          <span className="stakes-number">7 000 000</span>
          <p className="stakes-text">
            children and young people will call the Pacific home in 2050. Whether they inherit resilient communities or abandoned islands depends on the actions we take today. This is their story of fight against climate change, and that of hope.
          </p>
        </div>
      </div>
      
      <div className="connection-ico">
        <a 
          href="https://pacificdatavizchallenge.org/" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Visit Pacific Data Viz Challenge website"
        >
          <img 
            src="/images/favicon.ico" 
            alt="Pacific Data Viz Symbol" 
            title="Pacific Data Viz Challenge"
          />
        </a>
      </div>
    
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
          />
        </a>
      </div>
      
      <div className="scroll-indicator" onClick={handleScrollClick}>
        <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Scroll to explore their journey
        </div>
        <div style={{ fontSize: '1rem' }}>↓</div>
      </div>
    </section>
  );
};

export default Hero;