import React, { useState } from 'react';
import * as d3 from 'd3';

/**
 * List of available node shapes.
 * 
 * Includes:
 * - D3 built-in symbols (circle, square, triangle, diamond, star, wye, cross)
 * - SVG icons from /public/svg directory, prefixed with 'svg:'
 * 
 * The shape picker displays a preview icon next to each option.
 * When an SVG icon is selected, it is rendered as an <image> in the graph.
 */
const shapeOptions = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'wye', label: 'Y Shape' },
  { id: 'cross', label: 'Cross' },
  // SVG icons
  { id: 'svg:bank-banking-finance-svgrepo-com.svg', label: 'Bank Icon' },
  { id: 'svg:business-connection-connect-communication-teamwork-people-svgrepo-com.svg', label: 'Teamwork' },
  { id: 'svg:business-finance-corporate-svgrepo-com.svg', label: 'Business Finance' },
  { id: 'svg:configuration-gear-options-preferences-settings-system-svgrepo-com.svg', label: 'Settings Gear' },
  { id: 'svg:database-svgrepo-com.svg', label: 'Database' },
  { id: 'svg:diagram-business-presentation-chart-graph-infographic-svgrepo-com.svg', label: 'Diagram Chart' },
  { id: 'svg:diploma-verified-svgrepo-com.svg', label: 'Diploma Verified' },
  { id: 'svg:dollar-finance-money-29-svgrepo-com.svg', label: 'Dollar 29' },
  { id: 'svg:dollar-finance-money-38-svgrepo-com.svg', label: 'Dollar 38' },
  { id: 'svg:dollar-finance-money-40-svgrepo-com.svg', label: 'Dollar 40' },
  { id: 'svg:dollar-finance-money-41-svgrepo-com.svg', label: 'Dollar 41' },
  { id: 'svg:dollar-finance-money-44-svgrepo-com.svg', label: 'Dollar 44' },
  { id: 'svg:dollar-finance-money-47-svgrepo-com.svg', label: 'Dollar 47' },
  { id: 'svg:finance-book-svgrepo-com.svg', label: 'Finance Book' },
  { id: 'svg:finance-department-trader-trading-cfo-svgrepo-com.svg', label: 'Finance Trader' },
  { id: 'svg:finance-markting-money-coin-dollar-molecule-svgrepo-com.svg', label: 'Finance Marketing' },
  { id: 'svg:finance-svgrepo-com.svg', label: 'Finance' },
  { id: 'svg:finance-symbol-of-four-currencies-on-a-hand-svgrepo-com.svg', label: 'Currencies on Hand' },
  { id: 'svg:hierarchy-svgrepo-com.svg', label: 'Hierarchy' },
  { id: 'svg:money-bag-finance-business-svgrepo-com.svg', label: 'Money Bag' },
  { id: 'svg:noteminor-svgrepo-com.svg', label: 'Note Minor' },
  { id: 'svg:power-svgrepo-com.svg', label: 'Power' },
  { id: 'svg:search-svgrepo-com.svg', label: 'Search' },
  { id: 'svg:system-svgrepo-com.svg', label: 'System' },
  { id: 'svg:user-alt-1-svgrepo-com.svg', label: 'User Alt' },
  { id: 'svg:user-interface-svgrepo-com.svg', label: 'User Interface' },
  { id: 'svg:workflow-svgrepo-com.svg', label: 'Workflow' }
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
/**
 * Modal for picking colors, sizes, and shapes for nodes or relationships.
 * 
 * Features:
 * - Color picker input
 * - Size slider (nodes only)
 * - Shape selector with icon previews (nodes only)
 *   - Supports D3 symbols and SVG icons
 *   - Displays a small icon next to each shape option
 * - Live preview of the selected shape and color
 * 
 * @param {Object} props - Component props
 * @param {string} props.type - Node or relationship type to customize
 * @param {boolean} props.isNodeType - Whether this is a node type (vs relationship)
 * @param {string} props.initialColor - Initial color
 * @param {number} props.initialSize - Initial size (for nodes)
 * @param {string|function} props.initialShape - Initial shape (name string or D3 symbol function)
 * @param {function} props.onApply - Callback when changes are applied
 * @param {function} props.onClose - Callback to close modal
 */
