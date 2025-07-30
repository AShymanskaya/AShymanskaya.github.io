// Position constants for consistent layout across all story sections
// All values in pixels for fixed positioning

export const POSITIONS = {
    // Standard positions for common elements
    standard: {
      topLeft: {
        top: 40,
        left: 40,
        width: 400
      },
      topRight: {
        top: 40,
        right: 40,
        width: 400
      },
      bottomLeft: {
        bottom: 40,
        left: 40,
        width: 500
      },
      bottomRight: {
        bottom: 40,
        right: 40,
        width: 600
      },
      centerLeft: {
        top: '50%',
        left: 40,
        transform: 'translateY(-50%)',
        width: 400
      },
      centerRight: {
        top: '50%',
        right: 40,
        transform: 'translateY(-50%)',
        width: 400
      },
      center: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 800
      }
    },
  
    // Specific section configurations
    sections: {
      blueContinent: {
        mainText: {
          bottom: 40,
          right: 40,
          width: 500
        },
        source: {
          bottom: 0,
          left: 0,
          width: 500
        }
      },
      
      seaLevel: {
        mainText: {
          top: 200,
          left: 40,
          width: 400
        },
        source: {
          bottom: 0,
          left: 0,
          width: 500
        }
      },
      
      temperature: {
        mainText: {
          bottom: 340,
          left: 30,
          width: 600
        },
        source: {
          bottom: 0,
          left: 0,
          width: 500
        }
      },
      
      disasters: {
        mainText: {
          top: 300,
          right: 40,
          width: 500
        },
        source: {
          bottom: 0,
          left: 0,
          width: 500
        }
      },
      
      livelihoods: {
        mainText: {
          top: 20,
          left: 400,
          width: 500
        },
        source: {
          bottom: 0,
          left: 0,
          width: 500
        }
      },
      
      health: {
        mainText: {
          bottom: 40,
          left: 300,
          width: 600
        }
      },
      
      bluePacificRises: {
        logo: {
          top: 200,
          left: 500,
          width: 'auto',
          height: 'auto'
        },
        content: {
          top: 200,
          left: 10,
          width: '80%',
          height: '80%'
        }
      },
      
      localImprovements: {
        chart: {
          bottom: 20,
          right: 40,
          width: 600,
          height: 350
        }
      },
      
      disastersMitigationInfrastructure: {
        text: {
          top: 300,
          left: 40,
          width: 800,
          height: 200
        },
        chart: {
          top: 300,
          right: 50,
          width: 500,
          height: 420
        }
      },
      
      disastersMitigation: {
        text: {
          top: 200,
          left: 40,
          width: 500,
          height: 550
        }
      },
      
      healthcareSanitation: {
        text: {
          bottom: 40,
          right: 40,
          width: 600,
          height: 450
        }
      },
      
      healthcareAid: {
        text: {
          bottom: 40,
          right: 40,
          width: 600,
          height: 450
        }
      },
      
      summary: {
        mainContent: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 'auto'
        },
        footer: {
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600
        }
      }
    },
  
    // Responsive adjustments
    responsive: {
      tablet: {
        padding: 30,
        contentWidth: 320,
        fontSize: {
          title: '1.75rem',
          content: '1rem',
          statNumber: '1.5rem'
        }
      },
      mobile: {
        padding: 20,
        contentWidth: 'auto',
        fontSize: {
          title: '1.5rem',
          content: '0.875rem',
          statNumber: '1.25rem'
        }
      }
    }
  };
  
  // Helper function to get position with responsive adjustments
  export const getResponsivePosition = (basePosition, screenWidth) => {
    if (screenWidth <= 768) {
      // Mobile: full width with padding
      return {
        ...basePosition,
        left: POSITIONS.responsive.mobile.padding,
        right: POSITIONS.responsive.mobile.padding,
        width: POSITIONS.responsive.mobile.contentWidth,
        maxWidth: `calc(100vw - ${POSITIONS.responsive.mobile.padding * 2}px)`
      };
    } else if (screenWidth <= 1024) {
      // Tablet: adjust width and padding
      return {
        ...basePosition,
        width: Math.min(basePosition.width, POSITIONS.responsive.tablet.contentWidth),
        maxWidth: `calc(100vw - ${POSITIONS.responsive.tablet.padding * 2}px)`
      };
    }
    // Desktop: use base position with max width constraint
    return {
      ...basePosition,
      maxWidth: 'calc(100vw - 80px)'
    };
  };
  
  // Style presets for consistent appearance
  export const STYLES = {
    transparentOverlay: {
      background: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: 'none',
      border: 'none',
      color: '#4a5568',
      fontSize: '1.125rem',
      lineHeight: 1.7
    },
    
    contentBox: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 255, 255, 0.8)'
    },
    
    sourceText: {
      background: 'transparent',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: 'none',
      border: 'none',
      color: '#4a5568',
      fontSize: '0.5rem',
      fontStyle: 'italic',
      lineHeight: 1.7
    }
  };
  
  // Export a utility function to apply standard positioning
  export const applyPosition = (positionKey, customStyles = {}) => {
    const position = POSITIONS.standard[positionKey] || {};
    return {
      ...position,
      ...customStyles,
      maxWidth: 'calc(100vw - 80px)'
    };
  };