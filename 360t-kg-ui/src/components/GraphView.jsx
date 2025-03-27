import React, { useEffect, useRef, useState, Component, useCallback } from 'react';
import * as d3 from 'd3';
import Legend from './Legend';

// Error boundary component to catch rendering errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GraphView error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container" style={{ 
          padding: '20px', 
          backgroundColor: '#fff5f5', 
          border: '1px solid #fc8181',
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          <h2>Something went wrong with the graph visualization</h2>
          <p>The application encountered an error rendering the graph. Please try:</p>
          <ul>
            <li>Refreshing the page</li>
            <li>Selecting a different node</li>
            <li>Resetting customizations</li>
          </ul>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00973A',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Get node type for coloring - defined outside component to avoid circular dependencies
const getNodeType = (d) => {
  try {
    // Guard against null or undefined
    if (!d) return 'Default';
    
    // Try labels array first
    if (d.labels && Array.isArray(d.labels) && d.labels.length > 0) {
      return d.labels[0];
    }
    
    // Try group property
    if (d.group) {
      return d.group;
    }
    
    // Try direct type property 
    if (d.type) {
      return d.type;
    }
    
    // Try properties.type
    if (d.properties && d.properties.type) {
      return d.properties.type;
    }
    
    // Try n1/n2 labels
    if (d.n1 && d.n1.labels && Array.isArray(d.n1.labels) && d.n1.labels.length > 0) {
      return d.n1.labels[0];
    }
    if (d.n2 && d.n2.labels && Array.isArray(d.n2.labels) && d.n2.labels.length > 0) {
      return d.n2.labels[0];
    }
    
    return 'Default';
  } catch (err) {
    console.warn('Error determining node type:', err);
    return 'Default';
  }
};

// Node type to color mapping
const defaultNodeColors = {
  'Module': '#4f46e5',      // deep indigo
  'Product': '#059669',     // deep emerald
  'Workflow': '#d97706',    // deep amber
  'UI_Area': '#7c3aed',     // deep violet
  'ConfigurationItem': '#db2777', // deep pink
  'TestCase': '#dc2626',    // deep red
  'Default': '#4b5563',     // deep gray
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

// Node type to shape mapping using string keys instead of function references
const defaultNodeShapes = {
  'Module': 'square',
  'Product': 'triangle',
  'Workflow': 'diamond',
  'UI_Area': 'circle',
  'ConfigurationItem': 'star',
  'TestCase': 'wye',
  'Default': 'circle'
};

// Map shape names to d3 symbol types with error checking
const shapeMap = {
  'circle': d3.symbolCircle,
  'cross': d3.symbolCross,
  'diamond': d3.symbolDiamond,
  'square': d3.symbolSquare,
  'star': d3.symbolStar,
  'triangle': d3.symbolTriangle,
  'wye': d3.symbolWye
};

// Validate the shape map to ensure all symbols are available
Object.entries(shapeMap).forEach(([key, symbol]) => {
  if (!symbol) {
    console.warn(`Shape symbol '${key}' is missing or undefined, falling back to circle`);
    shapeMap[key] = d3.symbolCircle;
  }
});

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

// Add a toggle button for the legend
const LegendToggle = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#00973A',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: '12px',
      cursor: 'pointer',
      zIndex: 99,
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5H21V7H3V5ZM3 11H21V13H3V11ZM3 17H21V19H3V17Z" fill="currentColor"/>
    </svg>
    Show Legend
  </button>
);

// Styles for the legend
const legendStyles = `
.shape-button {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px;
  background: white;
  cursor: pointer;
}

.shape-button:hover {
  background-color: #f0f9ff;
  border-color: #93c5fd;
}

.shape-button-selected {
  background-color: #f0f9ff;
  border: 1px solid #00973A;
}

.legend-wrapper {
  color: #333;
  background-color: white;
}

.legend-title {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #00973A;
}

.legend-subtitle {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: bold;
}
`;

