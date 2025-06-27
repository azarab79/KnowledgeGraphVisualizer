import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import './App.css';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import GraphView from './components/GraphView';
import NodeDetails from './components/NodeDetails';
import Legend from './components/Legend';
import ChatView from './components/ChatView';
import { useDocumentation } from './components/useDocumentation.js';
import { useSearch } from './components/useSearch.js';
import { 
  getRelationships, 
  getInitialGraph, 
  runImpactAnalysis,
  runDependencyAnalysis,
  findPaths,
  runCentralityAnalysis,
  searchNodes
} from './services/api';
import settingsService from './services/settingsService';
import { useSettings } from './hooks/useSettings';
import AdvancedAnalysisPanel from './components/AdvancedAnalysisPanel';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('explorer');
  const [analysisType, setAnalysisType] = useState(null);
  const [targetNode, setTargetNode] = useState(null);
  const [centralityType, setCentralityType] = useState('degree');
  const [expandedDoc, setExpandedDoc] = useState(null);
  const { docContent, docLoading, docError } = useDocumentation(expandedDoc);
  const [graphContainerRef, setGraphContainerRef] = useState(null);
  const [svgRef, setSvgRef] = useState(null);
  
  // Use settings service instead of local state
  const { settings, isReady: settingsReady } = useSettings();
  
  // Convert settings to the format expected by components
  const nodeConfig = useMemo(() => {
    if (!settingsReady || !settings) {
      return { colors: {}, sizes: {}, shapes: {}, relationshipColors: {}, relationshipLineStyles: {} };
    }
    
    return {
      colors: settings.nodeColors || {},
      sizes: settings.nodeSizes || {},
      shapes: settings.nodeShapes || {},
      relationshipColors: settings.relationshipColors || {},
      relationshipLineStyles: settings.relationshipLineStyles || {}
    };
  }, [settings, settingsReady]);

  const docMapping = {
    'getting-started': 'getting-started',
    'user-guide': 'user-guide',
    'data-model': 'data-model',
    'api-reference': 'api-reference',
    'analytics-guide': 'analytics-guide',
    'query-guide': 'query-guide',
    'visualization': 'visualization',
    'development': 'development',
    'administration': 'administration',
    'troubleshooting': 'troubleshooting',
    'monitoring-guide': 'monitoring-guide',
    'validation-guide': 'validation-guide'
  };

  // History management functions
  const updateURL = useCallback((state) => {
    const url = new URL(window.location);
    
    // Update search params based on state
    if (state.view) {
      url.searchParams.set('view', state.view);
    }
    if (state.nodeId) {
      url.searchParams.set('nodeId', state.nodeId);
    } else {
      url.searchParams.delete('nodeId');
    }
    if (state.showDetails !== undefined) {
      if (state.showDetails) {
        url.searchParams.set('details', 'true');
      } else {
        url.searchParams.delete('details');
      }
    }
    if (state.expandedDoc) {
      url.searchParams.set('doc', state.expandedDoc);
    } else {
      url.searchParams.delete('doc');
    }

    // Push new state to history
    window.history.pushState(state, '', url.toString());
  }, []);

  const restoreFromURL = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'explorer';
    const rawNodeId = urlParams.get('nodeId');
    // Properly decode nodeId to handle names with spaces and special characters
    const nodeId = rawNodeId ? decodeURIComponent(rawNodeId) : null;
    const showDetails = urlParams.get('details') === 'true';
    const expandedDoc = urlParams.get('doc');

    // Restore view state
    setCurrentView(view);
    
    if (expandedDoc) {
      setExpandedDoc(expandedDoc);
    }

    // Restore node selection if present
    if (nodeId && showDetails) {
      setLoading(true);
      try {
        // We need to find the node data first
        // This could be from search results or we might need to make an API call
        const relationships = await getRelationships(nodeId);
        if (relationships && relationships.nodes) {
          const node = relationships.nodes.find(n => n.id == nodeId);
          if (node) {
            setSelectedNode(node);
            setShowDetails(true);
            
            // Convert edges to links for D3
            if (relationships.edges) {
              const graphData = {
                nodes: relationships.nodes,
                links: relationships.edges.map(edge => ({
                  ...edge,
                  source: edge.from,
                  target: edge.to,
                  type: edge.label
                }))
              };
              setGraphData(graphData);
            }
          }
        }
      } catch (err) {
        console.error('Error restoring node from URL:', err);
        // Clear invalid URL params
        const url = new URL(window.location);
        url.searchParams.delete('nodeId');
        url.searchParams.delete('details');
        window.history.replaceState({}, '', url.toString());
      } finally {
        setLoading(false);
      }
    } else if (view === 'explorer') {
      // Load initial graph when in explorer view without specific node
      setLoading(true);
      try {
        const initialGraphData = await getInitialGraph();
        setGraphData(initialGraphData);
      } catch (err) {
        console.error('Error loading initial graph:', err);
        setError('Failed to load initial graph. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      // Restore state from URL parameters
      restoreFromURL();
    };

    // Listen for popstate events (back/forward button)
    window.addEventListener('popstate', handlePopState);
    
    // Initial load - check URL parameters
    restoreFromURL();

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [restoreFromURL]);

  // Set initial URL on first load
  useEffect(() => {
    if (window.location.search === '') {
      updateURL({ view: 'explorer' });
    }
  }, [updateURL]);

  // Initialize settings service on startup
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        await settingsService.initialize();
      } catch (err) {
        console.error('Error initializing settings:', err);
      }
    };
    
    initializeSettings();
  }, []);

  // Event handlers for custom events
  useEffect(() => {
    // Cleanup function to remove all tooltips when switching views
    const cleanupTooltips = () => {
      // Remove all D3 tooltips
      d3.select("body").selectAll(".document-tooltip").remove();
      // Remove React tooltips
      document.querySelectorAll('.custom-tooltip, .node-chip-tooltip').forEach(el => el.remove());
    };

    const handleLoadInitialGraph = async () => {
      cleanupTooltips(); // Clean up before switching
      
      // If we're already in explorer view with graph data, don't reload
      // unless we're currently showing search results or node details
      if (currentView === 'explorer' && graphData && !showDetails && (!hookResults || hookResults.length === 0)) {
        return;
      }
      
      // Clear search results when loading initial graph
      if (clearSearch) {
        clearSearch();
      }
      
      setLoading(true);
      setError(null);
      try {
        const initialGraphData = await getInitialGraph();
        setGraphData(initialGraphData);
      } catch (err) {
        console.error('Error loading initial graph:', err);
        setError('Failed to load initial graph. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const handleShowAnalysis = () => {
      cleanupTooltips(); // Clean up before switching
      setCurrentView('analysis');
      setShowDetails(false);
      clearSearch();
      updateURL({ view: 'analysis' });
    };

    const handleShowDocumentation = () => {
      cleanupTooltips(); // Clean up before switching
      setCurrentView('documentation');
      setShowDetails(false);
      clearSearch();
      updateURL({ view: 'documentation' });
    };

    const handleShowChat = () => {
      cleanupTooltips(); // Clean up before switching
      setCurrentView('chat');
      setShowDetails(false);
      clearSearch();
      updateURL({ view: 'chat' });
    };

    // Add error handler for WebSocket connection issues
    const handleWebSocketError = (event) => {
      console.warn('WebSocket connection error:', event);
      // We don't need to do anything here since our API service 
      // now handles retries and fallbacks automatically
    };

    window.addEventListener('loadInitialGraph', handleLoadInitialGraph);
    window.addEventListener('showAnalysis', handleShowAnalysis);
    window.addEventListener('showDocumentation', handleShowDocumentation);
    window.addEventListener('showChat', handleShowChat);
    window.addEventListener('error', (e) => {
      if (e.message && (
          e.message.includes('WebSocket') || 
          e.message.includes('ws://') || 
          e.message.includes('ERR_CONNECTION_REFUSED')
        )) {
        handleWebSocketError(e);
      }
    });
    
    return () => {
      window.removeEventListener('loadInitialGraph', handleLoadInitialGraph);
      window.removeEventListener('showAnalysis', handleShowAnalysis);
      window.removeEventListener('showDocumentation', handleShowDocumentation);
      window.removeEventListener('showChat', handleShowChat);
      window.removeEventListener('error', (e) => {
        if (e.message && (
            e.message.includes('WebSocket') || 
            e.message.includes('ws://') || 
            e.message.includes('ERR_CONNECTION_REFUSED')
          )) {
          handleWebSocketError(e);
        }
      });
      
      // Final cleanup when component unmounts
      cleanupTooltips();
    };
  }, [updateURL]);

  // Create a memoized version of the graph data to prevent unnecessary re-renders
  const memoizedGraphData = useMemo(() => graphData, [graphData]);
  
  const { 
    searchResults: hookResults, 
    handleSearchResults, 
    clearSearch = () => {} // Provide safe default
  } = useSearch(
    setGraphData,
    setSelectedNode,
    setShowDetails,
    setLoading,
    setError,
    setAnalysisResults
  ) || { searchResults: [], handleSearchResults: () => {}, clearSearch: () => {} };

  // Use hookResults directly instead of syncing to avoid infinite loops
  // The search results from the hook are already managed properly

  // Handle node selection - memoized to avoid re-creating on every render
  const handleNodeSelect = useCallback(async (node) => {
    if (!node) return;
    
    // Clear search results when selecting a node from search results
    clearSearch();
    let nodeToSelect = node;

    setSelectedNode(nodeToSelect);
    setShowDetails(true);
    
    // Update URL to reflect selected node
    updateURL({ 
      view: currentView, 
      nodeId: node.id, 
      showDetails: true 
    });
    
    try {
      const relationships = await getRelationships(node.id);
      // Convert edges to links for D3
      if (relationships && relationships.edges) {
        const graphData = {
          nodes: relationships.nodes,
          links: relationships.edges.map(edge => ({
            ...edge,
            source: edge.from,
            target: edge.to,
            type: edge.label
          }))
        };
        setGraphData(graphData);
      }
    } catch (err) {
      console.error('Error fetching relationships:', err);
      setError('Failed to load relationships. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [updateURL, currentView]);

  // Handle impact analysis results - memoized
  const handleAnalysisResults = useCallback((results) => {
    if (results && results.nodes) {
      setAnalysisResults(results);
      
      // Convert data format for D3
      const graphData = {
        nodes: results.nodes,
        links: results.links || []
      };
      setGraphData(graphData);
    }
  }, []);

  // Close the details panel - memoized
  const handleCloseDetails = useCallback(() => {
    setShowDetails(false);
    setSelectedNode(null);
    
    // Update URL to remove node selection
    updateURL({ view: currentView, showDetails: false });
    
    // Check if we're in Explorer view (not Analysis)
    if (currentView === 'explorer') {
      // Set loading state
      setLoading(true);
      
      // Directly load the initial graph data
      getInitialGraph()
        .then(initialGraphData => {
          // Explicitly update graph data with full graph
          setGraphData(initialGraphData);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error reloading initial graph:', err);
          setError('Failed to reload full graph. Please try again.');
          setLoading(false);
        });
    }
  }, [currentView, updateURL]);

  // Determine main content class based on panel visibility
  const mainContentClass = `main-content ${showDetails ? 'with-details' : ''}`;

  // Handle analysis click - memoized
  const handleAnalysisClick = useCallback(async (type, node = selectedNode) => {
    if (!node && type !== 'centrality') {
      setError('Please select a node first');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisType(type);

    try {
      let result;
      switch (type) {
        case 'impact':
          result = await runImpactAnalysis(node.id);
          break;
        case 'dependencies':
          result = await runDependencyAnalysis(node.id);
          break;
        case 'paths':
          if (!targetNode) {
            setError('Please select a target node');
            setLoading(false);
            return;
          }
          if (targetNode.id === node.id) {
            setError('Source and target nodes must be different');
            setLoading(false);
            return;
          }
          try {
            result = await findPaths(node.id, targetNode.id);
          } catch (pathError) {
            if (pathError.message.includes('No paths found')) {
              setError('No paths found between the selected nodes');
            } else {
              setError('Failed to find paths between nodes. Please try again.');
            }
            setLoading(false);
            return;
          }
          break;
        default:
          setError('Invalid analysis type');
          setLoading(false);
          return;
      }
      
      if (result) {
        // Convert edges to links if needed
        if (result.edges && !result.links) {
          result.links = result.edges.map(edge => ({
            ...edge,
            source: edge.from || edge.source,
            target: edge.to || edge.target,
            type: edge.label
          }));
          delete result.edges;
        }
        setGraphData(result);
      }
    } catch (err) {
      console.error('Error running analysis:', err);
      setError('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedNode, targetNode]);

  // Handle centrality analysis
  const handleCentralityAnalysis = useCallback(async (type) => {
    setLoading(true);
    setError(null);
    setAnalysisType('centrality');
    setCentralityType(type);
    
    try {
      const result = await runCentralityAnalysis(type);
      if (result) {
        setGraphData(result);
      }
    } catch (err) {
      console.error('Error running centrality analysis:', err);
      setError('Centrality analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update node configuration
  const handleNodeConfigChange = useCallback(async (newConfig) => {
    try {
      await settingsService.updateSettings(newConfig);
    } catch (error) {
      console.error('Error updating node configuration:', error);
    }
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'analysis':
        return (
          <div className="content-wrapper">
            <h2>Graph Analysis</h2>
            <AdvancedAnalysisPanel />
          </div>
        );
      case 'chat':
        return (
          <div className="content-wrapper chat-content-wrapper">
            <ChatView onNodeSelect={handleNodeSelect} />
          </div>
        );
      case 'documentation':
        return (
          <div className="content-wrapper">
            <h2>Documentation</h2>
            <div className="documentation-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
              <h1>360T Knowledge Graph Documentation</h1>
              
              <div className="doc-navigation">
                <h2>Documentation Index</h2>
                <div className="doc-grid">
                  {Object.entries({
                    'getting-started': { icon: '🚀', title: 'Getting Started', desc: 'Quick introduction and setup guide' },
                    'user-guide': { icon: '📖', title: 'User Guide', desc: 'Complete guide for using the Knowledge Graph' },
                    'data-model': { icon: '🗄️', title: 'Data Model', desc: 'Understanding the graph structure' },
                    'api-reference': { icon: '🔌', title: 'API Reference', desc: 'API endpoints and usage' },
                    'analytics-guide': { icon: '📊', title: 'Analytics Guide', desc: 'Using analysis tools and features' },
                    'query-guide': { icon: '🔍', title: 'Query Guide', desc: 'Writing and executing queries' },
                    'visualization': { icon: '📈', title: 'Visualization', desc: 'Graph visualization features' },
                    'development': { icon: '👨‍💻', title: 'Development', desc: 'Developer documentation' },
                    'administration': { icon: '⚙️', title: 'Administration', desc: 'System administration guide' },
                    'troubleshooting': { icon: '🔧', title: 'Troubleshooting', desc: 'Common issues and solutions' },
                    'monitoring-guide': { icon: '📡', title: 'Monitoring', desc: 'System monitoring guide' },
                    'validation-guide': { icon: '✅', title: 'Validation', desc: 'Data validation guidelines' }
                  }).map(([key, { icon, title, desc }]) => (
                    <div key={key} className="doc-card" onClick={() => {
                      setExpandedDoc(key);
                      updateURL({ view: currentView, expandedDoc: key });
                    }}>
                      <h3>{icon} {title}</h3>
                      <p>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {expandedDoc && (
                <div className="expanded-doc">
                  <div className="expanded-doc-header">
                    <h2>{expandedDoc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
                    <button className="close-doc" onClick={() => {
                      setExpandedDoc(null);
                      updateURL({ view: currentView });
                    }}>×</button>
                  </div>
                  <div className="doc-content markdown-body">
                    {docLoading ? (
                      <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <p>Loading documentation...</p>
                      </div>
                    ) : docError ? (
                      <div className="error-message">
                        {docError}
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: docContent }} />
                    )}
                  </div>
                </div>
              )}

              <style>{`
                .documentation-container {
                  line-height: 1.6;
                  color: #333;
                }
                .doc-navigation {
                  margin-bottom: 40px;
                }
                .doc-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                  gap: 20px;
                  margin-top: 20px;
                }
                .doc-card {
                  background: #fff;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                  padding: 20px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .doc-card:hover {
                  border-color: #4299e1;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                  transform: translateY(-2px);
                }
                .doc-card h3 {
                  margin: 0 0 10px 0;
                  color: #2d3748;
                  font-size: 18px;
                }
                .doc-card p {
                  margin: 0;
                  color: #4a5568;
                  font-size: 14px;
                }
                .expanded-doc {
                  margin-top: 40px;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                  background: #fff;
                }
                .expanded-doc-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 20px;
                  border-bottom: 1px solid #e2e8f0;
                  background: #f7fafc;
                  border-radius: 8px 8px 0 0;
                }
                .expanded-doc-header h2 {
                  margin: 0;
                  color: #2d3748;
                }
                .close-doc {
                  background: none;
                  border: none;
                  font-size: 24px;
                  color: #718096;
                  cursor: pointer;
                  padding: 0;
                  width: 30px;
                  height: 30px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 4px;
                  transition: all 0.2s ease;
                }
                .close-doc:hover {
                  background: #e2e8f0;
                  color: #2d3748;
                }
                .doc-content {
                  padding: 20px;
                  max-height: 600px;
                  overflow-y: auto;
                }
                .markdown-body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  line-height: 1.5;
                  word-wrap: break-word;
                }
                .markdown-body h1,
                .markdown-body h2,
                .markdown-body h3,
                .markdown-body h4,
                .markdown-body h5,
                .markdown-body h6 {
                  margin-top: 24px;
                  margin-bottom: 16px;
                  font-weight: 600;
                  line-height: 1.25;
                  color: #24292e;
                }
                .markdown-body h1 {
                  font-size: 32px;
                  border-bottom: 1px solid #eaecef;
                  padding-bottom: 10px;
                }
                .markdown-body h2 {
                  font-size: 24px;
                  border-bottom: 1px solid #eaecef;
                  padding-bottom: 8px;
                }
                .markdown-body h3 {
                  font-size: 20px;
                }
                .markdown-body h4 {
                  font-size: 16px;
                }
                .markdown-body p {
                  margin-top: 0;
                  margin-bottom: 16px;
                }
                .markdown-body code {
                  padding: 2px 4px;
                  margin: 0;
                  font-size: 85%;
                  background-color: rgba(27, 31, 35, 0.05);
                  border-radius: 3px;
                  font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
                }
                .markdown-body pre {
                  padding: 16px;
                  overflow: auto;
                  font-size: 85%;
                  line-height: 1.45;
                  background-color: #f6f8fa;
                  border-radius: 6px;
                  margin-bottom: 16px;
                }
                .markdown-body pre code {
                  background: transparent;
                  border: 0;
                  display: inline;
                  line-height: inherit;
                  margin: 0;
                  max-width: auto;
                  overflow: visible;
                  padding: 0;
                  word-wrap: normal;
                }
                .markdown-body ul,
                .markdown-body ol {
                  padding-left: 30px;
                  margin-top: 0;
                  margin-bottom: 16px;
                }
                .markdown-body li {
                  margin-bottom: 4px;
                }
                .markdown-body blockquote {
                  padding: 0 16px;
                  color: #6a737d;
                  border-left: 4px solid #dfe2e5;
                  margin: 0 0 16px 0;
                }
                .markdown-body table {
                  display: block;
                  width: 100%;
                  overflow: auto;
                  border-spacing: 0;
                  border-collapse: collapse;
                }
                .markdown-body table th,
                .markdown-body table td {
                  padding: 6px 13px;
                  border: 1px solid #dfe2e5;
                }
                .markdown-body table tr {
                  background-color: #fff;
                  border-top: 1px solid #c6cbd1;
                }
                .markdown-body table tr:nth-child(2n) {
                  background-color: #f6f8fa;
                }
                .loading-overlay {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 2rem;
                }
                .error-message {
                  color: #e53e3e;
                  padding: 1rem;
                  background-color: #fff5f5;
                  border: 1px solid #feb2b2;
                  border-radius: 4px;
                  margin: 1rem 0;
                }
              `}</style>
            </div>
          </div>
        );
      default:
        return (
          <div className="content-wrapper">
            <h2>Explorer</h2>
            <div className="explorer-content">
              <div className="search-wrapper">
                <SearchBar 
                  onSearchResults={handleSearchResults} 
                  onNodeSelect={handleNodeSelect}
                />
              </div>
              
              <div className="graph-layout">
                <div className="graph-container">
                  {loading && <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading graph data...</p>
                  </div>}
                  
                  {error && <div className="error-message">
                    {error}
                    <button className="retry-button" onClick={() => window.dispatchEvent(new Event('loadInitialGraph'))}>
                      Retry
                    </button>
                  </div>}
                  
                  {!loading && !error && (
                    <>
                      {hookResults.length > 0 ? (
                        <div className="search-results">
                          <h3>Search Results ({hookResults.length})</h3>
                          <ul className="result-list">
                            {hookResults.map(result => (
                              <li 
                                key={result.id} 
                                className="result-item"
                                onClick={() => handleNodeSelect(result)}
                              >
                                <span className="result-name">
                                  {result.properties?.name || 
                                   result.properties?.test_case_id || 
                                   result.label || 
                                   result.id}
                                </span>
                                <span className="result-type">
                                  {result.labels && result.labels.length > 0 
                                    ? result.labels[0] 
                                    : result.group || 'Node'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        graphData ? (
                          <GraphView 
                            data={memoizedGraphData} 
                            onNodeSelect={handleNodeSelect}
                            customConfig={nodeConfig}
                          />
                        ) : (
                          <div className="graph-placeholder">
                            <p>Search for a node or select a relationship type to visualize</p>
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
                
                {graphData && !loading && !error && !hookResults.length > 0 && (
                  <div className="legend-wrapper">
                    <Legend 
                      data={memoizedGraphData}
                      initialConfig={nodeConfig}
                      onNodeConfigChange={handleNodeConfigChange} 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      <Header 
        onSwitchView={setCurrentView} 
        currentView={currentView}
        onNodeConfigChange={handleNodeConfigChange}
        config={nodeConfig} 
      />
      <div className="app-container">
        <div className={mainContentClass}>
          {renderContent()}
        </div>
        {showDetails && selectedNode && (
          <NodeDetails
            selectedNode={selectedNode}
            onClose={handleCloseDetails}
            onAnalysisResults={handleAnalysisResults}
            onNodeSelect={handleNodeSelect}
          />
        )}
      </div>
    </div>
  );
}

export default App;
