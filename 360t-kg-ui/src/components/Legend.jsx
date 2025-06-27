import React, { useState, useEffect, useMemo } from 'react';
import ColorPickerModal from './ColorPickerModal';
import { useSettings } from '../hooks/useSettings';
import * as d3 from 'd3';

// Default node type to color mapping
const defaultNodeColors = {
  'Module': '#4f46e5',      // deep indigo
  'Product': '#059669',     // deep emerald
  'Workflow': '#d97706',    // deep amber
  'UI_Area': '#7c3aed',     // deep violet
  'ConfigurationItem': '#db2777', // deep pink
  'TestCase': '#dc2626',    // deep red
  'Default': '#4b5563',     // deep gray
};

// Default relationship type to color mapping
const defaultRelationshipColors = {
  'USES': '#00973A',          // 360T green
  'CONTAINS': '#ec4899',      // pink
  'NAVIGATES_TO': '#8b5cf6',  // purple
  'VALIDATES': '#f59e0b',     // amber
  'REQUIRES': '#ef4444',      // red
  'CONFIGURES_IN': '#06b6d4', // cyan
  'DISPLAYS': '#f97316',      // orange
  'Default': '#64748b',       // slate
};

// Default node sizes
const defaultNodeSizes = {
  'Module': 20,
  'Product': 20,
  'Workflow': 20,
  'UI_Area': 20,
  'ConfigurationItem': 20,
  'TestCase': 20,
  'Default': 20,
};

/**
 * Legend component for displaying node types and relationship types
 * @param {Object} props - Component props
 * @param {Object} props.data - Graph data with nodes and links
 * @param {Object} props.initialConfig - Initial configuration of colors and sizes
 * @param {function} props.onNodeConfigChange - Callback when node config changes
 * @param {function} props.onClose - Callback to close the legend
 */
