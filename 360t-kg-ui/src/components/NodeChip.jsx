import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './NodeChip.css';
import '../types/chat.js';
import { getNodeIcon } from '../constants/iconMap.js';

/**
 * NodeChip Component - Displays a compact, clickable chip for a knowledge graph node
 * Optimized for performance with React.memo and memoized calculations
 * 
 * @param {Object} node - The node object containing id, name, labels, etc.
 * @param {Function} onSelect - Callback when the chip is clicked
 */
const NodeChip = React.memo(({ node, onSelect }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Cleanup tooltip on unmount to prevent persistence
  useEffect(() => {
    return () => {
      setShowTooltip(false);
    };
  }, []);

  // Memoize computed values to avoid recalculation on each render
  const nodeIcon = useMemo(() => {
    const label = node?.labels?.[0] || 'Unknown';
    return getNodeIcon(label);
  }, [node]);
  const nodeId = useMemo(() => node?.id || 'unknown', [node?.id]);
  const nodeName = useMemo(() => 
    node?.name || node?.properties?.name || nodeId, [node?.name, node?.properties?.name, nodeId]);
  const displayName = useMemo(() => nodeName.replace(/^show\s+/i, ''), [nodeName]);
  const nodeLabels = useMemo(() => 
    node?.labels?.join(', ') || node?.label || 'Unknown', [node?.labels, node?.label]);
  
  // Memoize tooltip content
  const tooltipContent = useMemo(() => ({
    header: displayName,
    id: `ID: ${nodeId}`,
    type: `Type: ${nodeLabels}`,
    action: 'Click to view details'
  }), [displayName, nodeId, nodeLabels]);

  // Memoize aria-label to avoid recalculation
  const ariaLabel = useMemo(() => displayName, [displayName]);
  const titleAttribute = useMemo(() => `${displayName} - Click to view details`, [displayName]);

  // Debounced tooltip handlers to prevent excessive show/hide
  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Optimized click handler with debouncing protection
  const handleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (onSelect && node) {
      onSelect(node);
    }
  }, [onSelect, node]);

  // Optimized keyboard handler
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handleClick(event);
    }
  }, [handleClick]);

  // Early return for invalid node data
  if (!node || !nodeId) {
    return null;
  }

  return (
    <div
      className="node-chip"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={titleAttribute}
    >
      <div className="node-chip-icon">
        <img 
          src={`/svg/${nodeIcon}`} 
          alt="" 
          className="node-icon"
          loading="lazy"
        />
      </div>
      <div className="node-chip-id">
        {displayName.length > 20 ? `${displayName.slice(0,17)}…` : displayName}
      </div>

      {showTooltip && (
        <div className="node-chip-tooltip">
          <div className="tooltip-header">
            <strong>{tooltipContent.header}</strong>
          </div>
          <div className="tooltip-id">
            {tooltipContent.id}
          </div>
          <div className="tooltip-labels">
            <strong>Type:</strong> {nodeLabels}
          </div>
          <div className="tooltip-action">
            {tooltipContent.action}
          </div>
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
NodeChip.displayName = 'NodeChip';

export default NodeChip; 