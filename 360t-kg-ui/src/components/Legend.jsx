import React, { useState, useEffect, useMemo } from 'react';
import ColorPickerModal from './ColorPickerModal';
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
  const [nodeColors, setNodeColors] = useState({ ...defaultNodeColors, ...(initialConfig.colors || {}) });
  const [relationshipColors, setRelationshipColors] = useState({ ...defaultRelationshipColors, ...(initialConfig.relationshipColors || {}) });
  const [nodeSizes, setNodeSizes] = useState({ ...defaultNodeSizes, ...(initialConfig.sizes || {}) });
  const [nodeShapes, setNodeShapes] = useState({ 
    'Module': 'square',
    'Product': 'triangle',
    'Workflow': 'diamond',
    'UI_Area': 'circle',
    'ConfigurationItem': 'star',
    'TestCase': 'wye',
    'Default': 'circle',
    ...(initialConfig.shapes || {})
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [isNodeType, setIsNodeType] = useState(true);

  // Update local state when initialConfig changes
  useEffect(() => {
    // Only update if initialConfig has data
    if (initialConfig && Object.keys(initialConfig).length > 0) {
      if (initialConfig.colors && Object.keys(initialConfig.colors).length > 0) {
        setNodeColors(prevColors => ({
          ...defaultNodeColors,
          ...prevColors,
          ...initialConfig.colors
        }));
      }
      
      if (initialConfig.sizes && Object.keys(initialConfig.sizes).length > 0) {
        setNodeSizes(prevSizes => ({
          ...defaultNodeSizes,
          ...prevSizes,
          ...initialConfig.sizes
        }));
      }
      
      if (initialConfig.shapes && Object.keys(initialConfig.shapes).length > 0) {
        setNodeShapes(prevShapes => ({
          ...prevShapes,
          ...initialConfig.shapes
        }));
      }
      
      if (initialConfig.relationshipColors && Object.keys(initialConfig.relationshipColors).length > 0) {
        setRelationshipColors(prevColors => ({
          ...defaultRelationshipColors,
          ...prevColors,
          ...initialConfig.relationshipColors
        }));
      }
    }
  }, [initialConfig]);

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

  // Handle color change
  const handleColorChange = (type, color) => {
    console.log(`Legend: Changing color for ${type} to ${color}`);
    
    if (isNodeType) {
      // Update local state with the new color
      const newNodeColors = { ...nodeColors, [type]: color };
      console.log(`Legend: Setting node colors state:`, newNodeColors);
      setNodeColors(newNodeColors);
      
      // Force direct DOM updates for the badge background color
      const badgeElements = document.querySelectorAll(`.legend-badge[title="Click to customize"]`);
      badgeElements.forEach(badge => {
        if (badge.textContent.startsWith(type)) {
          console.log(`Legend: Directly updating badge color for ${type} to ${color}`);
          badge.style.backgroundColor = color;
        }
      });
      
      // Save to localStorage
      try {
        localStorage.setItem('nodeColors', JSON.stringify(newNodeColors));
        console.log(`Legend: Saved node colors to localStorage:`, newNodeColors);
      } catch (error) {
        console.warn('Could not save color preferences to localStorage', error);
      }
      
      // Notify parent component if callback exists
      if (onNodeConfigChange) {
        console.log(`Legend: Notifying parent about color change for ${type}`, {
          colors: newNodeColors,
          sizes: nodeSizes,
          shapes: nodeShapes
        });
        
        // Pass color updates to parent component
        onNodeConfigChange({
          colors: newNodeColors,
          sizes: nodeSizes,  // Preserve existing sizes
          shapes: nodeShapes, // Preserve existing shapes
          isColorChange: true  // Add flag to indicate this is a color change
        });
      }
    } else {
      // Update local state with the new relationship color
      const newRelationshipColors = { ...relationshipColors, [type]: color };
      console.log(`Legend: Setting relationship colors state:`, newRelationshipColors);
      setRelationshipColors(newRelationshipColors);
      
      // Force direct DOM updates for the badge background color
      const badgeElements = document.querySelectorAll(`.legend-badge.relationship-badge[title="Click to customize"]`);
      badgeElements.forEach(badge => {
        if (badge.textContent.startsWith(type.replace(/_/g, ' '))) {
          console.log(`Legend: Directly updating relationship badge color for ${type} to ${color}`);
          badge.style.backgroundColor = color;
        }
      });
      
      // Save to localStorage
      try {
        localStorage.setItem('relationshipColors', JSON.stringify(newRelationshipColors));
        console.log(`Legend: Saved relationship colors to localStorage:`, newRelationshipColors);
      } catch (error) {
        console.warn('Could not save relationship color preferences to localStorage', error);
      }
      
      // Notify parent component if callback exists
      if (onNodeConfigChange) {
        console.log(`Legend: Notifying parent about relationship color change for ${type}`, {
          relationshipColors: newRelationshipColors
        });
        
        // Pass relationship color updates to parent component 
        onNodeConfigChange({
          colors: nodeColors, // Preserve existing node colors
          sizes: nodeSizes,   // Preserve existing sizes
          shapes: nodeShapes, // Preserve existing shapes
          relationshipColors: newRelationshipColors,
          isColorChange: true  // Add flag to indicate this is a color change
        });
      }
    }
  };

  // Handle size change
  const handleSizeChange = (type, size) => {
    console.log(`Legend: Changing size for ${type} to ${size}`);
    console.log('Current nodeSizes before update:', nodeSizes);
    
    if (isNodeType) {
      // Update the size in state
      const newNodeSizes = { ...nodeSizes, [type]: size };
      console.log('New nodeSizes after update:', newNodeSizes);
      
      setNodeSizes(newNodeSizes);
      
      // Save to localStorage
      try {
        localStorage.setItem('nodeSizes', JSON.stringify(newNodeSizes));
        console.log(`Legend: Saved node sizes to localStorage:`, newNodeSizes);
      } catch (error) {
        console.warn('Could not save size preferences to localStorage', error);
      }
      
      // Notify parent component if callback exists
      if (onNodeConfigChange) {
        console.log(`Legend: Notifying parent about size change for ${type}`, {
          colors: nodeColors,
          sizes: newNodeSizes,
          shapes: nodeShapes,
          isSizeChange: true // Add flag to indicate this is a size change
        });
        
        // Add a delay to ensure the state update has time to propagate
        setTimeout(() => {
          console.log('Sending delayed size update with sizes:', newNodeSizes);
          onNodeConfigChange({
            colors: nodeColors,
            sizes: newNodeSizes,
            shapes: nodeShapes,
            isSizeChange: true // Add flag to indicate this is a size change
          });
        }, 100);
      }
    }
  };

  // Handle shape change
  const handleShapeChange = (type, shape) => {
    console.log(`Legend: Changing shape for ${type} to ${shape}`);
    
    if (isNodeType) {
      // Store the string shape name
      const newNodeShapes = { ...nodeShapes, [type]: shape };
      setNodeShapes(newNodeShapes);
      
      // Save to localStorage
      try {
        localStorage.setItem('nodeShapes', JSON.stringify(newNodeShapes));
        console.log(`Legend: Saved node shapes to localStorage:`, newNodeShapes);
      } catch (error) {
        console.warn('Could not save shape preferences to localStorage', error);
      }
      
      // Notify parent component if callback exists
      if (onNodeConfigChange) {
        console.log(`Legend: Notifying parent about shape change for ${type}`);
        onNodeConfigChange({
          colors: nodeColors,
          sizes: nodeSizes,
          shapes: newNodeShapes,
          isShapeChange: true // This flag is crucial for the parent to know it's a shape change
        });
        
        // Add a second callback with a slight delay to ensure changes are applied
        setTimeout(() => {
          console.log(`Legend: Second callback for shape change ${type} to ${shape}`);
          onNodeConfigChange({
            colors: nodeColors,
            sizes: nodeSizes,
            shapes: newNodeShapes,
            isShapeChange: true
          });
        }, 200);
      }
    }
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
    // Update local state
    const newNodeShapes = { ...nodeShapes, [type]: shape };
    setNodeShapes(newNodeShapes);
    
    // Save to localStorage
    try {
      localStorage.setItem('nodeShapes', JSON.stringify(newNodeShapes));
      console.log(`Legend: Saved node shapes to localStorage:`, newNodeShapes);
    } catch (error) {
      console.warn('Could not save shape preferences to localStorage', error);
    }
    
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
              display: 'inline-block',
              textAlign: 'center'
            }}
            onClick={() => handleBadgeClick(type, true)}
            title="Click to customize"
          >
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
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              minWidth: `${getBadgeWidth(type, count, false)}px`,
              height: 'auto',
              border: 'none',
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
          initialShape={isNodeType ? (nodeShapes[selectedItem] || d3.symbolCircle) : null}
          onColorChange={handleColorChange}
          onSizeChange={handleSizeChange}
          onShapeChange={handleShapeChange}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default React.memo(Legend); 