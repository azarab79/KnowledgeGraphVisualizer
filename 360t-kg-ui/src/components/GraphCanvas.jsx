import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import neo4jService from '../services/neo4jService';

// Style configuration for the graph
const graphOptions = {
    nodes: {
        shape: 'dot',
        size: 16,
        font: {
            size: 12,
            face: 'Tahoma'
        },
        borderWidth: 2,
        shadow: true
    },
    edges: {
        width: 2,
        shadow: true,
        font: {
            size: 12,
            align: 'middle'
        },
        arrows: {
            to: { enabled: true, scaleFactor: 1 }
        }
    },
    groups: {
        Module: {
            color: { background: '#97C2FC', border: '#2B7CE9' },
            shape: 'hexagon'
        },
        Product: {
            color: { background: '#FB7E81', border: '#FA0A10' },
            shape: 'square'
        },
        Workflow: {
            color: { background: '#7BE141', border: '#31B404' },
            shape: 'diamond'
        },
        TestCase: {
            color: { background: '#FFA807', border: '#FF6F00' },
            shape: 'triangle'
        },
        UI_Area: {
            color: { background: '#6E6EFD', border: '#0000A9' },
            shape: 'dot'
        },
        ConfigurationItem: {
            color: { background: '#C2FABC', border: '#5CA053' },
            shape: 'star'
        }
    },
    physics: {
        stabilization: {
            enabled: true,
            iterations: 1000
        },
        barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.3,
            springLength: 95,
            springConstant: 0.04,
            damping: 0.09
        }
    },
    interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: true,
        keyboard: true
    },
    layout: {
        improvedLayout: true,
        hierarchical: {
            enabled: false
        }
    }
};

const GraphCanvas = ({ onNodeSelect, onError, selectedNodeId = null, analysisMode = null }) => {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const [nodesDataset, setNodesDataset] = useState(null);
    const [edgesDataset, setEdgesDataset] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Initialize vis-network
    useEffect(() => {
        if (containerRef.current && !networkRef.current) {
            // Create empty datasets
            const nodes = new DataSet([]);
            const edges = new DataSet([]);
            setNodesDataset(nodes);
            setEdgesDataset(edges);
            
            // Create network
            networkRef.current = new Network(
                containerRef.current, 
                { nodes, edges }, 
                graphOptions
            );
            
            // Set up event handlers
            networkRef.current.on('click', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    onNodeSelect(node);
                } else {
                    onNodeSelect(null);
                }
            });
            
            // Double-click to expand a node
            networkRef.current.on('doubleClick', async function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    try {
                        setIsLoading(true);
                        const data = await neo4jService.expandNode(nodeId);
                        
                        // Add new nodes and edges
                        const existingNodeIds = new Set(nodes.getIds().map(id => id.toString()));
                        const existingEdgeIds = new Set(edges.getIds().map(id => id.toString()));
                        
                        // Filter out nodes and edges that already exist
                        const newNodes = data.nodes.filter(node => !existingNodeIds.has(node.id));
                        const newEdges = data.edges.filter(edge => !existingEdgeIds.has(edge.id));
                        
                        if (newNodes.length > 0) {
                            nodes.add(newNodes);
                        }
                        
                        if (newEdges.length > 0) {
                            edges.add(newEdges);
                        }
                        
                        setIsLoading(false);
                    } catch (error) {
                        console.error('Error expanding node:', error);
                        setIsLoading(false);
                        onError('Failed to expand node. Please try again.');
                    }
                }
            });
        }
        
        return () => {
            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }
        };
    }, [onNodeSelect, onError]);
    
    // Load initial graph data
    useEffect(() => {
        const loadInitialGraph = async () => {
            try {
                setIsLoading(true);
                const data = await neo4jService.getInitialGraph();
                
                if (nodesDataset && edgesDataset) {
                    nodesDataset.clear();
                    edgesDataset.clear();
                    
                    nodesDataset.add(data.nodes);
                    edgesDataset.add(data.edges);
                }
                
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading initial graph:', error);
                setIsLoading(false);
                onError('Failed to load graph data. Please check API connection.');
            }
        };
        
        if (nodesDataset && edgesDataset) {
            loadInitialGraph();
        }
    }, [nodesDataset, edgesDataset, onError]);
    
    // Handle selected node highlighting
    useEffect(() => {
        if (networkRef.current && nodesDataset && selectedNodeId) {
            // Reset all nodes to default
            const allNodes = nodesDataset.get();
            allNodes.forEach(node => {
                if (!node.originalColor) {
                    node.originalColor = node.color;
                }
                nodesDataset.update({
                    id: node.id,
                    color: node.originalColor
                });
            });
            
            // Highlight selected node
            nodesDataset.update({
                id: selectedNodeId,
                color: { background: '#FFFF00', border: '#FFD700' }
            });
            
            // Focus on the selected node
            networkRef.current.focus(selectedNodeId, {
                scale: 1,
                animation: true
            });
        }
    }, [selectedNodeId, nodesDataset]);
    
    // Handle analysis mode (impact, test coverage, dependencies)
    useEffect(() => {
        const runAnalysis = async () => {
            if (!selectedNodeId || !analysisMode) return;
            
            try {
                setIsLoading(true);
                let data;
                
                switch (analysisMode) {
                    case 'impact':
                        data = await neo4jService.getImpactAnalysis(selectedNodeId);
                        break;
                    case 'test-coverage':
                        data = await neo4jService.getTestCoverage(selectedNodeId);
                        break;
                    case 'dependencies':
                        data = await neo4jService.getDependencies(selectedNodeId);
                        break;
                    default:
                        return;
                }
                
                if (nodesDataset && edgesDataset) {
                    nodesDataset.clear();
                    edgesDataset.clear();
                    
                    nodesDataset.add(data.nodes);
                    edgesDataset.add(data.edges);
                    
                    // Focus on the selected node
                    networkRef.current.fit({
                        animation: true
                    });
                }
                
                setIsLoading(false);
            } catch (error) {
                console.error(`Error running ${analysisMode} analysis:`, error);
                setIsLoading(false);
                onError(`Failed to run ${analysisMode} analysis. Please try again.`);
            }
        };
        
        if (selectedNodeId && analysisMode && nodesDataset && edgesDataset) {
            runAnalysis();
        }
    }, [selectedNodeId, analysisMode, nodesDataset, edgesDataset, onError]);
    
    return (
        <div className="graph-container">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading graph data...</p>
                </div>
            )}
            <div ref={containerRef} className="graph-canvas"></div>
        </div>
    );
};

export default GraphCanvas; 