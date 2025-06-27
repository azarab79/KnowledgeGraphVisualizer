import React, { useState } from 'react';

/**
 * Custom Tooltip component for displaying full text on hover
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The content that triggers the tooltip
 * @param {string} props.content - The full content to display in tooltip
 * @param {number} props.maxLength - Maximum length before showing tooltip (default: 50)
 */
function Tooltip({ children, content, maxLength = 50 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    if (!needsTooltip) return;
    
    const rect = e.target.getBoundingClientRect();
    setPosition({ 
      x: rect.left + rect.width / 2, 
      y: rect.top - 10 
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleMouseMove = (e) => {
    if (!isVisible) return;
    
    // Update position to follow mouse slightly for better UX
    const rect = e.target.getBoundingClientRect();
    setPosition({ 
      x: rect.left + rect.width / 2, 
      y: rect.top - 10 
    });
  };

  // Determine if tooltip is needed
  const needsTooltip = content && content.length > maxLength;
  
  // Create truncated version for display
  const truncatedContent = needsTooltip 
    ? `${content.substring(0, maxLength)}...`
    : content;

  return (
    <div className="tooltip-wrapper">
      <span
        className={`tooltip-trigger ${needsTooltip ? 'has-tooltip' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {children || truncatedContent}
      </span>
      
      {isVisible && needsTooltip && (
        <div 
          className="custom-tooltip"
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000
          }}
        >
          <div className="tooltip-content">
            {content}
          </div>
          <div className="tooltip-arrow"></div>
        </div>
      )}
    </div>
  );
}

export default Tooltip; 