// Fixed NavigationComponents.jsx
import React, { useState, useEffect, useCallback } from 'react';

// Progress Bar Component
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
    updateProgress(); // Initialize on mount

    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className="progress-bar-container">
      <style jsx>{`
        .progress-bar-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          z-index: 1000;
        }

        .progress-bar {
          height: 100%;
          background: #f6ad55;
          transition: width 0.3s ease;
          will-change: width;
        }
      `}</style>
      <div className="progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
};

// Chapter Navigation Component
const ChapterNavigation = ({ activeChapter, onChapterClick }) => {
  // Move chapters definition outside of useEffect to fix dependency warning
  const chapters = [
    { id: 'hero', name: 'Introduction' },
    { id: 'blue-continent', name: 'The Blue Continent' },
    { id: 'sea-level', name: 'Sea Level Rise' },
    { id: 'temperature', name: 'Rising Heat' },
    { id: 'disasters', name: 'Disasters' },
    { id: 'livelihoods', name: 'Livelihoods' },
    { id: 'health', name: 'Health Problems' },
    { id: 'local_improvements', name: 'Local Solutions' },
    { id: 'local_improvements', name: 'Local Solutions' }

  ];

  const [currentChapter, setCurrentChapter] = useState(activeChapter || 'hero');

  // Memoize the update function to prevent unnecessary re-renders
  const updateActiveChapter = useCallback(() => {
    const sections = chapters.map(chapter => document.getElementById(chapter.id)).filter(Boolean);
    
    for (let section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
        setCurrentChapter(section.id);
        break;
      }
    }
  }, [chapters]);

  useEffect(() => {
    window.addEventListener('scroll', updateActiveChapter, { passive: true });
    updateActiveChapter(); // Initialize on mount

    return () => window.removeEventListener('scroll', updateActiveChapter);
  }, [updateActiveChapter]);

  const handleChapterClick = (chapterId) => {
    const section = document.getElementById(chapterId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    if (onChapterClick) {
      onChapterClick(chapterId);
    }
  };

  return (
    <nav className="chapter-nav">
      <style jsx>{`
        .chapter-nav {
          position: fixed;
          right: 2rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .chapter-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .chapter-dot.active {
          background: #f6ad55;
          transform: scale(1.2);
        }

        .chapter-dot:hover {
          background: rgba(255, 255, 255, 0.6);
          transform: scale(1.1);
        }

        .chapter-dot:hover::after {
          content: attr(data-chapter);
          position: absolute;
          right: 120%;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          white-space: nowrap;
          pointer-events: none;
          z-index: 1000;
        }

        @media (max-width: 768px) {
          .chapter-nav {
            display: none;
          }
        }
      `}</style>
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          className={`chapter-dot ${currentChapter === chapter.id ? 'active' : ''}`}
          data-chapter={chapter.name}
          onClick={() => handleChapterClick(chapter.id)}
          aria-label={`Navigate to ${chapter.name}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleChapterClick(chapter.id);
            }
          }}
        />
      ))}
    </nav>
  );
};

// Export both components
export { ProgressBar, ChapterNavigation };