const ColorPickerModal = ({ 
  type, 
  isNodeType, 
  initialColor, 
  initialSize,
  initialShape,
  onApply, // Replaced individual callbacks with onApply
  onClose 
}) => {
  const [color, setColor] = useState(initialColor || '#4f46e5');
  const [size, setSize] = useState(initialSize || 20);
  const [shape, setShape] = useState(() => {
    if (!isNodeType && typeof initialShape === 'string') {
      return 'solid'; // for relationships, default to solid line style
    }
    if (typeof initialShape === 'string') {
      return initialShape;
    }
    if (typeof initialShape === 'function') {
      for (const [key, func] of Object.entries(shapeMap)) {
        if (func.toString() === initialShape.toString()) {
          return key;
        }
      }
      const funcString = initialShape.toString();
      if (funcString.includes('symbolCircle')) return 'circle';
      if (funcString.includes('symbolSquare')) return 'square';
      if (funcString.includes('symbolTriangle')) return 'triangle';
      if (funcString.includes('symbolDiamond')) return 'diamond';
      if (funcString.includes('symbolStar')) return 'star';
      if (funcString.includes('symbolWye')) return 'wye';
      if (funcString.includes('symbolCross')) return 'cross';
    }
    return 'circle';
  });
  const [lineStyle, setLineStyle] = useState(
    typeof initialShape === 'string' && !isNodeType ? initialShape : 'solid'
  );

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
    
    // Call the single onApply callback with all changes
    if (onApply) {
      onApply(type, { 
        color, 
        size: isNodeType ? size : undefined, // Only pass size for nodes
        shape: isNodeType ? shape : lineStyle  // For relationships, shape holds line style string
      });
    }
    onClose(); // Close the modal after applying
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
              {shape.startsWith('svg:') ? (
                <svg width="60" height="60" viewBox="-30 -30 60 60">
                  <image 
                    href={`/svg/${shape.substring(4)}`} 
                    x="-20" y="-20" width="40" height="40" 
                    preserveAspectRatio="xMidYMid meet"
                  />
                </svg>
              ) : (
                <svg width="60" height="60" viewBox="-30 -30 60 60">
                  <path 
                    d={getShapePath(shape, size)} 
                    fill={color} 
                    stroke="#fff" 
                    strokeWidth="2"
                  />
                </svg>
              )}
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
          
          {isNodeType ? (
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
                <label>Shape:</label>
                <div className="custom-shape-picker" style={{
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {shapeOptions.map(option => (
                    <div
                      key={option.id}
                      onClick={() => setShape(option.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: shape === option.id ? '#e0f2fe' : 'transparent',
                        border: shape === option.id ? '1px solid #00973A' : '1px solid transparent'
                      }}
                    >
                      <svg width="16" height="16" viewBox="-8 -8 16 16">
                        {option.id.startsWith('svg:') ? (
                          <image
                            href={`/svg/${option.id.substring(4)}`}
                            x="-8" y="-8" width="16" height="16"
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : (
                          <path
                            d={d3.symbol()
                              .type(
                                d3[`symbol${option.id[0].toUpperCase()}${option.id.slice(1)}`] || d3.symbolCircle
                              )
                              .size(100)()
                            }
                            fill="#333"
                            stroke="#333"
                            strokeWidth="0.5"
                          />
                        )}
                      </svg>
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="lineStyleSelect">Line Style:</label>
                <select
                  id="lineStyleSelect"
                  value={lineStyle}
                  onChange={(e) => setLineStyle(e.target.value)}
                  className="line-style-select"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
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
      
      <style>{`
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
