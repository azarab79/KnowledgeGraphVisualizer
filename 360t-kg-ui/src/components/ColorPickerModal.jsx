import React, { useState } from 'react';
import * as d3 from 'd3';

// Array of available shapes
const shapeOptions = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'wye', label: 'Y Shape' },
  { id: 'cross', label: 'Cross' }
];

// Map shape names to d3 symbol types for preview rendering
const shapeMap = {
  'circle': d3.symbolCircle,
  'cross': d3.symbolCross,
  'diamond': d3.symbolDiamond,
  'square': d3.symbolSquare,
  'star': d3.symbolStar,
  'triangle': d3.symbolTriangle,
  'wye': d3.symbolWye
};

/**
 * Modal for picking colors and customizing node appearance
 * @param {Object} props - Component props
 * @param {string} props.type - Node or relationship type to customize
 * @param {boolean} props.isNodeType - Whether this is a node type (vs relationship)
 * @param {string} props.initialColor - Initial color
 * @param {number} props.initialSize - Initial size (for nodes)
 * @param {string} props.initialShape - Initial shape name (for nodes)
 * @param {function} props.onColorChange - Callback for color change
 * @param {function} props.onSizeChange - Callback for size change (for nodes) 
 * @param {function} props.onShapeChange - Callback for shape change (for nodes)
 * @param {function} props.onClose - Callback to close modal
 */
const ColorPickerModal = ({ 
  type, 
  isNodeType, 
  initialColor, 
  initialSize,
  initialShape,
  onColorChange, 
  onSizeChange,
  onShapeChange,
  onClose 
}) => {
  const [color, setColor] = useState(initialColor || '#4f46e5');
  const [size, setSize] = useState(initialSize || 20);
  const [shape, setShape] = useState(() => {
    // Handle string shapes
    if (typeof initialShape === 'string') {
      return initialShape;
    }
    
    // Handle function shapes (for backward compatibility)
    if (typeof initialShape === 'function') {
      // Try to find matching shape by comparing function references
      for (const [key, func] of Object.entries(shapeMap)) {
        if (func.toString() === initialShape.toString()) {
          return key;
        }
      }
      
      // Look for function name in string representation
      const funcString = initialShape.toString();
      if (funcString.includes('symbolCircle')) return 'circle';
      if (funcString.includes('symbolSquare')) return 'square';
      if (funcString.includes('symbolTriangle')) return 'triangle';
      if (funcString.includes('symbolDiamond')) return 'diamond';
      if (funcString.includes('symbolStar')) return 'star';
      if (funcString.includes('symbolWye')) return 'wye';
      if (funcString.includes('symbolCross')) return 'cross';
    }
    
    // Default to circle
    return 'circle';
  });

  // Handle color change
  const handleColorChange = (e) => {
    setColor(e.target.value);
  };

  // Handle size change
  const handleSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    console.log(`ColorPickerModal: Size slider changed to ${newSize} for type ${type}`);
    setSize(newSize);
  };
  
  // Handle shape change
  const handleShapeChange = (e) => {
    setShape(e.target.value);
  };

  // Apply changes and close
  const handleApply = () => {
    console.log(`ColorPickerModal: Applying changes for ${type}:`, { 
      color, 
      size, 
      shape 
    });
    
    // Always apply color changes first with a short timeout to ensure DOM updates
    if (onColorChange) {
      console.log(`ColorPickerModal: Calling onColorChange with type=${type}, color=${color}`);
      
      // Apply the color change immediately
      onColorChange(type, color);
      
      // Brief delay before closing to ensure changes are processed
      setTimeout(() => {
        if (isNodeType && onSizeChange) {
          console.log(`ColorPickerModal: Calling onSizeChange with type=${type}, size=${size}`);
          onSizeChange(type, size);
        }
        
        if (isNodeType && onShapeChange) {
          console.log(`ColorPickerModal: Calling onShapeChange with type=${type}, shape=${shape}`);
          onShapeChange(type, shape);
        }
        
        onClose();
      }, 100);
      
      return;
    }
    
    // If no color change handler, apply other changes and close
    if (isNodeType && onSizeChange) {
      console.log(`ColorPickerModal: Calling onSizeChange with type=${type}, size=${size}`);
      onSizeChange(type, size);
    }
    
    if (isNodeType && onShapeChange) {
      console.log(`ColorPickerModal: Calling onShapeChange with type=${type}, shape=${shape}`);
      onShapeChange(type, shape);
    }
    
    onClose();
  };

  // Draw the shape preview
  const getShapePath = (shapeName, size = 20) => {
    const shapeFunc = shapeMap[shapeName] || d3.symbolCircle;
    return d3.symbol().type(shapeFunc).size(Math.PI * size * size)();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Customize {type}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="preview" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div className="shape-preview" style={{ margin: '0 auto', width: '60px', height: '60px' }}>
              <svg width="60" height="60" viewBox="-30 -30 60 60">
                <path 
                  d={getShapePath(shape, size)} 
                  fill={color} 
                  stroke="#fff" 
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="colorPicker">Color:</label>
            <input 
              type="color" 
              id="colorPicker" 
              value={color} 
              onChange={handleColorChange} 
              className="color-input"
            />
          </div>
          
          {isNodeType && (
            <>
              <div className="form-group">
                <label htmlFor="sizeRange">Size: {size}</label>
                <input 
                  type="range" 
                  id="sizeRange" 
                  min="5" 
                  max="40" 
                  value={size} 
                  onChange={handleSizeChange} 
                  className="size-range"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="shapeSelect">Shape:</label>
                <select 
                  id="shapeSelect" 
                  value={shape}
                  onChange={handleShapeChange} 
                  className="shape-select"
                >
                  {shapeOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button onClick={handleApply} className="apply-button">Apply</button>
        </div>
      </div>
      
      <style jsx>{`
        .modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }
        
        .modal-content {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          width: 320px;
          max-width: 90%;
          position: relative;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid #eaeaea;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .color-input {
          width: 100%;
          height: 40px;
          padding: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }
        
        .size-range {
          width: 100%;
        }
        
        .shape-select {
          width: 100%;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          background-color: white;
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          padding: 15px 20px;
          border-top: 1px solid #eaeaea;
          gap: 10px;
        }
        
        .cancel-button {
          padding: 8px 15px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          background-color: white;
          cursor: pointer;
        }
        
        .apply-button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          background-color: #00973A;
          color: white;
          cursor: pointer;
        }
        
        .apply-button:hover {
          background-color: #007d31;
        }
      `}</style>
    </div>
  );
};

export default ColorPickerModal; 