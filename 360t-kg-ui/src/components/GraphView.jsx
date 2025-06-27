import React, { useEffect, useRef, useState, Component, useCallback } from 'react';
import * as d3 from 'd3';
import Legend from './Legend';
import LegendToggle from './LegendToggle';
import ConfigActions from './ConfigActions';
import { useGraphSimulation } from './useGraphSimulation.js';
import settingsService from '../services/settingsService';
import { useSettings } from '../hooks/useSettings';

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
  'Document': 'svg:finance-book-svgrepo-com.svg',
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
  
  // Use the new settings service
  const { settings, get, set, update, isReady } = useSettings();
  
  // Extract settings with fallbacks to defaults
  const nodeColors = get('nodeColors') || defaultNodeColors;
  const nodeSizes = get('nodeSizes') || defaultNodeSizes;
  const nodeShapes = get('nodeShapes') || defaultNodeShapes;
  const relationshipColors = get('relationshipColors') || defaultRelationshipColors;
  const relationshipLineStyles = get('relationshipLineStyles') || {};
  const showLegend = get('ui.showLegend') !== undefined ? get('ui.showLegend') : true;
  
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
  
  // Convert shape name to D3 symbol type or return SVG path - memoized
  const getShapeSymbol = useCallback((shapeName) => {
    try {
      // If it's already a function, return it
      if (typeof shapeName === 'function') {
        return shapeName;
      }
      
      // If it's a string, check if it's an SVG or D3 shape
      if (typeof shapeName === 'string') {
        // Log the shape lookup for debugging
        console.log(`GraphView: Converting shape name to symbol: ${shapeName}`);
        
        // If it's an SVG shape, return the string as-is
        if (shapeName.startsWith('svg:')) {
          return shapeName;
        }
        
        // For D3 shapes, look it up in the shape map
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
      
      // Debug logging for Document nodes
      if (nodeType === 'Document') {
        console.log(`GraphView: Document node detected! ID: ${d.id}, Shape: ${shapeName}`);
      }
      
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

  // Get relationship line style (stroke-dasharray)
  const getRelationshipDashArray = useCallback((d) => {
    console.log('relationshipLineStyles object:', relationshipLineStyles);
    const type = d.type || 'Default';
    const style = relationshipLineStyles[type];
    console.log('getRelationshipDashArray for type', type, 'style:', style);
    if (style === 'dashed') return '5,5';
    if (style === 'dotted') return '2,2';
    return '';
  }, [relationshipLineStyles]);

  // Toggle legend visibility
  const toggleLegend = (visible) => {
    if (!isReady) {
      console.warn('GraphView: Settings service not ready, cannot toggle legend');
      return;
    }
    set('ui.showLegend', visible);
  };

  // Function to update nodes and link appearances
  const updateNodesAppearance = useCallback(() => {
    if (!simulation || !svgRef.current || !data || !data.nodes || data.nodes.length === 0) return;
    
    console.log('GraphView: Manually updating node and link appearances');
    console.log('Current nodeColors:', nodeColors);
    console.log('Current nodeShapes:', nodeShapes);
    console.log('Current nodeSizes:', nodeSizes);
    
    try {
      // Update nodes - handle both paths (D3 symbols) and images (SVG icons)
      const nodeGroups = d3.select(svgRef.current)
        .selectAll('g.nodes g.node-group');
      console.log(`GraphView: Found ${nodeGroups.size()} node groups to update`);
      
      nodeGroups.each(function(d) {
        const nodeGroup = d3.select(this);
        const nodeType = getEnhancedNodeType(d);
        const color = getNodeColor(d);
        let shapeName = nodeShapes[nodeType] || 'circle';
        
        // Force Document nodes to use Finance Book icon
        if (nodeType === 'Document') {
          shapeName = 'svg:finance-book-svgrepo-com.svg';
          console.log(`GraphView: updateNodesAppearance - Document node ${d.id} using Finance Book icon`);
        }
        
        const currentSize = nodeSizes[nodeType] || 20;
        
        // Remove existing shape elements
        nodeGroup.selectAll('path, image').remove();
        
        if (shapeName.startsWith('svg:')) {
          // For SVG icons, create an image element
          const svgFile = shapeName.substring(4);
          console.log(`GraphView: updateNodesAppearance - Creating SVG for ${nodeType}: /svg/${svgFile}`);
          nodeGroup.append("image")
            .attr("href", `/svg/${svgFile}`)
            .attr("x", -currentSize)
            .attr("y", -currentSize)
            .attr("width", currentSize * 2)
            .attr("height", currentSize * 2)
            .attr("preserveAspectRatio", "xMidYMid meet");
        } else {
          // For D3 symbols, create a path element
          if (typeof shapeName !== 'string' || !shapeMap[shapeName]) {
            shapeName = 'circle';
          }
          const symbolType = shapeMap[shapeName];
          const symbolGen = d3.symbol()
            .type(symbolType || d3.symbolCircle)
            .size(Math.PI * currentSize * currentSize * 2);
          
          nodeGroup.append("path")
            .attr("d", symbolGen())
            .attr("fill", color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
        }
      });
      
      // Update links
      const links = d3.select(svgRef.current)
        .selectAll('g.links line.graph-link');
      console.log(`GraphView: Found ${links.size()} links to update`);
      links.each(function(d) {
        const color = getRelationshipColor(d);
        const dashArray = getRelationshipDashArray(d);
        console.log('Updating link', d, 'to color', color, 'and dash', dashArray);
        d3.select(this)
          .style('stroke', color)
          .attr('stroke-dasharray', dashArray ? dashArray : null);
      });
      
      simulation.alpha(0.5).restart();
    } catch (error) {
      console.error('GraphView: Error updating appearances:', error);
    }
  }, [simulation, svgRef, data, getNodeColor, getNodeSize, getRelationshipColor, getRelationshipDashArray, nodeShapes, nodeColors, nodeSizes]);
  
  // Handle shape selection from the legend with proper update enforcement
  const handleShapeSelect = useCallback((nodeType, shape) => {
    if (!isReady) {
      console.warn('GraphView: Settings service not ready, cannot update shape');
      return;
    }
    
    // First check if the shape is different from current shape to avoid unnecessary updates
    if (nodeShapes[nodeType] === shape) {
      console.log(`GraphView: Shape for ${nodeType} is already ${shape}, skipping update`);
      return; // No need to update
    }
    
    console.log(`GraphView: Setting shape for ${nodeType} to ${shape}`);
    
    // Update using settings service
    const updatedShapes = { ...nodeShapes, [nodeType]: shape };
    set(`nodeShapes.${nodeType}`, shape);
    
    console.log(`GraphView: Saved node shapes via settings service:`, updatedShapes);
    
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
        
        // Define zoom behavior with scaling
        const zoom = d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
          
          // Dynamically adjust font size and stroke width based on zoom
          const { k } = event.transform;
          g.selectAll(".node-label")
            .attr("font-size", `${Math.max(3, 5 / k)}px`);
            
          g.selectAll(".link-label")
            .attr("font-size", `${Math.max(3, 4 / k)}px`);
            
          g.selectAll(".graph-link")
            .attr("stroke-width", 1.5 / k);
        });

        svg.call(zoom);
        
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
          .attr("font-size", "4px")
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
        
        // Create shapes for nodes - support both D3 symbols and SVG images
        node.each(function(d) {
          const nodeGroup = d3.select(this);
          const nType = getEnhancedNodeType(d);
          let shapeName = nodeShapes[nType] || 'circle';
          
          // Force Document nodes to use Finance Book icon
          if (nType === 'Document') {
            shapeName = 'svg:finance-book-svgrepo-com.svg';
            console.log(`GraphView: Rendering Document node ${d.id} with Finance Book icon`);
          }
          
          const currentSize = nodeSizes[nType] || 20;
          
          if (shapeName.startsWith('svg:')) {
            // For SVG icons, create an image element
            const svgFile = shapeName.substring(4);
            console.log(`GraphView: Creating SVG image for node ${d.id}: /svg/${svgFile}`);
            nodeGroup.append("image")
              .attr("href", `/svg/${svgFile}`)
              .attr("x", -currentSize)
              .attr("y", -currentSize)
              .attr("width", currentSize * 2)
              .attr("height", currentSize * 2)
              .attr("preserveAspectRatio", "xMidYMid meet");
          } else {
            // For D3 symbols, create a path element
            nodeGroup.append("path")
              .attr("d", () => {
                try {
                  const symbolType = shapeMap[shapeName] || d3.symbolCircle;
                  return d3.symbol()
                    .type(symbolType)
                    .size(Math.PI * currentSize * currentSize * 2)();
                } catch (err) {
                  console.error('Error generating path for node:', d, err);
                  return d3.symbol().type(d3.symbolCircle).size(400)();
                }
              })
              .attr("fill", getNodeColor(d))
              .attr("stroke", "#fff")
              .attr("stroke-width", 2);
          }
        });
        
        // Add text backgrounds
        node.append("rect")
          .attr("class", "node-label-bg")
          .attr("y", 20)
          .attr("x", -40)
          .attr("width", 80)
          .attr("height", 15)
          .attr("fill", "#e5e5e5")
          .attr("opacity", 0.2)
          .attr("rx", 3)
          .attr("ry", 3);
        
        // Add text labels (empty for Document nodes)
        node.append("text")
          .attr("dy", 30)
          .attr("text-anchor", "middle")
          .attr("class", "node-label")
          .text(d => {
            // Return empty string for Document nodes
            if (isDocumentNode(d)) {
              return '';
            }
            return d.label || d.id;
          })
          .attr("font-size", "5px")
          .attr("stroke", "white")
          .attr("stroke-width", "0.3px")
          .attr("fill", "#000");
        
        // Add hover tooltips for Document nodes
        node.filter(d => isDocumentNode(d))
          .on("mouseover", function(event, d) {
            const tooltipContent = getDocumentTooltipContent(d);
            if (!tooltipContent) return;
            
            // Remove any existing tooltip
            d3.select("body").selectAll(".document-tooltip").remove();
            
            // Create tooltip
            const tooltip = d3.select("body")
              .append("div")
              .attr("class", "document-tooltip")
              .style("position", "absolute")
              .style("background", "rgba(0, 0, 0, 0.9)")
              .style("color", "white")
              .style("padding", "10px")
              .style("border-radius", "5px")
              .style("font-size", "12px")
              .style("max-width", "300px")
              .style("word-wrap", "break-word")
              .style("z-index", "1000")
              .style("pointer-events", "none")
              .style("opacity", 0);
            
            // Add content to tooltip
            tooltip.html(tooltipContent.length > 500 ? 
              tooltipContent.substring(0, 500) + "..." : 
              tooltipContent);
            
            // Position tooltip
            const [mouseX, mouseY] = d3.pointer(event, document.body);
            tooltip
              .style("left", (mouseX + 10) + "px")
              .style("top", (mouseY - 10) + "px")
              .transition()
              .duration(200)
              .style("opacity", 1);
          })
          .on("mousemove", function(event, d) {
            const tooltip = d3.select(".document-tooltip");
            if (!tooltip.empty()) {
              const [mouseX, mouseY] = d3.pointer(event, document.body);
              tooltip
                .style("left", (mouseX + 10) + "px")
                .style("top", (mouseY - 10) + "px");
            }
          })
          .on("mouseout", function(event, d) {
            // Enhanced cleanup: remove all document tooltips to prevent any stragglers
            d3.select("body").selectAll(".document-tooltip")
              .transition()
              .duration(200)
              .style("opacity", 0)
              .remove();
          });
        
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
  }, [data, svgRef, simulation, nodeShapes, nodeSizes, nodeColors, relationshipColors, getNodeColor, getNodeSize, getRelationshipColor, onNodeSelect, isReady]);
  
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
  
  // Settings are now loaded via the settings service hook, no need for localStorage loading

  // Update colors and sizes when customConfig changes
  useEffect(() => {
    if (!isReady) {
      console.log('GraphView: Settings service not ready, skipping customConfig update');
      return;
    }
    
    if (customConfig && Object.keys(customConfig).length > 0) {
      console.log('GraphView: Received updated customConfig:', customConfig);
      
      if (customConfig.colors && Object.keys(customConfig.colors).length > 0) {
        console.log('GraphView: Updating node colors');
        const updatedColors = {
          ...defaultNodeColors,
          ...settings.nodeColors,
          ...customConfig.colors
        };
        update('nodeColors', updatedColors);
      }
      
      if (customConfig.sizes && Object.keys(customConfig.sizes).length > 0) {
        console.log('GraphView: Updating node sizes');
        const updatedSizes = {
          ...defaultNodeSizes,
          ...settings.nodeSizes,
          ...customConfig.sizes
        };
        update('nodeSizes', updatedSizes);
      }
      
      if (customConfig.shapes && Object.keys(customConfig.shapes).length > 0) {
        console.log('GraphView: Updating node shapes:', customConfig.shapes);
        const updatedShapes = {
          ...defaultNodeShapes,
          ...settings.nodeShapes,
          ...customConfig.shapes
        };
        update('nodeShapes', updatedShapes);
      }
      
      if (customConfig.relationshipColors && Object.keys(customConfig.relationshipColors).length > 0) {
        console.log('GraphView: Updating relationship colors');
        const updatedRelColors = {
          ...defaultRelationshipColors,
          ...settings.relationshipColors,
          ...customConfig.relationshipColors
        };
        update('relationshipColors', updatedRelColors);
      }
      if (customConfig.relationshipLineStyles && Object.keys(customConfig.relationshipLineStyles).length > 0) {
        console.log('GraphView: Updating relationship line styles');
        const updatedLineStyles = {
          ...settings.relationshipLineStyles,
          ...customConfig.relationshipLineStyles
        };
        update('relationshipLineStyles', updatedLineStyles);
      }
    }
  }, [customConfig, isReady, settings, update]);

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
        .attr("height", height);
      
      const g = svg.append("g");

      // Define zoom behavior with scaling
      const zoom = d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        // Dynamically adjust font size and stroke width based on zoom
        const { k } = event.transform;
        g.selectAll(".node-label")
          .attr("font-size", `${Math.max(3, 5 / k)}px`);
          
        g.selectAll(".link-label")
          .attr("font-size", `${Math.max(3, 4 / k)}px`);
          
        g.selectAll(".graph-link")
          .attr("stroke-width", 1.5 / k);
      });

      svg.call(zoom);
      
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
        .attr("stroke-dasharray", d => {
          const dash = getRelationshipDashArray(d);
          return dash ? dash : null;
        })
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");
      
      // Create link labels
      const linkText = g.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("class", "link-label")
        .attr("font-size", "4px")
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
      node.each(function(d) {
        const nodeType = getNodeType(d);
        const shapeName = nodeShapes[nodeType] || 'circle';
        const currentSize = nodeSizes[nodeType] || 20;
        const color = getNodeColor(d);

        const group = d3.select(this);

        if (shapeName.startsWith('svg:')) {
          // SVG icon shape
          const svgFile = shapeName.substring(4);
          group.append('image')
            .attr('href', `/svg/${svgFile}`)
            .attr('x', -currentSize)
            .attr('y', -currentSize)
            .attr('width', currentSize * 2)
            .attr('height', currentSize * 2)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        } else {
          // D3 symbol shape
          const symbolType = shapeMap[shapeName] || d3.symbolCircle;
          const pathData = d3.symbol()
            .type(symbolType)
            .size(Math.PI * currentSize * currentSize * 2)();

          group.append('path')
            .attr('d', pathData)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        }
      });
      
      // Add text backgrounds
      node.append("rect")
        .attr("class", "node-label-bg")
        .attr("y", 20)
        .attr("x", -40)
        .attr("width", 80)
        .attr("height", 15)
        .attr("fill", "#e5e5e5")
        .attr("opacity", 0.2)
        .attr("rx", 3)
        .attr("ry", 3);
      
      // Add text labels (empty for Document nodes)
      node.append("text")
        .attr("dy", 30)
        .attr("text-anchor", "middle")
        .attr("class", "node-label")
        .text(d => {
          // Return empty string for Document nodes
          if (isDocumentNode(d)) {
            return '';
          }
          return d.label || d.id;
        })
        .attr("font-size", "5px")
        .attr("stroke", "white")
        .attr("stroke-width", "0.3px")
        .attr("fill", "#000");
      
      // Add hover tooltips for Document nodes
      node.filter(d => isDocumentNode(d))
        .on("mouseover", function(event, d) {
          const tooltipContent = getDocumentTooltipContent(d);
          if (!tooltipContent) return;
          
          // Remove any existing tooltip
          d3.select("body").selectAll(".document-tooltip").remove();
          
          // Create tooltip
          const tooltip = d3.select("body")
            .append("div")
            .attr("class", "document-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.9)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px")
            .style("max-width", "300px")
            .style("word-wrap", "break-word")
            .style("z-index", "1000")
            .style("pointer-events", "none")
            .style("opacity", 0);
          
          // Add content to tooltip
          tooltip.html(tooltipContent.length > 500 ? 
            tooltipContent.substring(0, 500) + "..." : 
            tooltipContent);
          
          // Position tooltip
          const [mouseX, mouseY] = d3.pointer(event, document.body);
          tooltip
            .style("left", (mouseX + 10) + "px")
            .style("top", (mouseY - 10) + "px")
            .transition()
            .duration(200)
            .style("opacity", 1);
        })
        .on("mousemove", function(event, d) {
          const tooltip = d3.select(".document-tooltip");
          if (!tooltip.empty()) {
            const [mouseX, mouseY] = d3.pointer(event, document.body);
            tooltip
              .style("left", (mouseX + 10) + "px")
              .style("top", (mouseY - 10) + "px");
          }
        })
        .on("mouseout", function(event, d) {
          // Enhanced cleanup: remove all document tooltips to prevent any stragglers
          d3.select("body").selectAll(".document-tooltip")
            .transition()
            .duration(200)
            .style("opacity", 0)
            .remove();
        });
      
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
      // ENHANCED: Clean up any tooltips that may have been created by this component
      d3.select("body").selectAll(".document-tooltip").remove();
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
    if (!isReady) {
      console.warn('GraphView: Settings service not ready, cannot handle config change');
      return;
    }
    
    console.log('GraphView: handleNodeConfigChange called with:', config);
    
    const updates = {};
    let needsRedraw = false;

    // Update colors if provided
    if (config.colors && config.isColorChange) {
      console.log('GraphView: Updating nodeColors via settings service:', config.colors);
      Object.entries(config.colors).forEach(([nodeType, color]) => {
        updates[`nodeColors.${nodeType}`] = color;
      });
      needsRedraw = true;
    }

    // Update sizes if provided
    if (config.sizes && config.isSizeChange) {
      console.log('GraphView: Updating nodeSizes via settings service:', config.sizes);
      Object.entries(config.sizes).forEach(([nodeType, size]) => {
        updates[`nodeSizes.${nodeType}`] = size;
      });
      needsRedraw = true;
    }

    // Update shapes if provided
    if (config.shapes && config.isShapeChange) {
      console.log('GraphView: Updating nodeShapes via settings service:', config.shapes);
      Object.entries(config.shapes).forEach(([nodeType, shape]) => {
        updates[`nodeShapes.${nodeType}`] = shape;
      });
      needsRedraw = true;
    }

    // Update relationship colors if provided
    if (config.relationshipColors && config.isColorChange) {
      console.log('GraphView: Updating relationshipColors via settings service:', config.relationshipColors);
      Object.entries(config.relationshipColors).forEach(([relType, color]) => {
        updates[`relationshipColors.${relType}`] = color;
      });
      needsRedraw = true;
    }

    if (config.relationshipLineStyles && config.isLineStyleChange) {
      console.log('GraphView: Updating relationshipLineStyles via settings service:', config.relationshipLineStyles);
      Object.entries(config.relationshipLineStyles).forEach(([relType, style]) => {
        updates[`relationshipLineStyles.${relType}`] = style;
      });
      needsRedraw = true;
    }

    // Apply all updates at once
    if (Object.keys(updates).length > 0) {
      update(updates);
    }

    // If any configuration change requires a redraw, perform a full redraw
    if (needsRedraw && data && svgRef.current && simulation) {
      console.log('GraphView: Forcing complete redraw due to configuration change');

      // Use a short delay to ensure state updates have been applied before redrawing
      setTimeout(() => {
        // Stop the current simulation
        simulation.stop();

        // Clear the current graph
        d3.select(svgRef.current).selectAll("*").remove();

        // Create a shallow copy of the data for the new graph
        // Ensure nodes have the latest state reflected for size/color/shape lookup during redraw
        const forceRedrawData = {
          nodes: data.nodes.map(n => ({...n})), // Create copies to avoid mutation issues
          links: data.links.map(l => ({...l}))
        };

        // Draw the graph with the updated configurations
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

        // Define zoom behavior with scaling
        const zoom = d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
          
          // Dynamically adjust font size and stroke width based on zoom
          const { k } = event.transform;
          g.selectAll(".node-label")
            .attr("font-size", `${Math.max(3, 5 / k)}px`);
            
          g.selectAll(".link-label")
            .attr("font-size", `${Math.max(3, 4 / k)}px`);
            
          g.selectAll(".graph-link")
            .attr("stroke-width", 1.5 / k);
        });

        svg.call(zoom);
        
        // Create the force simulation
        const newSim = d3.forceSimulation(forceRedrawData.nodes)
          .force("link", d3.forceLink(forceRedrawData.links)
            .id(d => d.id)
            .distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collide", d3.forceCollide().radius(d => {
            const nodeType = getNodeType(d);
            // Use the captured currentSizes state
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
          .attr("stroke-dasharray", d => {
            const dash = getRelationshipDashArray(d);
            return dash ? dash : null;
          })
          .attr("stroke-width", 1.5);

        // Create link labels
        const linkText = g.append("g")
          .attr("class", "link-labels")
          .selectAll("text")
          .data(forceRedrawData.links)
          .enter().append("text")
          .attr("class", "link-label")
          .attr("font-size", "4px")
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

        // Capture latest state for shapes and sizes at the time of redraw
        const currentShapes = nodeShapes;
        // const currentSizes = nodeSizes; // Already captured above

        // Create shapes for nodes - support both D3 symbols and SVG images
        node.each(function(d) {
          const nodeGroup = d3.select(this);
          const nType = getEnhancedNodeType(d);
          let shapeName = currentShapes[nType] || 'circle';
          
          // Force Document nodes to use Finance Book icon
          if (nType === 'Document') {
            shapeName = 'svg:finance-book-svgrepo-com.svg';
            console.log(`GraphView: Force redraw - Document node ${d.id} with Finance Book icon`);
          }
          
          const nodeSize = nodeSizes[nType] || 20;
          
          if (shapeName.startsWith('svg:')) {
            // For SVG icons, create an image element
            const svgFile = shapeName.substring(4);
            console.log(`GraphView: Force redraw - Creating SVG image for node ${d.id}: /svg/${svgFile}`);
            nodeGroup.append("image")
              .attr("href", `/svg/${svgFile}`)
              .attr("x", -nodeSize)
              .attr("y", -nodeSize)
              .attr("width", nodeSize * 2)
              .attr("height", nodeSize * 2)
              .attr("preserveAspectRatio", "xMidYMid meet");
          } else {
            // For D3 symbols, create a path element
            nodeGroup.append("path")
              .attr("d", () => {
                try {
                  const symbolType = shapeMap[shapeName] || d3.symbolCircle;
                  return d3.symbol()
                    .type(symbolType)
                    .size(Math.PI * nodeSize * nodeSize * 2)();
                } catch (err) {
                  console.error('Error generating path for node during redraw:', d, err);
                  return d3.symbol().type(d3.symbolCircle).size(400)();
                }
              })
              .attr("fill", getNodeColor(d)) // Uses latest nodeColors state via callback
              .attr("stroke", "#fff")
              .attr("stroke-width", 2);
          }
        });

        // Recreate Node Labels
        node.append("rect") // Background
          .attr("class", "node-label-bg")
          .attr("y", 20).attr("x", -40).attr("width", 80).attr("height", 15)
          .attr("fill", "#e5e5e5").attr("opacity", 0.2).attr("rx", 3).attr("ry", 3);

        node.append("text") // Text
          .attr("dy", 30).attr("text-anchor", "middle").attr("class", "node-label")
          .text(d => {
            // Return empty string for Document nodes
            if (isDocumentNode(d)) {
              return '';
            }
            return d.label || d.id;
          })
          .attr("font-size", "5px").attr("stroke", "white").attr("stroke-width", "0.3px").attr("fill", "#000");

        // Add hover tooltips for Document nodes
        node.filter(d => isDocumentNode(d))
          .on("mouseover", function(event, d) {
            const tooltipContent = getDocumentTooltipContent(d);
            if (!tooltipContent) return;
            
            // Remove any existing tooltip
            d3.select("body").selectAll(".document-tooltip").remove();
            
            // Create tooltip
            const tooltip = d3.select("body")
              .append("div")
              .attr("class", "document-tooltip")
              .style("position", "absolute")
              .style("background", "rgba(0, 0, 0, 0.9)")
              .style("color", "white")
              .style("padding", "10px")
              .style("border-radius", "5px")
              .style("font-size", "12px")
              .style("max-width", "300px")
              .style("word-wrap", "break-word")
              .style("z-index", "1000")
              .style("pointer-events", "none")
              .style("opacity", 0);
            
            // Add content to tooltip
            tooltip.html(tooltipContent.length > 500 ? 
              tooltipContent.substring(0, 500) + "..." : 
              tooltipContent);
            
            // Position tooltip
            const [mouseX, mouseY] = d3.pointer(event, document.body);
            tooltip
              .style("left", (mouseX + 10) + "px")
              .style("top", (mouseY - 10) + "px")
              .transition()
              .duration(200)
              .style("opacity", 1);
          })
          .on("mousemove", function(event, d) {
            const tooltip = d3.select(".document-tooltip");
            if (!tooltip.empty()) {
              const [mouseX, mouseY] = d3.pointer(event, document.body);
              tooltip
                .style("left", (mouseX + 10) + "px")
                .style("top", (mouseY - 10) + "px");
            }
          })
          .on("mouseout", function(event, d) {
            // Enhanced cleanup: remove all document tooltips to prevent any stragglers
            d3.select("body").selectAll(".document-tooltip")
              .transition()
              .duration(200)
              .style("opacity", 0)
              .remove();
          });

        // Handle node drag events
        function dragstarted(event, d) {
          if (!event.active) newSim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) {
          if (!event.active) newSim.alphaTarget(0);
          d.fx = null; d.fy = null;
        }

        // Simulation tick function
        newSim.on("tick", () => {
          link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
              .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
          linkText.attr("x", d => (d.source.x + d.target.x) / 2)
                  .attr("y", d => (d.source.y + d.target.y) / 2);
          node.attr("transform", d => `translate(${d.x}, ${d.y})`);
        });

        // Start simulation
        newSim.alpha(1).restart();

        // Set the new simulation in state
        setSimulation(newSim);

      }, 50); // Short delay remains to ensure state is updated before redraw starts
    }
  }, [data, svgRef, simulation, onNodeSelect, getNodeColor, getNodeSize, getRelationshipColor, nodeColors, nodeSizes, nodeShapes, relationshipColors, isReady, update]); // Ensure all state dependencies are listed

  // Add debug function to window for direct testing
  useEffect(() => {
    // Add a debug function to directly test size changes
    window.debugUpdateNodeSize = (nodeType, newSize) => {
      if (!isReady) {
        console.warn('DEBUG: Settings service not ready, cannot update size');
        return;
      }
      
      console.log(`DEBUG: Manually setting size for ${nodeType} to ${newSize}`);
      
      // Update via settings service
      const updatedSizes = { ...nodeSizes, [nodeType]: newSize };
      console.log('DEBUG: New nodeSizes will be:', updatedSizes);
      update('nodeSizes', updatedSizes);
      
      // Force update after state changes
      setTimeout(() => {
        console.log('DEBUG: Forcing updateNodesAppearance after size change');
        updateNodesAppearance();
      }, 100);
    };
    
    // Add debug function to force refresh all settings
    window.debugForceRefreshSettings = () => {
      console.log('DEBUG: Current nodeShapes:', nodeShapes);
      console.log('DEBUG: Default shapes include Document:', defaultNodeShapes);
      if (!isReady) {
        console.warn('DEBUG: Settings service not ready');
        return;
      }
      
      // Force reset Document shape to Finance Book
      const updatedShapes = { 
        ...nodeShapes, 
        'Document': 'svg:finance-book-svgrepo-com.svg' 
      };
      update('nodeShapes', updatedShapes);
      
      setTimeout(() => {
        updateNodesAppearance();
      }, 100);
    };
    
    // Add debug function to inspect current graph data
    window.debugInspectNodes = () => {
      if (!data || !data.nodes) {
        console.log('DEBUG: No graph data available');
        return;
      }
      
      console.log('DEBUG: Total nodes:', data.nodes.length);
      data.nodes.forEach((node, index) => {
        const nodeType = getNodeType(node);
        console.log(`DEBUG: Node ${index}: ID=${node.id}, Type=${nodeType}, Labels=${JSON.stringify(node.labels)}, Group=${node.group}`);
        if (nodeType === 'Document') {
          console.log('DEBUG: *** FOUND DOCUMENT NODE ***', node);
        }
      });
      
      // Check current node shapes
      console.log('DEBUG: Current nodeShapes configuration:', nodeShapes);
    };
    
    // Add function to force all nodes to be Document type for testing
    window.debugForceAllDocuments = () => {
      if (!svgRef.current || !data || !data.nodes) {
        console.log('DEBUG: Cannot force documents - no data or SVG');
        return;
      }
      
      console.log('DEBUG: Forcing all nodes to use Finance Book icon');
      
      // Select all node groups and force them to use Finance Book
      const nodeGroups = d3.select(svgRef.current).selectAll('g.nodes g.node-group');
      
      nodeGroups.each(function(d) {
        const nodeGroup = d3.select(this);
        const currentSize = 25; // Slightly larger for visibility
        
        // Remove existing shapes
        nodeGroup.selectAll('path, image').remove();
        
        // Add Finance Book SVG
        console.log('DEBUG: Adding Finance Book icon to node', d.id);
        nodeGroup.append("image")
          .attr("href", `/svg/finance-book-svgrepo-com.svg`)
          .attr("x", -currentSize)
          .attr("y", -currentSize)
          .attr("width", currentSize * 2)
          .attr("height", currentSize * 2)
          .attr("preserveAspectRatio", "xMidYMid meet");
      });
      
      console.log('DEBUG: Applied Finance Book icons to all nodes');
    };
    
    // Add simple function to just force refresh the graph
    window.debugRefreshGraph = () => {
      if (data && data.nodes) {
        console.log('DEBUG: Refreshing graph with current data');
        setGraphData({...data}); // Force re-render
      }
    };
    
    return () => {
      // Cleanup
      delete window.debugUpdateNodeSize;
      delete window.debugForceRefreshSettings;
      delete window.debugInspectNodes;
      delete window.debugForceAllDocuments;
      delete window.debugRefreshGraph;
    };
  }, [nodeColors, nodeShapes, nodeSizes, relationshipColors, updateNodesAppearance, update, isReady]); // Include all dependencies

  // Add a function to fix invalid shapes in state
  const validateAndFixNodeShapes = useCallback(() => {
    const validShapes = {};
    let needsFix = false;
    
    Object.entries(nodeShapes).forEach(([type, shape]) => {
      if (
        typeof shape !== 'string' ||
        (!shapeMap[shape] && !shape.startsWith('svg:'))
      ) {
        console.warn(`Found invalid shape for ${type}: ${JSON.stringify(shape)}, fixing to circle`);
        validShapes[type] = 'circle';
        needsFix = true;
      } else {
        validShapes[type] = shape;
      }
    });
    
    if (needsFix) {
      console.log('Fixed invalid shapes:', validShapes);
      // Save fixed shapes via settings service
      try {
        if (!isReady) {
          console.warn('Settings service not ready, cannot fix shapes');
          return;
        }
        update('nodeShapes', validShapes);
      } catch (error) {
        console.warn('Could not save fixed shapes via settings service', error);
      }
    }
  }, [nodeShapes, update, isReady]);

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
        
        // Update settings via settings service
        const updates = {};
        
        if (config.nodeColors) {
          updates.nodeColors = config.nodeColors;
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
          
          updates.nodeShapes = validShapes;
        }
        
        if (config.nodeSizes) {
          updates.nodeSizes = config.nodeSizes;
        }
        
        if (config.relationshipColors) {
          updates.relationshipColors = config.relationshipColors;
        }
        
        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          if (!isReady) {
            console.warn('Settings service not ready, cannot import config');
            alert('Settings service not ready. Please try again in a moment.');
            return;
          }
          update(updates);
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
    if (!isReady) {
      alert('Settings service not ready. Please try again in a moment.');
      return;
    }
    
    if (window.confirm('Are you sure you want to reset all graph settings to defaults?')) {
      // Reset settings to defaults via settings service
      const defaultUpdates = {
        nodeColors: {...defaultNodeColors},
        nodeShapes: {...defaultNodeShapes},
        nodeSizes: {...defaultNodeSizes},
        relationshipColors: {...defaultRelationshipColors}
      };
      
      update(defaultUpdates);
      
      // Force update
      setTimeout(() => {
        updateNodesAppearance();
      }, 100);
      
      console.log('Graph configuration reset to defaults');
    }
  }, [updateNodesAppearance, update, isReady]);

  // Helper function to check if a node is a Document node
  const isDocumentNode = (d) => {
    try {
      if (!d) return false;
      
      // Check labels array first
      if (d.labels && Array.isArray(d.labels) && d.labels.includes('Document')) {
        return true;
      }
      
      // Check group property
      if (d.group === 'Document') {
        return true;
      }
      
      return false;
    } catch (err) {
      console.warn('Error checking if node is Document:', err);
      return false;
    }
  };

  // Helper function to get tooltip content for Document nodes
  const getDocumentTooltipContent = (d) => {
    if (!isDocumentNode(d)) return null;
    
    // Try to get text content from properties
    if (d.properties && d.properties.text) {
      return d.properties.text;
    }
    
    // Fallback to other properties
    if (d.properties && d.properties.content) {
      return d.properties.content;
    }
    
    return 'Document content not available';
  };

  // Initialize and force Document nodes to use Finance Book icon
  useEffect(() => {
    if (isReady) {
      // Force Document shape to Finance Book icon on every load
      const currentShapes = get('nodeShapes') || defaultNodeShapes;
      if (currentShapes['Document'] !== 'svg:finance-book-svgrepo-com.svg') {
        console.log('GraphView: Forcing Document nodes to use Finance Book icon');
        const updatedShapes = {
          ...currentShapes,
          'Document': 'svg:finance-book-svgrepo-com.svg'
        };
        update({ nodeShapes: updatedShapes });
      }
    }
  }, [isReady, get, update]);

  // Enhanced node type detection that considers Document nodes more broadly
  const getEnhancedNodeType = useCallback((d) => {
    if (!d) return 'Default';
    
    // Check if this is explicitly a Document node
    if (d.labels && Array.isArray(d.labels) && d.labels.includes('Document')) {
      return 'Document';
    }
    if (d.group === 'Document') {
      return 'Document';
    }
    if (d.type === 'Document') {
      return 'Document';
    }
    
    // Check if the node has document-related properties or content
    if (d.properties) {
      if (d.properties.type === 'Document' || 
          d.properties.content || 
          d.properties.text ||
          d.properties.document) {
        return 'Document';
      }
    }
    
    // Check if the ID or label suggests it's a document
    const nodeId = (d.id || '').toLowerCase();
    const nodeLabel = (d.label || '').toLowerCase();
    if (nodeId.includes('document') || 
        nodeId.includes('doc') || 
        nodeLabel.includes('document') ||
        nodeLabel.includes('doc')) {
      return 'Document';
    }
    
    // Fall back to original logic
    return getNodeType(d);
  }, []);

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
                relationshipColors: relationshipColors,
                relationshipLineStyles: relationshipLineStyles
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
