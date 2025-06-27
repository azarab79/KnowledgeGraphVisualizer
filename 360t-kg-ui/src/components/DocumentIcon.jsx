import React, { useState, useRef } from 'react';
import './DocumentIcon.css';

/**
 * DocumentIcon component that displays a small document icon with tooltip
 * showing the full document text when hovered, similar to the Node details implementation
 */
function DocumentIcon({ document, index }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);
  const tooltipRef = useRef(null);

  const updateTooltipPosition = () => {
    if (iconRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Position tooltip to the right of the icon by default
      let x = iconRect.right + 8;
      let y = iconRect.top;
      
      // If tooltip would go off the right edge, position it to the left
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        if (x + tooltipRect.width > viewportWidth - 10) {
          x = iconRect.left - tooltipRect.width - 8;
        }
        
        // If tooltip would go off the bottom edge, position it above
        if (y + tooltipRect.height > viewportHeight - 10) {
          y = iconRect.bottom - tooltipRect.height;
        }
      }
      
      // Ensure tooltip doesn't go off the top or left edges
      x = Math.max(10, x);
      y = Math.max(10, y);
      
      setTooltipPosition({ x, y });
    }
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
    // Use setTimeout to ensure tooltip is rendered before positioning
    setTimeout(updateTooltipPosition, 0);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const formatDocumentTitle = (document) => {
    // Try to extract a meaningful title from metadata or content
    if (document.metadata?.title) {
      return document.metadata.title;
    }
    
    // Extract first line or sentence as title
    const firstLine = document.full_text.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 60) {
      return firstLine;
    }
    
    // Fallback to generic title with document number
    return `${document.title || `Document ${index + 1}`}`;
  };

  const formatDocumentContent = (text) => {
    // Clean up the text for display
    return text
      .replace(/\n\n+/g, '\n\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  return (
    <>
      <div
        ref={iconRef}
        className="document-icon"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={`${formatDocumentTitle(document)} - Hover to view details`}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10,9 9,9 8,9"></polyline>
        </svg>
        <span className="document-number">{index + 1}</span>
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className={`document-tooltip ${showTooltip ? 'visible' : ''}`}
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
        >
          <div className="document-tooltip-header">
            {formatDocumentTitle(document)}
          </div>
          <div className="document-tooltip-content">
            {formatDocumentContent(document.full_text)}
          </div>
        </div>
      )}
    </>
  );
}

export default DocumentIcon; 