import React, { useRef, useEffect, useState } from 'react';

// Narrative Transition Component
const NarrativeTransition = ({ children, className = '', fullScreen = false }) => {
    return (
      <div className={`narrative-transition ${className} ${fullScreen ? 'full-screen' : ''}`}>
        <style jsx>{`
          .narrative-transition {
            padding: 4rem 2rem;
            background: linear-gradient(135deg, rgba(26, 54, 93, 0.05) 0%, rgba(45, 108, 176, 0.03) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 40vh;
            position: relative;
            overflow: hidden;
          }
  
          .narrative-transition.full-screen {
            min-height: 100vh;
          }
  
          .narrative-transition::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
              radial-gradient(circle at 20% 80%, rgba(43, 108, 176, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(237, 137, 54, 0.08) 0%, transparent 50%);
            pointer-events: none;
          }
  
          .narrative-content {
            max-width: 800px;
            text-align: center;
            position: relative;
            z-index: 2;
            opacity: 0;
            transform: translateY(30px);
            animation: fadeInUp 1s ease-out forwards;
          }
  
          .narrative-text {
            font-size: clamp(1.25rem, 3vw, 1.75rem);
            line-height: 1.6;
            color: #2d3748;
            font-weight: 400;
            margin: 0;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
  
          .narrative-text.large {
            font-size: clamp(1.5rem, 4vw, 2.25rem);
            font-weight: 500;
          }
  
          .narrative-text.emphasis {
            font-style: italic;
            color: #1a365d;
            font-weight: 500;
          }
  
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
  
          /* Decorative elements */
          .narrative-transition::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #f6ad55, transparent);
          }
  
          @media (max-width: 768px) {
            .narrative-transition {
              padding: 3rem 1rem;
              min-height: 30vh;
            }
  
            .narrative-text {
              font-size: clamp(1.125rem, 4vw, 1.375rem);
            }
          }
        `}</style>
        
        <div className="narrative-content">
          <p className="narrative-text">{children}</p>
        </div>
      </div>
    );
  };
export default NarrativeTransition;