const Legend = ({ data, initialConfig = {}, onNodeConfigChange, onClose }) => {
  const { settings, set: setSetting, isReady: settingsReady } = useSettings();
  const [selectedItem, setSelectedItem] = useState(null);
  const [isNodeType, setIsNodeType] = useState(true);
  
  // Get current values from settings service
  const nodeColors = useMemo(() => ({ ...defaultNodeColors, ...(settings?.nodeColors || {}) }), [settings?.nodeColors]);
  const relationshipColors = useMemo(() => ({ ...defaultRelationshipColors, ...(settings?.relationshipColors || {}) }), [settings?.relationshipColors]);
  const relationshipLineStyles = useMemo(() => (settings?.relationshipLineStyles || {}), [settings?.relationshipLineStyles]);
  const nodeSizes = useMemo(() => ({ ...defaultNodeSizes, ...(settings?.nodeSizes || {}) }), [settings?.nodeSizes]);
  const nodeShapes = useMemo(() => ({ 
    'Module': 'square',
    'Product': 'triangle',
    'Workflow': 'diamond',
    'UI_Area': 'circle',
    'ConfigurationItem': 'star',
    'TestCase': 'wye',
    'Default': 'circle',
    ...(settings?.nodeShapes || {})
  }), [settings?.nodeShapes]);

  // No longer need to sync with initialConfig since we use settings service directly

  if (!data || !data.nodes || !data.links) {
    return null;
  }

  // Memoize node type counts calculation
  const nodeTypeCounts = useMemo(() => {
    const counts = {};
    if (data && data.nodes) {
      data.nodes.forEach(node => {
        // Use the same logic as in GraphView for consistency
        let nodeType = 'Default';
        if (node.labels && node.labels.length > 0) {
          nodeType = node.labels[0];
        } else if (node.group) {
          nodeType = node.group;
        }
        
        counts[nodeType] = (counts[nodeType] || 0) + 1;
      });
    }
    return counts;
  }, [data?.nodes]);

  // Memoize relationship type counts calculation
  const relationshipTypeCounts = useMemo(() => {
    const counts = {};
    if (data && data.links) {
      data.links.forEach(link => {
        const type = link.type || 'Unknown';
        counts[type] = (counts[type] || 0) + 1;
      });
    }
    return counts;
  }, [data?.links]);

  // Handle badge click to open the color picker
  const handleBadgeClick = (type, isNode = true) => {
    setSelectedItem(type);
    setIsNodeType(isNode);
  };

  // New handler for when the modal applies changes
  const handleModalApply = (type, changes) => {
    console.log(`Legend: Applying changes from modal for ${type}:`, changes);
    
    if (!settingsReady) {
      console.warn('Settings service not ready, skipping changes');
      handleCloseModal();
      return;
    }
    
    let configUpdate = {};
    let needsCallback = false;

    if (isNodeType) {
      // Node update
      if (changes.color) {
        const newNodeColors = { ...nodeColors, [type]: changes.color };
        setSetting('nodeColors', newNodeColors);
        configUpdate.colors = newNodeColors;
        configUpdate.isColorChange = true;
        needsCallback = true;
      }
      if (changes.size !== undefined) {
        const newNodeSizes = { ...nodeSizes, [type]: changes.size };
        setSetting('nodeSizes', newNodeSizes);
        configUpdate.sizes = newNodeSizes;
        configUpdate.isSizeChange = true;
        needsCallback = true;
      }
      if (changes.shape) {
        const newNodeShapes = { ...nodeShapes, [type]: changes.shape };
        setSetting('nodeShapes', newNodeShapes);
        configUpdate.shapes = newNodeShapes;
        configUpdate.isShapeChange = true;
        needsCallback = true;
      }
    } else {
      // Relationship update (color and line style)
      if (changes.color) {
        const newRelationshipColors = { ...relationshipColors, [type]: changes.color };
        setSetting('relationshipColors', newRelationshipColors);
        configUpdate.relationshipColors = newRelationshipColors;
        configUpdate.isColorChange = true;
        needsCallback = true;
      }
      if (changes.shape) { // shape holds line style string for relationships
        const newLineStyles = { ...relationshipLineStyles, [type]: changes.shape };
        setSetting('relationshipLineStyles', newLineStyles);
        configUpdate.relationshipLineStyles = newLineStyles;
        needsCallback = true;
      }
    }

    // Notify parent component only with the specific changes made
    if (needsCallback && onNodeConfigChange) {
      // Always include latest relationshipLineStyles in the update
      configUpdate.relationshipLineStyles = { ...relationshipLineStyles };

      delete configUpdate.isColorChange; 
      delete configUpdate.isSizeChange;
      delete configUpdate.isShapeChange;

      if (Object.keys(configUpdate).length > 0) {
        console.log(`Legend: Notifying parent with specific changes for ${type}`, configUpdate);
        onNodeConfigChange(configUpdate);
      } else {
        console.log(`Legend: No actual changes detected for ${type}, not notifying parent.`);
      }
    }

    // Close the modal
    handleCloseModal();
  };




  // Close the color picker modal
  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  // Calculate appropriate badge width based on text length
  const getBadgeWidth = (text, count, isNode = true, nodeType = null) => {
    // Base text width (approximate)
    const textLength = `${text} (${count})`.length;
    const baseWidth = Math.max(40, textLength * 7); // 7px per character is approximate
    
    // For node badges, factor in node size
    if (isNode && nodeType && nodeType !== 'Default') {
      const nodeSize = nodeSizes[nodeType] || 20;
      // Blend text-based width with node size
      return Math.max(baseWidth, nodeSize * 2);
    }
    
    return baseWidth;
  };

  // Add a function to generate SVG path for each shape type
  const getShapePath = (type, size = 20) => {
    const scale = size / 20; // Scale based on default size of 20
    
    switch (type) {
      case 'Module':
        // Square
        return `M ${-10 * scale},${-10 * scale} h${20 * scale} v${20 * scale} h${-20 * scale} z`;
      case 'Product':
        // Triangle 
        return `M0,${-12 * scale} L${10 * scale},${8 * scale} L${-10 * scale},${8 * scale} z`;
      case 'Workflow':
        // Diamond
        return `M0,${-12 * scale} L${12 * scale},0 L0,${12 * scale} L${-12 * scale},0 z`;
      case 'UI_Area':
        // Circle
        return d3.symbol().type(d3.symbolCircle).size(Math.PI * size * size)();
      case 'ConfigurationItem':
        // Star
        return d3.symbol().type(d3.symbolStar).size(Math.PI * size * size)();
      case 'TestCase':
        // Y shape
        return d3.symbol().type(d3.symbolWye).size(Math.PI * size * size)();
      default:
        // Default circle
        return d3.symbol().type(d3.symbolCircle).size(Math.PI * size * size)();
    }
  };

  // Handle shape click from shape options
  const handleShapeClick = (type, shape) => {
    console.log(`Legend: Selected shape ${shape} for type ${type}`);
    
    if (!settingsReady) {
      console.warn('Settings service not ready, skipping shape change');
      return;
    }
    
    // Update settings
    const newNodeShapes = { ...nodeShapes, [type]: shape };
    setSetting('nodeShapes', newNodeShapes);
    
    // Pass to parent via onNodeConfigChange
    if (onNodeConfigChange) {
      console.log(`Legend: Notifying parent about direct shape selection for ${type} to ${shape}`);
      onNodeConfigChange({
        colors: nodeColors,
        sizes: nodeSizes,
        shapes: newNodeShapes,
        isShapeChange: true
      });
    }
  };

  return (
    <div className="legend-container">
      <div className="legend-header">
        <h2 className="legend-title">Overview</h2>
        {onClose && (
          <button 
            className="legend-close-btn" 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              position: 'absolute',
              top: '10px',
              right: '10px'
            }}
          >
            ×
          </button>
        )}
      </div>
      
      <h3 className="legend-section-title">Node labels</h3>
      <div className="legend-badges">
        <span className="legend-badge all-nodes" style={{
          backgroundColor: '#4b5563',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          border: 'none',
          display: 'inline-block',
          textAlign: 'center'
        }}>
          * ({data.nodes.length})
        </span>
        {Object.entries(nodeTypeCounts).map(([type, count]) => (
          <span 
            key={type} 
            className="legend-badge"
            style={{ 
              backgroundColor: nodeColors[type] || nodeColors.Default,
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              minWidth: `${getBadgeWidth(type, count, true, type)}px`,
              height: 'auto',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textAlign: 'center'
            }}
            onClick={() => handleBadgeClick(type, true)}
            title="Click to customize"
          >
            <svg width="14" height="14" viewBox="-7 -7 14 14">
              {nodeShapes[type] && nodeShapes[type].startsWith('svg:') ? (
                <image 
                  href={`/svg/${nodeShapes[type].substring(4)}`} 
                  x="-7" y="-7" width="14" height="14" 
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <path
                  d={d3.symbol()
                    .type(
                      (nodeShapes[type] && d3[`symbol${nodeShapes[type][0].toUpperCase()}${nodeShapes[type].slice(1)}`]) 
                      || d3.symbolCircle
                    )
                    .size(100)()
                  }
                  fill="white"
                  stroke="white"
                  strokeWidth="0.5"
                />
              )}
            </svg>
            {type} ({count})
          </span>
        ))}
      </div>
      
      <h3 className="legend-section-title">Relationship types</h3>
      <div className="legend-badges">
        <span className="legend-badge all-relationships" style={{
          backgroundColor: '#64748b',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          border: 'none',
          display: 'inline-block',
          textAlign: 'center'
        }}>
          * ({data.links.length})
        </span>
        {Object.entries(relationshipTypeCounts).map(([type, count]) => (
          <span 
            key={type} 
            className="legend-badge relationship-badge"
            style={{ 
              backgroundColor: relationshipColors[type] || relationshipColors.Default,
              borderColor: relationshipColors[type] || relationshipColors.Default,
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              minWidth: `${getBadgeWidth(type, count, false)}px`,
              height: 'auto',
              borderWidth: '2px',
              borderStyle: (relationshipLineStyles[type] === 'dashed' || relationshipLineStyles[type] === 'dotted') ? relationshipLineStyles[type] : 'solid',
              display: 'inline-block',
              textAlign: 'center'
            }}
            onClick={() => handleBadgeClick(type, false)}
            title="Click to customize"
          >
            {type} ({count})
          </span>
        ))}
      </div>
      
      <div className="legend-hint">Click on a badge to customize colors and sizes</div>
      
      {selectedItem && (
        <ColorPickerModal
          type={selectedItem}
          isNodeType={isNodeType}
          initialColor={isNodeType 
            ? (nodeColors[selectedItem] || nodeColors.Default)
            : (relationshipColors[selectedItem] || relationshipColors.Default)
          }
          initialSize={isNodeType ? (nodeSizes[selectedItem] || 20) : null}
          initialShape={isNodeType ? (nodeShapes[selectedItem] || 'circle') : null} // Pass shape name string
          onApply={handleModalApply} // Use the new consolidated callback
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default React.memo(Legend);
