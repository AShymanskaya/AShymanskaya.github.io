import React, { useState, useEffect } from 'react';

const PacificMap = ({ 
  mapSource = "./images/pacific_ocean_complete_map.svg",
  title = "Pacific Map",
  className = "",
  showLoading = true ,
  showTitle = false 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation when component mounts
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div className={`pacific-map-container ${className} ${isVisible ? 'visible' : ''}`}>
      <style jsx>{`
        .pacific-map-container {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          opacity: 0;
          transform: scale(0.9) translateY(30px);
          transition: all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .pacific-map-container.visible {
          opacity: 1;
          transform: scale(1) translateY(0);
        }

        .map-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          background: radial-gradient(ellipse at center, rgba(45, 108, 176, 0.05) 0%, transparent 70%);
        }

        .map-iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 12px;
          transition: all 0.3s ease;
          background: transparent;
        }

        .map-iframe:hover {
          transform: scale(1.02);
          box-shadow: 0 12px 40px rgba(45, 108, 176, 0.15);
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: opacity 0.5s ease;
          opacity: ${isLoaded ? '0' : '1'};
          pointer-events: ${isLoaded ? 'none' : 'auto'};
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(45, 108, 176, 0.2);
          border-top: 3px solid #2b6cb0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          color: #2b6cb0;
          font-size: 1.1rem;
          font-weight: 500;
          text-align: center;
        }

        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #ed8936;
          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 2px dashed rgba(237, 137, 54, 0.3);
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.7;
        }

        .error-title {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .error-description {
          font-size: 0.9rem;
          opacity: 0.8;
          line-height: 1.4;
        }

        .map-overlay {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          opacity: 0;
          transform: translateY(-10px);
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .pacific-map-container:hover .map-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        /* Floating islands effect */
        .islands-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          opacity: 0.6;
        }

        .floating-island {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, #f6ad55, transparent);
          border-radius: 50%;
          animation: float 6s ease-in-out infinite;
        }

        .floating-island:nth-child(1) {
          top: 20%;
          left: 15%;
          animation-delay: 0s;
        }

        .floating-island:nth-child(2) {
          top: 35%;
          left: 25%;
          animation-delay: 1s;
        }

        .floating-island:nth-child(3) {
          top: 50%;
          left: 70%;
          animation-delay: 2s;
        }

        .floating-island:nth-child(4) {
          top: 65%;
          left: 45%;
          animation-delay: 3s;
        }

        .floating-island:nth-child(5) {
          top: 30%;
          left: 80%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-8px) scale(1.2);
            opacity: 1;
          }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .map-wrapper {
            border-radius: 8px;
          }

          .map-iframe:hover {
            transform: none;
          }

          .map-overlay {
            font-size: 0.75rem;
            padding: 0.5rem 0.75rem;
          }

          .loading-text {
            font-size: 1rem;
          }

          .floating-island {
            width: 3px;
            height: 3px;
          }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
          .pacific-map-container,
          .map-iframe,
          .map-overlay,
          .floating-island {
            animation: none;
            transition: none;
          }
        }
      `}</style>

      <div className="map-wrapper">
        {/* Main Map */}
        {!hasError ? (
          <iframe
            className="map-iframe"
            src={mapSource}
            title={title}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
            aria-label="Interactive map of the Pacific Ocean showing island nations"
          />
        ) : (
          <div className="error-state">
            <div className="error-icon">🗺️</div>
            <div className="error-title">Map Unavailable</div>
            <div className="error-description">
              The Pacific Ocean map could not be loaded.<br />
              Please check your connection and try again.
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {showLoading && !hasError && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <div className="loading-text">Loading Pacific Ocean Map...</div>
          </div>
        )}
        {showTitle && (
        <div className="map-overlay">
            {title}
        </div>
        )}

        

        {/* Floating Islands Animation */}
        <div className="islands-overlay">
          <div className="floating-island" />
          <div className="floating-island" />
          <div className="floating-island" />
          <div className="floating-island" />
          <div className="floating-island" />
        </div>
      </div>
    </div>
  );
};

export default PacificMap;