// Add a config actions button group
const ConfigActions = ({ onExport, onImport, onReset }) => (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }}>
    <button
      onClick={onExport}
      style={{
        backgroundColor: '#00973A',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
    >
      Export Config
    </button>
    <label
      style={{
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        textAlign: 'center'
      }}
    >
      Import Config
      <input 
        type="file" 
        accept=".json"
        style={{ display: 'none' }}
        onChange={onImport}
      />
    </label>
    <button
      onClick={onReset}
      style={{
        backgroundColor: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
    >
      Reset Config
    </button>
  </div>
);

/**
 * Graph visualization component using D3
 * @param {Object} props - Component props
 * @param {Object} props.data - Graph data with nodes and links
 * @param {Function} props.onNodeSelect - Callback when a node is selected
 * @param {Object} props.customConfig - Custom configuration for nodes (colors and sizes)
 */
function GraphView({ data, onNodeSelect, customConfig = {} }) {
  const svgRef = useRef(null);
  const [simulation, setSimulation] = useState(null);
  const [nodeColors, setNodeColors] = useState({ ...defaultNodeColors });
  const [nodeSizes, setNodeSizes] = useState({ ...defaultNodeSizes });
  const [nodeShapes, setNodeShapes] = useState({ ...defaultNodeShapes });
  const [relationshipColors, setRelationshipColors] = useState({ ...defaultRelationshipColors });
  const [showLegend, setShowLegend] = useState(() => {
    // Initialize from localStorage or default to true
    try {
      const savedShowLegend = localStorage.getItem('showLegend');
      return savedShowLegend !== null ? JSON.parse(savedShowLegend) : true;
    } catch (e) {
      return true;
    }
  });
  
  // Ref to track whether a shape update is pending to avoid duplicate updates
  const pendingShapeUpdate = useRef(false);
  
  // Ref to track the last update time for debouncing
  const lastUpdateTime = useRef(0);
  
  // Get node size - memoized to prevent unnecessary recalculations
  const getNodeSize = useCallback((d) => {
    try {
      // Get the node type
      const nodeType = getNodeType(d || {});
      
      // Directly access size from current state
      const size = nodeSizes[nodeType] || 20;
      console.log(`Retrieving size for node type ${nodeType}: ${size}`);
      return size;
    } catch (err) {
      console.warn('Error getting node size:', err);
      return 20; // Default fallback size
    }
  }, [nodeSizes]);
  
  // Get node color - memoized to prevent unnecessary recalculations
  const getNodeColor = useCallback((d) => {
    try {
      // First check if the node already has a color property from the search results
      if (d && d.color) {
        return d.color;
      }
      
      // Otherwise get the node type and look up the color from the nodeColors state
      const nodeType = getNodeType(d || {});
      return (nodeColors && nodeColors[nodeType]) || '#4b5563'; // Default to gray
    } catch (err) {
      console.warn('Error getting node color:', err);
      return '#4b5563'; // Default fallback color
    }
  }, [nodeColors]);
  
  // Convert shape name to D3 symbol type - memoized
  const getShapeSymbol = useCallback((shapeName) => {
    try {
      // If it's already a function, return it
      if (typeof shapeName === 'function') {
        return shapeName;
      }
      
      // If it's a string, look it up in the shape map
      if (typeof shapeName === 'string') {
        // Log the shape lookup for debugging
        console.log(`GraphView: Converting shape name to symbol: ${shapeName}`);
        
        if (shapeMap[shapeName]) {
          return shapeMap[shapeName];
        } else {
          console.warn(`GraphView: Unknown shape name: ${shapeName}, defaulting to circle`);
        }
      }
      
      // Default to circle if not found
      return d3.symbolCircle;
    } catch (err) {
      console.warn('Error getting shape symbol:', err);
      return d3.symbolCircle; // Default fallback
    }
  }, []);
  
  // Get node shape - memoized to prevent unnecessary recalculations
  const getNodeShape = useCallback((d) => {
    try {
      // First check if the node has a direct shape property
      if (d && d.shape) {
        return getShapeSymbol(d.shape);
      }
      
      // Otherwise get the node type and look up the shape from nodeShapes state
      const nodeType = getNodeType(d || {});
      const shapeName = (nodeShapes && nodeShapes[nodeType]) || 'circle';
      
      return getShapeSymbol(shapeName);
    } catch (err) {
      console.warn('Error getting node shape:', err);
      return d3.symbolCircle; // Default fallback shape
    }
  }, [nodeShapes, getShapeSymbol]);

  // Get relationship color - memoized to prevent unnecessary recalculations
  const getRelationshipColor = useCallback((d) => {
    const type = d.type || 'Default';
    return relationshipColors[type] || relationshipColors.Default;
  }, [relationshipColors]);

  // Toggle legend visibility
  const toggleLegend = (visible) => {
    setShowLegend(visible);
    try {
      localStorage.setItem('showLegend', JSON.stringify(visible));
    } catch (error) {
      console.warn('Could not save legend visibility to localStorage', error);
    }
  };

  // Function to update nodes appearance (extract this logic to reuse it)
  const updateNodesAppearance = useCallback(() => {
    if (!simulation || !svgRef.current || !data || !data.nodes || data.nodes.length === 0) return;
    
    console.log('GraphView: Manually updating node appearances');
    console.log('Current nodeColors:', nodeColors);
    console.log('Current nodeShapes:', nodeShapes);
    console.log('Current nodeSizes:', nodeSizes);
    
    try {
      // Select all node paths
      const paths = d3.select(svgRef.current)
        .selectAll('g.nodes g.node-group path');
        
      console.log(`GraphView: Found ${paths.size()} nodes to update`);
      
      // Update each node directly with new shapes and colors
      paths.each(function(d) {
        const path = d3.select(this);
        const nodeType = getNodeType(d);
        
        // Get color from current state
        const color = getNodeColor(d);
        console.log(`GraphView: Updating node ${d.id || 'unknown'} (type: ${nodeType}) with color: ${color}`);
        
        // Get shape name from current state - with validation to ensure it's a string
        let shapeName = nodeShapes[nodeType] || 'circle';
        // Validate shape - if it's not a string or not in shapeMap, default to circle
        if (typeof shapeName !== 'string' || !shapeMap[shapeName]) {
          console.warn(`Invalid shape for ${nodeType}: ${JSON.stringify(shapeName)}, defaulting to circle`);
          shapeName = 'circle';
        }
        
        // Get size from current state - directly use nodeSizes state for accurate values
        const currentSize = nodeSizes[nodeType] || 20;
        console.log(`GraphView: Updating node ${d.id || 'unknown'} with size: ${currentSize}`);
        
        // Get the correct D3 symbol type using the shape map
        const symbolType = shapeMap[shapeName];
        if (!symbolType) {
          console.error(`Invalid shape name: ${shapeName} for node type: ${nodeType}`);
        }
        
        // Update the color (applying the current state)
        path.attr('fill', color);
        
        // Create a fresh symbol generator for this specific node with current size
        // Use Math.PI * size^2 * 2 formula to ensure size is visually proportional
        const symbolGen = d3.symbol()
          .type(symbolType || d3.symbolCircle) // Fallback to circle if symbol type is invalid
          .size(Math.PI * currentSize * currentSize * 2);
        
        // Update the path data with the new shape and size
        const newPath = symbolGen();
        path.attr('d', newPath);
        
        // Log the updated node size and shape
        console.log(`GraphView: Node ${d.id} updated to size ${currentSize} and shape ${shapeName}`);
      });
      
      // Update relationship colors
      const links = d3.select(svgRef.current)
        .selectAll('g.links line');
        
      links.each(function(d) {
        const color = getRelationshipColor(d);
        d3.select(this).attr('stroke', color);
      });
      
      // Force a more aggressive simulation update to ensure shapes are redrawn
      simulation.alpha(0.5).restart();
      
    } catch (error) {
      console.error('GraphView: Error updating node appearances:', error);
      console.error(error.stack);
    }
  }, [simulation, svgRef, data, getNodeColor, getNodeSize, getRelationshipColor, nodeShapes, nodeColors, nodeSizes]);
  
  // Handle shape selection from the legend with proper update enforcement
  const handleShapeSelect = useCallback((nodeType, shape) => {
    // First check if the shape is different from current shape to avoid unnecessary updates
    if (nodeShapes[nodeType] === shape) {
      console.log(`GraphView: Shape for ${nodeType} is already ${shape}, skipping update`);
      return; // No need to update
    }
    
    console.log(`GraphView: Setting shape for ${nodeType} to ${shape}`);
    
    // Create a new shapes object with the updated shape - use this directly in redraw
    const updatedShapes = { ...nodeShapes, [nodeType]: shape };
    
    // Save to localStorage
    try {
      localStorage.setItem('nodeShapes', JSON.stringify(updatedShapes));
      console.log(`GraphView: Saved node shapes to localStorage:`, updatedShapes);
    } catch (error) {
      console.warn('Could not save shape preferences to localStorage', error);
    }
    
    // Update the state with function form to ensure we're working with the latest state
    setNodeShapes(prevShapes => ({ ...prevShapes, [nodeType]: shape }));
    
    // Force immediate redraw without waiting for state update
    if (data && svgRef.current && simulation) {
      console.log('GraphView: Forcing immediate redraw with new shape:', shape);
      
      // Use a short delay to ensure state updates have been applied
      setTimeout(() => {
        // Stop the current simulation
        simulation.stop();
        
        // Clear the current graph
        d3.select(svgRef.current).selectAll("*").remove();
        
        // Create a shallow copy of the data for the new graph
        const forceRedrawData = {
          nodes: [...data.nodes],
          links: [...data.links]
        };
        
        // Draw the graph with the updated shapes
        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;
        
        // Create SVG container
        const svg = d3.select(svgRef.current)
          .attr("width", width)
          .attr("height", height)
          .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
          }));
        
        // Add group for the graph
        const g = svg.append("g");
        
        // Create the force simulation
        const newSim = d3.forceSimulation(forceRedrawData.nodes)
          .force("link", d3.forceLink(forceRedrawData.links)
            .id(d => d.id)
            .distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide().radius(d => {
            const nodeType = getNodeType(d);
            const size = nodeSizes[nodeType] || 20;
            return size + 10;
          }));
        
        // Create the links
        const link = g.append("g")
          .attr("class", "links")
          .selectAll("line")
          .data(forceRedrawData.links)
          .enter().append("line")
          .attr("class", "graph-link")
          .attr("stroke", d => getRelationshipColor(d))
          .attr("stroke-width", 1.5);
        
        // Create link labels
        const linkText = g.append("g")
          .attr("class", "link-labels")
          .selectAll("text")
          .data(forceRedrawData.links)
          .enter().append("text")
          .attr("class", "link-label")
          .text(d => d.type || d.label || "");
        
        // Create the nodes
        const node = g.append("g")
          .attr("class", "nodes")
          .selectAll("g")
          .data(forceRedrawData.nodes)
          .enter().append("g")
          .attr("class", "node-group")
          .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
          .on("click", (event, d) => {
            event.stopPropagation();
            onNodeSelect(d);
          });
        
        // Create shapes for nodes - using the current state consistently
        node.append("path")
          .attr("d", d => {
            try {
              // Get the node type and determine the shape
              const nType = getNodeType(d);
              // Use the updated shapes with the current state
              const shapeName = (nType === nodeType) ? shape : (updatedShapes[nType] || 'circle');
              
              // Directly access size from current state
              const currentSize = nodeSizes[nType] || 20;
              console.log(`Using size for node ${d.id || 'unknown'} (type: ${nType}): ${currentSize}`);
              
              // Get the symbol type from the shape map
              const symbolType = shapeMap[shapeName] || d3.symbolCircle;
              
              // Create a symbol generator
              return d3.symbol()
                .type(symbolType)
                .size(Math.PI * currentSize * currentSize * 2)();
            } catch (err) {
              console.error('Error generating path for node:', d, err);
              return d3.symbol().type(d3.symbolCircle).size(400)();
            }
          })
          .attr("fill", d => getNodeColor(d))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);
        
        // Add text backgrounds
        node.append("rect")
          .attr("class", "node-label-bg")
          .attr("y", 20)
          .attr("x", -40)
          .attr("width", 80)
          .attr("height", 15)
          .attr("fill", "#e5e5e5")
          .attr("opacity", 0.6)
          .attr("rx", 3)
          .attr("ry", 3);
        
        // Add text labels
        node.append("text")
          .attr("dy", 30)
          .attr("text-anchor", "middle")
          .attr("class", "node-label")
          .text(d => {
            if (d.properties && d.properties.name) return d.properties.name;
            if (d.properties && d.properties.test_case_id) return d.properties.test_case_id;
            if (d.name) return d.name;
            return d.id;
          })
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("stroke", "white")
          .attr("stroke-width", "0.3px")
          .attr("fill", "#000");
        
        // Handle node drag events
        function dragstarted(event, d) {
          if (!event.active) newSim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        
        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }
        
        function dragended(event, d) {
          if (!event.active) newSim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        
        // Simulation tick function
        newSim.on("tick", () => {
          link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
          
          linkText
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);
          
          node
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
        });
        
        // Start with a high alpha to ensure proper layout
        newSim.alpha(1).restart();
        
        // Set the new simulation in state
        setSimulation(newSim);
      }, 50); // Short delay to ensure state updates are applied
    }
  }, [data, svgRef, simulation, nodeShapes, nodeSizes, nodeColors, relationshipColors, getNodeColor, getNodeSize, getRelationshipColor, onNodeSelect]);
  
  // Testing function for direct shape overrides (for debugging)
  const testShapeUpdate = useCallback(() => {
    if (!simulation || !svgRef.current || !data || !data.nodes || data.nodes.length === 0) return;
    
    console.log('GraphView: TESTING direct shape update without state changes');
    
    try {
      // Select all node paths
      const paths = d3.select(svgRef.current)
        .selectAll('g.nodes g.node-group path');
      
      // For each node, force the shape to square for testing
      paths.each(function(d) {
        d3.select(this).attr('d', d3.symbol().type(d3.symbolSquare).size(800)());
      });
      
      simulation.alpha(0.5).restart();
    } catch (error) {
      console.error('Error in test shape update:', error);
    }
  }, [simulation, svgRef, data]);
  
  // Add a specific effect that watches nodeShapes and forces updates
  useEffect(() => {
    if (nodeShapes && Object.keys(nodeShapes).length > 0 && data && data.nodes && data.nodes.length > 0) {
      console.log('GraphView: nodeShapes changed, need to ensure shapes are updated');
      
      // Rather than duplicating all the code for redrawing, we'll rely on updateNodesAppearance
      // which can handle shape updates along with colors and sizes
      if (simulation && svgRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          updateNodesAppearance();
        });
      }
    }
  }, [nodeShapes, data, simulation, svgRef, updateNodesAppearance]);

  // Update node colors and sizes after they change in state
  useEffect(() => {
    // Check if we have all the necessary parts to update the appearance
    if (simulation && svgRef.current && data && data.nodes && data.nodes.length > 0) {
      console.log('GraphView: State change detected, updating appearances');
      console.log('- nodeColors changed:', nodeColors);
      console.log('- nodeSizes changed:', nodeSizes);
      console.log('- relationshipColors changed:', relationshipColors);
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updateNodesAppearance();
      });
    }
  }, [nodeColors, nodeSizes, relationshipColors, updateNodesAppearance, simulation, data]);
  
  // Load saved configurations from localStorage on component mount
  useEffect(() => {
    try {
      // Load node shapes
      const savedShapes = localStorage.getItem('nodeShapes');
      if (savedShapes) {
        setNodeShapes(JSON.parse(savedShapes));
      }
      
      // Load node colors
      const savedColors = localStorage.getItem('nodeColors');
      if (savedColors) {
        setNodeColors(JSON.parse(savedColors));
      }
      
      // Load node sizes
      const savedSizes = localStorage.getItem('nodeSizes');
      if (savedSizes) {
        setNodeSizes(JSON.parse(savedSizes));
      }
      
      // Load relationship colors
      const savedRelColors = localStorage.getItem('relationshipColors');
      if (savedRelColors) {
        setRelationshipColors(JSON.parse(savedRelColors));
      }
    } catch (error) {
      console.warn('Error loading saved configurations from localStorage', error);
    }
  }, []);

  // Update colors and sizes when customConfig changes
  useEffect(() => {
    if (customConfig && Object.keys(customConfig).length > 0) {
      console.log('GraphView: Received updated customConfig:', customConfig);
      
      if (customConfig.colors && Object.keys(customConfig.colors).length > 0) {
        console.log('GraphView: Updating node colors');
        setNodeColors(prevColors => ({
          ...defaultNodeColors,
          ...prevColors,
          ...customConfig.colors
        }));
      }
      
      if (customConfig.sizes && Object.keys(customConfig.sizes).length > 0) {
        console.log('GraphView: Updating node sizes');
        setNodeSizes(prevSizes => ({
          ...defaultNodeSizes,
          ...prevSizes,
          ...customConfig.sizes
        }));
      }
      
      if (customConfig.shapes && Object.keys(customConfig.shapes).length > 0) {
        console.log('GraphView: Updating node shapes:', customConfig.shapes);
        setNodeShapes(prevShapes => ({
          ...defaultNodeShapes,
          ...prevShapes,
          ...customConfig.shapes
        }));
      }
      
      if (customConfig.relationshipColors && Object.keys(customConfig.relationshipColors).length > 0) {
        console.log('GraphView: Updating relationship colors');
        setRelationshipColors(prevColors => ({
          ...defaultRelationshipColors,
          ...prevColors,
          ...customConfig.relationshipColors
        }));
      }
    }
  }, [customConfig]);

  // Add debug logging to track shape changes
  useEffect(() => {
    console.log('GraphView: nodeShapes updated:', nodeShapes);
  }, [nodeShapes]);
  
  // Initial graph setup - only runs when data changes
  useEffect(() => {
    let sim = null;
    
    try {
      if (!data || !data.nodes || !data.links || data.nodes.length === 0) return;
      if (!svgRef.current) return;
      
      console.log('Drawing initial graph with:', { 
        nodes: data.nodes.length, 
        links: data.links.length,
        colors: nodeColors, 
        shapes: nodeShapes 
      });
      
      // Clear previous graph (important to avoid duplicate elements and memory leaks)
      if (simulation) {
        simulation.stop();
      }
      d3.select(svgRef.current).selectAll("*").remove();
      
      const width = svgRef.current.clientWidth || 800;
      const height = svgRef.current.clientHeight || 600;
      
      // Create the SVG container
      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
        }));
      
      // Add a group for the graph
      const g = svg.append("g");
      
      // Create the force simulation
      sim = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links)
          .id(d => d.id)
          .distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => {
          const nodeType = getNodeType(d);
          const size = nodeSizes[nodeType] || 20;
          return size + 10;
        }));
      
      // Create the links
      const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("class", "graph-link")
        .attr("stroke", d => getRelationshipColor(d))
        .attr("stroke-width", 1.5);
      
      // Create link labels
      const linkText = g.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("class", "link-label")
        .text(d => d.type || d.label || "");
      
      // Create the nodes
      const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(data.nodes)
        .enter().append("g")
        .attr("class", "node-group")
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
        .on("click", (event, d) => {
          event.stopPropagation();
          onNodeSelect(d);
        });
      
      // Create shapes for nodes
      node.append("path")
        .attr("d", d => {
          try {
            // Get the node type and determine the shape
            const nodeType = getNodeType(d);
            const shapeName = nodeShapes[nodeType] || 'circle';
            
            // Directly access size from current state 
            const currentSize = nodeSizes[nodeType] || 20;
            console.log(`Initial rendering, node ${d.id || 'unknown'} (type: ${nodeType}) size: ${currentSize}`);
            
            // Get the symbol type from the shape map
            const symbolType = shapeMap[shapeName] || d3.symbolCircle;
            
            // Create a symbol generator
            return d3.symbol()
              .type(symbolType)
              .size(Math.PI * currentSize * currentSize * 2)();
          } catch (err) {
            console.error('Error generating path for node:', d, err);
            return d3.symbol().type(d3.symbolCircle).size(400)();
          }
        })
        .attr("fill", d => getNodeColor(d))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
      
      // Add text backgrounds
      node.append("rect")
        .attr("class", "node-label-bg")
        .attr("y", 20)
        .attr("x", -40)
        .attr("width", 80)
        .attr("height", 15)
        .attr("fill", "#e5e5e5")
        .attr("opacity", 0.6)
        .attr("rx", 3)
        .attr("ry", 3);
      
      // Add text labels
      node.append("text")
        .attr("dy", 30)
        .attr("text-anchor", "middle")
        .attr("class", "node-label")
        .text(d => {
          if (d.properties && d.properties.name) return d.properties.name;
          if (d.properties && d.properties.test_case_id) return d.properties.test_case_id;
          if (d.name) return d.name;
          return d.id;
        })
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("stroke", "white")
        .attr("stroke-width", "0.3px")
        .attr("fill", "#000");
      
      // Handle node drag events
      function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      
      // Simulation tick function
      sim.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);
        
        linkText
          .attr("x", d => (d.source.x + d.target.x) / 2)
          .attr("y", d => (d.source.y + d.target.y) / 2);
        
        node
          .attr("transform", d => `translate(${d.x}, ${d.y})`);
      });
      
      setSimulation(sim);
    } catch (err) {
      console.error('Error setting up force simulation:', err);
    }
    
    // Always include a cleanup function that stops the simulation and removes event listeners
    return () => {
      if (sim) {
        sim.stop();
      }
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll("*").remove();
      }
    };
  }, [data, onNodeSelect, getNodeColor, getNodeSize, getNodeShape, getRelationshipColor]);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (simulation && svgRef.current) {
        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;
        
        simulation
          .force("center", d3.forceCenter(width / 2, height / 2))
          .alpha(0.3)
          .restart();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [simulation]);
  
  // Add the styles to the document
  useEffect(() => {
    // Only add the styles once
    if (!document.getElementById('legend-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'legend-styles';
      styleEl.innerHTML = legendStyles;
      document.head.appendChild(styleEl);
      
      return () => {
        // Cleanup when component unmounts
        const styleElement = document.getElementById('legend-styles');
        if (styleElement) {
          document.head.removeChild(styleElement);
        }
      };
    }
  }, []);

  // Handle config changes from the legend
  const handleNodeConfigChange = useCallback((config) => {
    console.log('GraphView: handleNodeConfigChange called with:', config);
    let needsRedraw = false;
    
    // Update colors if provided
    if (config.colors) {
      console.log('GraphView: Setting nodeColors state with:', config.colors);
      setNodeColors(prevColors => {
        // Use function form to ensure we're working with the latest state
        return { ...prevColors, ...config.colors };
      });
      needsRedraw = needsRedraw || config.isColorChange;
    }
    
    // Update sizes if provided
    if (config.sizes) {
      console.log('GraphView: Setting nodeSizes state with:', config.sizes);
      console.log('GraphView: Current nodeSizes before update:', nodeSizes);
      console.log('GraphView: isSizeChange flag is:', config.isSizeChange);
      
      setNodeSizes(prevSizes => {
        // Use function form to ensure we're working with the latest state
        const updatedSizes = { ...prevSizes, ...config.sizes };
        console.log('GraphView: New nodeSizes will be:', updatedSizes);
        return updatedSizes;
      });
      
      // Size changes need special handling for collision force
      if (config.isSizeChange && simulation) {
        console.log('GraphView: Updating collision force with new sizes');
        simulation.force("collide", d3.forceCollide().radius(d => {
          const nodeType = getNodeType(d);
          const newSize = (config.sizes[nodeType] || nodeSizes[nodeType] || 20);
          console.log(`GraphView: Using collision size ${newSize} for node type ${nodeType}`);
          return newSize + 10;
        }));
        
        // Restart simulation with new collision radius
        simulation.alpha(0.3).restart();
      }
      
      needsRedraw = needsRedraw || config.isSizeChange;
    }
    
    // Update shapes if provided
    if (config.shapes) {
      console.log('GraphView: Setting nodeShapes state with:', config.shapes);
      setNodeShapes(prevShapes => {
        // Use function form to ensure we're working with the latest state
        return { ...prevShapes, ...config.shapes };
      });
    }
    
    // Update relationship colors if provided
    if (config.relationshipColors) {
      console.log('GraphView: Setting relationshipColors state with:', config.relationshipColors);
      setRelationshipColors(prevColors => {
        // Use function form to ensure we're working with the latest state
        return { ...prevColors, ...config.relationshipColors };
      });
      needsRedraw = needsRedraw || config.isColorChange;
    }
    
    // Only force immediate redraw for shape changes
    if (config.isShapeChange && config.shapes && data && svgRef.current && simulation) {
      console.log('GraphView: Forcing complete redraw due to shape change');
      
      // Use a short delay to ensure state updates have been applied
      setTimeout(() => {
        // Stop the current simulation
        simulation.stop();
        
        // Clear the current graph
        d3.select(svgRef.current).selectAll("*").remove();
        
        // Create a shallow copy of the data for the new graph
        const forceRedrawData = {
          nodes: [...data.nodes],
          links: [...data.links]
        };
        
        // Draw the graph with the updated shapes
        const width = svgRef.current.clientWidth || 800;
        const height = svgRef.current.clientHeight || 600;
        
        // Create SVG container
        const svg = d3.select(svgRef.current)
          .attr("width", width)
          .attr("height", height)
          .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
          }));
        
        // Add group for the graph
        const g = svg.append("g");
        
        // Create the force simulation
        const newSim = d3.forceSimulation(forceRedrawData.nodes)
          .force("link", d3.forceLink(forceRedrawData.links)
            .id(d => d.id)
            .distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide().radius(d => {
            const nodeType = getNodeType(d);
            const size = nodeSizes[nodeType] || 20;
            return size + 10;
          }));
        
        // Create the links
        const link = g.append("g")
          .attr("class", "links")
          .selectAll("line")
          .data(forceRedrawData.links)
          .enter().append("line")
          .attr("class", "graph-link")
          .attr("stroke", d => getRelationshipColor(d))
          .attr("stroke-width", 1.5);
        
        // Create link labels
        const linkText = g.append("g")
          .attr("class", "link-labels")
          .selectAll("text")
          .data(forceRedrawData.links)
          .enter().append("text")
          .attr("class", "link-label")
          .text(d => d.type || d.label || "");
        
        // Create the nodes
        const node = g.append("g")
          .attr("class", "nodes")
          .selectAll("g")
          .data(forceRedrawData.nodes)
          .enter().append("g")
          .attr("class", "node-group")
          .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
          .on("click", (event, d) => {
            event.stopPropagation();
            onNodeSelect(d);
          });
        
        // Create shapes for nodes - using the latest state to make sure we have the most recent values
        node.append("path")
          .attr("d", d => {
            try {
              // Get the node type and determine the shape
              const nType = getNodeType(d);
              
              // Use the most up-to-date state for the shape
              const updatedShapes = config.shapes || nodeShapes;
              const shapeName = updatedShapes[nType] || 'circle';
              
              // Use the most up-to-date state for the size
              const nodeSize = getNodeSize(d);
              
              // Get the symbol type from the shape map
              const symbolType = shapeMap[shapeName] || d3.symbolCircle;
              
              // Create a symbol generator
              return d3.symbol()
                .type(symbolType)
                .size(Math.PI * nodeSize * nodeSize * 2)();
            } catch (err) {
              console.error('Error generating path for node:', d, err);
              return d3.symbol().type(d3.symbolCircle).size(400)();
            }
          })
          .attr("fill", d => getNodeColor(d))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);
        
        // Add text backgrounds
        node.append("rect")
          .attr("class", "node-label-bg")
          .attr("y", 20)
          .attr("x", -40)
          .attr("width", 80)
          .attr("height", 15)
          .attr("fill", "#e5e5e5")
          .attr("opacity", 0.6)
          .attr("rx", 3)
          .attr("ry", 3);
        
        // Add text labels
        node.append("text")
          .attr("dy", 30)
          .attr("text-anchor", "middle")
          .attr("class", "node-label")
          .text(d => {
            if (d.properties && d.properties.name) return d.properties.name;
            if (d.properties && d.properties.test_case_id) return d.properties.test_case_id;
            if (d.name) return d.name;
            return d.id;
          })
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("stroke", "white")
          .attr("stroke-width", "0.3px")
          .attr("fill", "#000");
        
        // Handle node drag events
        function dragstarted(event, d) {
          if (!event.active) newSim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        
        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }
        
        function dragended(event, d) {
          if (!event.active) newSim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        
        // Simulation tick function
        newSim.on("tick", () => {
          link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
          
          linkText
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);
          
          node
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
        });
        
        // Start with a high alpha to ensure proper layout
        newSim.alpha(1).restart();
        
        // Set the new simulation in state
        setSimulation(newSim);
      }, 50); // Short delay to ensure state is updated
    } else if (needsRedraw && !config.isShapeChange) {
      // For non-shape changes, we can update in place with updateNodesAppearance
      console.log('GraphView: Scheduling appearance update for color/size changes');
      
      // Use a short delay to ensure state updates have been applied
      setTimeout(() => {
        updateNodesAppearance();
      }, 50);
    }
  }, [data, svgRef, simulation, updateNodesAppearance, onNodeSelect, getNodeColor, getNodeSize, getRelationshipColor, nodeColors, nodeSizes, nodeShapes, relationshipColors]);

  // Add debug function to window for direct testing
  useEffect(() => {
    // Add a debug function to directly test size changes
    window.debugUpdateNodeSize = (nodeType, newSize) => {
      console.log(`DEBUG: Manually setting size for ${nodeType} to ${newSize}`);
      
      // Update the state directly
      setNodeSizes(prevSizes => {
        const updatedSizes = { ...prevSizes, [nodeType]: newSize };
        console.log('DEBUG: New nodeSizes will be:', updatedSizes);
        return updatedSizes;
      });
      
      // Force update after state changes
      setTimeout(() => {
        console.log('DEBUG: Forcing updateNodesAppearance after size change');
        updateNodesAppearance();
      }, 100);
    };
    
    // Add export function to get current configuration
    window.exportGraphConfig = () => {
      const config = {
        nodeColors,
        nodeShapes,
        nodeSizes,
        relationshipColors
      };
      
      // Create a downloadable file with the config
      const dataStr = JSON.stringify(config, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      // Create a link element and trigger the download
      const exportFileDefaultName = 'graph-config.json';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      console.log('Configuration exported to graph-config.json');
      return config;
    };
    
    // Add import function to load saved configuration
    window.importGraphConfig = (configData) => {
      try {
        const config = typeof configData === 'string' ? JSON.parse(configData) : configData;
        
        // Update state with imported configuration
        if (config.nodeColors) {
          setNodeColors(config.nodeColors);
          localStorage.setItem('nodeColors', JSON.stringify(config.nodeColors));
        }
        
        if (config.nodeShapes) {
          // Validate shapes before setting
          const validShapes = {};
          Object.entries(config.nodeShapes).forEach(([type, shape]) => {
            if (typeof shape === 'string' && shapeMap[shape]) {
              validShapes[type] = shape;
            } else {
              validShapes[type] = 'circle'; // Default to circle for invalid shapes
            }
          });
          
          setNodeShapes(validShapes);
          localStorage.setItem('nodeShapes', JSON.stringify(validShapes));
        }
        
        if (config.nodeSizes) {
          setNodeSizes(config.nodeSizes);
          localStorage.setItem('nodeSizes', JSON.stringify(config.nodeSizes));
        }
        
        if (config.relationshipColors) {
          setRelationshipColors(config.relationshipColors);
          localStorage.setItem('relationshipColors', JSON.stringify(config.relationshipColors));
        }
        
        // Force an update to apply the changes
        setTimeout(() => {
          updateNodesAppearance();
        }, 100);
        
        console.log('Configuration imported successfully');
        return true;
      } catch (error) {
        console.error('Error importing configuration:', error);
        return false;
      }
    };
    
    // Add a reset function to restore defaults
    window.resetGraphConfig = () => {
      // Set states back to defaults
      setNodeColors({...defaultNodeColors});
      setNodeShapes({...defaultNodeShapes});
      setNodeSizes({...defaultNodeSizes});
      setRelationshipColors({...defaultRelationshipColors});
      
      // Clear localStorage
      localStorage.removeItem('nodeColors');
      localStorage.removeItem('nodeShapes');
      localStorage.removeItem('nodeSizes');
      localStorage.removeItem('relationshipColors');
      
      // Force update
      setTimeout(() => {
        updateNodesAppearance();
      }, 100);
      
      console.log('Graph configuration reset to defaults');
    };
    
    return () => {
      // Cleanup
      delete window.debugUpdateNodeSize;
      delete window.exportGraphConfig;
      delete window.importGraphConfig;
      delete window.resetGraphConfig;
    };
  }, [nodeColors, nodeShapes, nodeSizes, relationshipColors, updateNodesAppearance]); // Include all dependencies

  // Add a function to fix invalid shapes in state
  const validateAndFixNodeShapes = useCallback(() => {
    setNodeShapes(prevShapes => {
      const validShapes = {};
      let needsFix = false;
      
      Object.entries(prevShapes).forEach(([type, shape]) => {
        if (typeof shape !== 'string' || !shapeMap[shape]) {
          console.warn(`Found invalid shape for ${type}: ${JSON.stringify(shape)}, fixing to circle`);
          validShapes[type] = 'circle';
          needsFix = true;
        } else {
          validShapes[type] = shape;
        }
      });
      
      if (needsFix) {
        console.log('Fixed invalid shapes:', validShapes);
        // Save fixed shapes to localStorage
        try {
          localStorage.setItem('nodeShapes', JSON.stringify(validShapes));
        } catch (error) {
          console.warn('Could not save fixed shapes to localStorage', error);
        }
        return validShapes;
      }
      
      return prevShapes;
    });
  }, []);

  // Call the validation function when component mounts
  useEffect(() => {
    validateAndFixNodeShapes();
  }, [validateAndFixNodeShapes]);

  // Add handlers for the config actions
  const handleExportConfig = useCallback(() => {
    const config = {
      nodeColors,
      nodeShapes,
      nodeSizes,
      relationshipColors
    };
    
    // Create a downloadable file with the config
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    // Create a link element and trigger the download
    const exportFileDefaultName = 'graph-config.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    console.log('Configuration exported to graph-config.json');
  }, [nodeColors, nodeShapes, nodeSizes, relationshipColors]);
  
  const handleImportConfig = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        
        // Update state with imported configuration
        if (config.nodeColors) {
          setNodeColors(config.nodeColors);
          localStorage.setItem('nodeColors', JSON.stringify(config.nodeColors));
        }
        
        if (config.nodeShapes) {
          // Validate shapes before setting
          const validShapes = {};
          Object.entries(config.nodeShapes).forEach(([type, shape]) => {
            if (typeof shape === 'string' && shapeMap[shape]) {
              validShapes[type] = shape;
            } else {
              validShapes[type] = 'circle'; // Default to circle for invalid shapes
            }
          });
          
          setNodeShapes(validShapes);
          localStorage.setItem('nodeShapes', JSON.stringify(validShapes));
        }
        
        if (config.nodeSizes) {
          setNodeSizes(config.nodeSizes);
          localStorage.setItem('nodeSizes', JSON.stringify(config.nodeSizes));
        }
        
        if (config.relationshipColors) {
          setRelationshipColors(config.relationshipColors);
          localStorage.setItem('relationshipColors', JSON.stringify(config.relationshipColors));
        }
        
        // Force an update to apply the changes
        setTimeout(() => {
          updateNodesAppearance();
        }, 100);
        
        console.log('Configuration imported successfully');
      } catch (error) {
        console.error('Error importing configuration:', error);
        alert('Failed to import configuration file. Please check the file format.');
      }
      
      // Reset the file input
      event.target.value = null;
    };
    
    reader.readAsText(file);
  }, [updateNodesAppearance]);
  
  const handleResetConfig = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all graph settings to defaults?')) {
      // Set states back to defaults
      setNodeColors({...defaultNodeColors});
      setNodeShapes({...defaultNodeShapes});
      setNodeSizes({...defaultNodeSizes});
      setRelationshipColors({...defaultRelationshipColors});
      
      // Clear localStorage
      localStorage.removeItem('nodeColors');
      localStorage.removeItem('nodeShapes');
      localStorage.removeItem('nodeSizes');
      localStorage.removeItem('relationshipColors');
      
      // Force update
      setTimeout(() => {
        updateNodesAppearance();
      }, 100);
      
      console.log('Graph configuration reset to defaults');
    }
  }, [updateNodesAppearance]);

  return (
    <div className="graph-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef} className="graph-svg" style={{ width: '100%', height: '100%' }}></svg>
      {(!data || !data.nodes || data.nodes.length === 0) && (
        <div className="graph-placeholder">
          <p>Search or select a node to visualize the knowledge graph</p>
        </div>
      )}
      {data && data.nodes && data.nodes.length > 0 && (
        <>
          {showLegend ? (
            <Legend 
              data={data || { nodes: [], links: [] }}
              initialConfig={{ 
                colors: nodeColors, 
                sizes: nodeSizes, 
                shapes: nodeShapes, 
                relationshipColors: relationshipColors 
              }}
              onNodeConfigChange={handleNodeConfigChange}
              onClose={() => toggleLegend(false)}
            />
          ) : (
            <LegendToggle onClick={() => toggleLegend(true)} />
          )}
          <ConfigActions 
            onExport={handleExportConfig}
            onImport={handleImportConfig}
            onReset={handleResetConfig}
          />
        </>
      )}
    </div>
  );
}

// Export with React.memo and ErrorBoundary to prevent unnecessary re-renders and catch errors
export default React.memo((props) => (
  <ErrorBoundary>
    <GraphView {...props} />
  </ErrorBoundary>
)); 