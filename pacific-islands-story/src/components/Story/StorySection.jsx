import React from 'react';

const StorySection = ({
  id,
  chapter,
  title,
  content,
  stats,
  className = '',
  backgroundChart,
  overlayElements = [],
  overlayStatsElements = [],
  visualContent // For backwards compatibility
}) => {
  // Automatically wrap stats as an overlay element
  const mergedOverlayStatsElements = [
    ...(stats?.length
      ? [{
          top: '30px',
          right: '20px',
          width: '400px',
          transparent: true, // Make stats container transparent
          content: (
            <div className="default-stats-content-box">
              <div className="stats-grid">
                {stats.map((stat, index) => (
                  <div key={index} className="stat-item">
                    <div className="stat-number">{stat.number}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        }]
      : []),
    ...overlayStatsElements
  ];

  // Full-screen layout (new structure)
  if (backgroundChart) {
    return (
      <section id={id} className={`story-section-fullscreen ${className}`}>
        {/* Background chart */}
        <div className="background-chart-container">
          {backgroundChart}
        </div>

        {/* Content overlay */}
        <div className="overlay-container">
          {(title || content) && (
            <div className="default-content-box">
              {chapter && <div className="chapter-label">{chapter}</div>}
              {title && <h2 className="section-title">{title}</h2>}
              {content && <p className="section-content">{content}</p>}
            </div>
          )}

          {overlayElements.map((element, index) => (
            <div
              key={index}
              className={`positioned-element ${element.transparent ? 'transparent' : ''}`}
              style={{
                position: 'absolute',
                top: element.top,
                left: element.left,
                right: element.right,
                bottom: element.bottom,
                width: element.width,
                height: element.height,
                transform: element.transform,
                zIndex: element.zIndex || 10
              }}
            >
              {element.content}
            </div>
          ))}
        </div>

        {/* Stats overlay */}
        <div className="overlay-stats-container">
          {mergedOverlayStatsElements.map((element, index) => (
            <div
              key={index}
              className={`positioned-element ${element.transparent ? 'transparent' : ''}`}
              style={{
                position: 'absolute',
                top: element.top,
                left: element.left,
                right: element.right,
                bottom: element.bottom,
                width: element.width,
                height: element.height,
                transform: element.transform,
                zIndex: element.zIndex || 10
              }}
            >
              {element.content}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Legacy layout (for non-fullscreen use)
  return (
    <section id={id} className={`story-section ${className}`}>
      <div className="story-content">
        <div className="text-content">
          {chapter && <div className="chapter-label">{chapter}</div>}
          {title && <h2 className="section-title">{title}</h2>}
          {content && <p className="section-content">{content}</p>}
          {stats && stats.length > 0 && (
            <div className="stats-grid">
              {stats.map((stat, index) => (
                <div key={index} className="stat-item">
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {visualContent && (
          <div className="visual-content">
            {visualContent}
          </div>
        )}
      </div>
    </section>
  );
};

export default StorySection;