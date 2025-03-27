import { useState, useEffect, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './App.css';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import GraphView from './components/GraphView';
import NodeDetails from './components/NodeDetails';
import Legend from './components/Legend';
import { 
  getRelationships, 
  getInitialGraph, 
  runImpactAnalysis,
  runDependencyAnalysis,
  findPaths,
  runCentralityAnalysis,
  searchNodes
} from './services/api';
import * as d3 from 'd3';

// Storage key for node config
const NODE_CONFIG_STORAGE_KEY = 'knowledge-graph-node-config';

function App() {
  const [graphData, setGraphData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
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
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState(null);
  const [graphContainerRef, setGraphContainerRef] = useState(null);
  const [svgRef, setSvgRef] = useState(null);
  const [nodeConfig, setNodeConfig] = useState({ colors: {}, sizes: {}, shapes: {} });

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

  // Load node configuration from localStorage on startup
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(NODE_CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        
        // No need to convert shapes - we now use string representation throughout
        setNodeConfig(parsedConfig);
        console.log('Loaded saved node configuration:', parsedConfig);
      }
    } catch (err) {
      console.warn('Failed to load saved node configuration:', err);
    }
  }, []);

  // Listen for loadInitialGraph event
  useEffect(() => {
    const handleLoadInitialGraph = async () => {
      setLoading(true);
      setError(null);
      setSearchResults([]);
      setSelectedNode(null);
      setShowDetails(false);
      setAnalysisResults(null);
      setCurrentView('explorer');
      
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
      setCurrentView('analysis');
      setShowDetails(false);
      setSearchResults([]);
    };

    const handleShowDocumentation = () => {
      setCurrentView('documentation');
      setShowDetails(false);
      setSearchResults([]);
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
    window.addEventListener('error', (e) => {
      if (e.message && (
          e.message.includes('WebSocket') || 
          e.message.includes('ws://') || 
          e.message.includes('ERR_CONNECTION_REFUSED')
        )) {
        handleWebSocketError(e);
      }
    });
    
    // Load initial graph when component mounts
    handleLoadInitialGraph();
    
    return () => {
      window.removeEventListener('loadInitialGraph', handleLoadInitialGraph);
      window.removeEventListener('showAnalysis', handleShowAnalysis);
      window.removeEventListener('showDocumentation', handleShowDocumentation);
    };
  }, []);

  useEffect(() => {
    // Configure marked options
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false,
      headerIds: true,
      mangle: false
    });

    const loadDocContent = async () => {
      if (!expandedDoc) {
        setDocContent('');
        setDocError(null);
        return;
      }

      setDocLoading(true);
      setDocError(null);

      try {
        const mappedDoc = docMapping[expandedDoc] || expandedDoc;
        console.log(`Loading documentation: ${mappedDoc}`);
        
        const response = await fetch(`/api/docs/${mappedDoc}.md`);
        console.log('Response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          let errorMessage;
          try {
            const errorData = await response.json();
            console.log('Error response data:', errorData);
            
            // Extract error message from various possible formats
            errorMessage = typeof errorData === 'string' ? errorData :
              errorData.error?.message || errorData.error || 
              errorData.message || JSON.stringify(errorData);
            
          } catch (parseError) {
            console.log('Error parsing response:', parseError);
            errorMessage = `Failed to load documentation: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);

        if (!contentType) {
          throw new Error('No content type received from server');
        }

        // Accept both text/markdown and text/plain
        if (!contentType.includes('text/markdown') && !contentType.includes('text/plain')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }

        const content = await response.text();
        console.log('Received content length:', content.length);
        
        if (!content.trim()) {
          throw new Error('Received empty content from server');
        }

        // Process the markdown content
        const renderedContent = marked.parse(content);
        const sanitizedContent = DOMPurify.sanitize(renderedContent, {
          ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td'],
          ADD_ATTR: ['align']
        });
        
        if (!sanitizedContent.trim()) {
          throw new Error('Content processing resulted in empty output');
        }

        setDocContent(sanitizedContent);
      } catch (error) {
        console.error('Error loading documentation:', error);
        // Ensure we're converting the error to a string properly
        setDocError(error instanceof Error ? error.message : String(error));
      } finally {
        setDocLoading(false);
      }
    };

    loadDocContent();
  }, [expandedDoc]);

  // Create a memoized version of the graph data to prevent unnecessary re-renders
  const memoizedGraphData = useMemo(() => graphData, [graphData]);
  
  // Handle search results - memoized to avoid re-creating on every render
  const handleSearchResults = useCallback((results) => {
    if (results && results.nodes) {
      setSearchResults(results.nodes);
      
      // If there's only one search result, select it automatically 
      // and show its details and relationships
      if (results.nodes.length === 1) {
        const node = results.nodes[0];
        setSelectedNode(node);
        setShowDetails(true);
        setLoading(true);
        
        // Fetch relationships for the single result
        getRelationships(node.id)
          .then(relationships => {
            if (relationships && relationships.nodes) {
              // Convert edges to links for D3
              const graphData = {
                nodes: relationships.nodes,
                links: relationships.edges ? relationships.edges.map(edge => ({
                  ...edge,
                  source: edge.from,
                  target: edge.to,
                  type: edge.label
                })) : []
              };
              setGraphData(graphData);
            }
          })
          .catch(err => {
            console.error('Error fetching relationships for search result:', err);
            setError('Failed to load relationships. Please try again.');
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        // For multiple results, reset the current selection
        setSelectedNode(null);
        setShowDetails(false);
        setGraphData(null);
        setAnalysisResults(null);
      }
    }
  }, []);

  // Handle node selection - memoized to avoid re-creating on every render
  const handleNodeSelect = useCallback(async (node) => {
    if (!node) return;
    
    // Clear search results when selecting a node from search results
    setSearchResults([]);
    setSelectedNode(node);
    setShowDetails(true);
    setLoading(true);
    setError(null);
    
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
  }, []);

  // Handle impact analysis results - memoized
  const handleAnalysisResults = useCallback((results) => {
    if (results && results.nodes) {
      setAnalysisResults(results);
      
      // Convert data format for D3
      const graphData = {
        nodes: results.nodes,
        links: results.edges.map(edge => ({
          ...edge,
          source: edge.from,
          target: edge.to,
          type: edge.label
        }))
      };
      setGraphData(graphData);
    }
  }, []);

  // Close the details panel - memoized
  const handleCloseDetails = useCallback(() => {
    setShowDetails(false);
    
    // Check if we're in Explorer view (not Analysis)
    if (currentView === 'explorer') {
      // Explicitly reset selected node
      setSelectedNode(null);
      
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
  }, [currentView]);

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
      setError(`Failed to run ${type} analysis. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [selectedNode, targetNode]);

  // Handle node configuration changes - memoized
  const handleNodeConfigChange = useCallback((config) => {
    console.log('App: Received node config change:', config);
    
    setNodeConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      
      // Properly merge colors without disturbing sizes and shapes
      if (config.colors) {
        console.log('App: Updating node colors');
        newConfig.colors = {
          ...prevConfig.colors,
          ...config.colors
        };
      }
      
      // Properly merge sizes without disturbing colors and shapes
      if (config.sizes) {
        console.log('App: Updating node sizes');
        newConfig.sizes = {
          ...prevConfig.sizes,
          ...config.sizes
        };
      }
      
      // Properly merge shapes without disturbing colors and sizes
      if (config.shapes) {
        console.log('App: Updating node shapes:', config.shapes);
        newConfig.shapes = {
          ...(prevConfig.shapes || {}),
          ...config.shapes
        };
        
        // Ensure all shape values are strings - no conversion needed as we now only use strings
      }
      
      // Handle relationship colors
      if (config.relationshipColors) {
        console.log('App: Updating relationship colors');
        newConfig.relationshipColors = {
          ...(prevConfig.relationshipColors || {}),
          ...config.relationshipColors
        };
      }
      
      // Save the updated configuration to localStorage
      try {
        localStorage.setItem(NODE_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
        console.log('App: Saved node configuration to localStorage:', newConfig);
      } catch (err) {
        console.warn('Failed to save node configuration:', err);
      }
      
      return newConfig;
    });
  }, []);

  const renderAnalysisContent = () => {
    return (
      <div className="content-wrapper">
        <h2>Knowledge Graph Analysis</h2>
        
        <div className="analysis-content">
          <div className="analysis-section">
            <h3>Analysis Tools</h3>
            <div className="analysis-tools">
              <button 
                className={`tool-button ${analysisType === 'impact' ? 'active' : ''}`}
                onClick={() => setAnalysisType('impact')}
                disabled={!selectedNode}
              >
                <strong>Impact Analysis</strong>
                <span className="tool-description">Analyze how changes to a node impact other nodes</span>
              </button>
              
              <button 
                className={`tool-button ${analysisType === 'dependencies' ? 'active' : ''}`}
                onClick={() => setAnalysisType('dependencies')}
                disabled={!selectedNode}
              >
                <strong>Dependency Analysis</strong>
                <span className="tool-description">Identify dependencies of the selected node</span>
              </button>
              
              <div className="tool-group">
                <button 
                  className={`tool-button ${analysisType === 'paths' ? 'active' : ''}`}
                  onClick={() => setAnalysisType('paths')}
                  disabled={!selectedNode}
                >
                  <strong>Path Finding</strong>
                  <span className="tool-description">Find paths between two nodes</span>
                </button>
                
                {analysisType === 'paths' && (
                  <div className="target-node-selector">
                    <label htmlFor="target-node">Target Node:</label>
                    <select 
                      id="target-node"
                      value={targetNode?.id || ''}
                      onChange={(e) => {
                        const selectedNodeId = e.target.value;
                        const node = searchResults.find(n => n.id === selectedNodeId) || 
                          (analysisResults?.nodes?.find(n => n.id === selectedNodeId) || null);
                        setTargetNode(node);
                      }}
                    >
                      <option value="">Select a target node</option>
                      {searchResults.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.label || node.name || node.id}
                        </option>
                      ))}
                      {analysisResults && analysisResults.nodes && 
                        analysisResults.nodes
                          .filter(node => node.id !== selectedNode?.id)
                          .map(node => (
                            <option key={node.id} value={node.id}>
                              {node.label || node.name || node.id}
                            </option>
                          ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {!selectedNode && (
              <p className="helper-text">Select a node in the Explorer view to perform analysis</p>
            )}
          </div>
          
          {graphData && (
            <div className="analysis-section">
              <h3>Analysis Results</h3>
              <div className="graph-wrapper">
                <GraphView 
                  data={memoizedGraphData} 
                  onNodeSelect={handleNodeSelect}
                  customConfig={nodeConfig}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDocumentationContent = () => {
    return (
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
              <div key={key} className="doc-card" onClick={() => setExpandedDoc(key)}>
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
              <button className="close-doc" onClick={() => setExpandedDoc(null)}>×</button>
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
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .doc-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .doc-card h3 {
            margin: 0 0 10px 0;
            color: #2c5282;
          }
          .doc-card p {
            margin: 0;
            color: #4a5568;
            font-size: 0.9em;
          }
          .expanded-doc {
            margin-top: 40px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .expanded-doc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: #fff;
            border-bottom: 1px solid #e2e8f0;
            border-radius: 8px 8px 0 0;
          }
          .expanded-doc-header h2 {
            margin: 0;
          }
          .close-doc {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #4a5568;
            padding: 0 10px;
          }
          .close-doc:hover {
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
            line-height: 1.6;
          }
          .markdown-body h1 {
            padding-bottom: 0.3em;
            font-size: 2em;
            border-bottom: 1px solid #eaecef;
          }
          .markdown-body h2 {
            padding-bottom: 0.3em;
            font-size: 1.5em;
            border-bottom: 1px solid #eaecef;
          }
          .markdown-body h3 {
            font-size: 1.25em;
          }
          .markdown-body code {
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            background-color: rgba(27,31,35,0.05);
            border-radius: 3px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          }
          .markdown-body pre {
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            background-color: #f6f8fa;
            border-radius: 3px;
          }
          .markdown-body pre code {
            display: inline;
            max-width: auto;
            padding: 0;
            margin: 0;
            overflow: visible;
            line-height: inherit;
            word-wrap: normal;
            background-color: transparent;
            border: 0;
          }
          .markdown-body blockquote {
            padding: 0 1em;
            color: #6a737d;
            border-left: 0.25em solid #dfe2e5;
            margin: 0;
          }
          .markdown-body ul,
          .markdown-body ol {
            padding-left: 2em;
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
    );
  };

  const renderExplorerContent = () => {
    return (
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
                {searchResults.length > 0 ? (
                  <div className="search-results">
                    <h3>Search Results ({searchResults.length})</h3>
                    <ul className="result-list">
                      {searchResults.map(result => (
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
          
          {graphData && !loading && !error && !searchResults.length > 0 && (
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
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'analysis':
        return (
          <div className="content-wrapper">
            <h2>Graph Analysis</h2>
            {renderAnalysisContent()}
          </div>
        );
      case 'documentation':
        return (
          <div className="content-wrapper">
            <h2>Documentation</h2>
            {renderDocumentationContent()}
          </div>
        );
      default:
        return (
          <div className="content-wrapper">
            <h2>Explorer</h2>
            {renderExplorerContent()}
          </div>
        );
    }
  };

  return (
    <div className="app">
      <Header 
        onDashboardClick={() => setCurrentView('explorer')} 
        onAnalysisClick={() => setCurrentView('analysis')}
        onDocumentationClick={() => setCurrentView('documentation')}
        currentView={currentView}
      />
      
      <div className="app-container">
        <div className={mainContentClass}>
          {renderContent()}
        </div>
        
        {showDetails && (
          <NodeDetails 
            selectedNode={selectedNode}
            onClose={handleCloseDetails}
            onAnalysisResults={handleAnalysisResults}
          />
        )}
      </div>
    </div>
  );
}

export default App;
