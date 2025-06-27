/**
 * API service for connecting to the Knowledge Graph backend
 */

import { 
  mockSearch, 
  mockGetRelationships, 
  mockImpactAnalysis, 
  mockGetMetadata,
  mockInitialGraph 
} from './mockData';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// Flag to control whether to use mock data - ONLY use if explicitly set in .env
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Flag to enable fallback client-side search
const ENABLE_CLIENT_SEARCH = true;

// Cache for all nodes to enable client-side search
let allNodesCache = null;
let allNodesCacheTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Maximum number of retries for API calls
const MAX_RETRIES = 3;
// Delay between retries in milliseconds (increases with each retry)
const RETRY_DELAY = 500;

/**
 * Fetch with retry and better error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
const fetchWithRetry = async (url, options = {}) => {
  let lastError;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`API attempt ${attempt + 1} for ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} failed:`, err);
      lastError = err;
      
      // If this was not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retries have failed
  console.error(`All ${MAX_RETRIES} attempts failed for ${url}`);
  throw lastError;
};

/**
 * Get initial graph data
 * @returns {Promise<Object>} - Initial graph data
 */
export const getInitialGraph = async () => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    return mockInitialGraph();
  }

  try {
    const data = await fetchWithRetry(`${API_URL}/graph/initial`);
    console.log('Raw data from API:', data);
    
    // Convert data format for D3 if needed
    const transformedData = {
      nodes: data.nodes.map(node => ({
        ...node,
        labels: node.labels || (node.n1 ? node.n1.labels : null) || (node.n2 ? node.n2.labels : null) || []
      })),
      links: data.edges ? data.edges.map(edge => ({
        ...edge,
        source: edge.from,
        target: edge.to,
        type: edge.label
      })) : []
    };
    
    // Apply custom styling from localStorage
    transformedData.nodes = applyNodeStyling(transformedData.nodes);
    
    // Store all nodes in cache for client-side search
    if (ENABLE_CLIENT_SEARCH && transformedData.nodes && transformedData.nodes.length > 0) {
      allNodesCache = transformedData.nodes;
      allNodesCacheTime = Date.now();
      console.log(`Cached ${allNodesCache.length} nodes for client-side search`);
    }
    
    console.log('Transformed data:', transformedData);
    return transformedData;
  } catch (error) {
    console.error('Error fetching initial graph:', error);
    
    // Fall back to empty data structure rather than crashing
    return {
      nodes: [],
      links: []
    };
  }
};

/**
 * Load all nodes for client-side search
 * @returns {Promise<Array>} - All nodes
 */
const loadAllNodesForSearch = async () => {
  // If we already have a recent cache, use it
  if (allNodesCache && allNodesCacheTime && (Date.now() - allNodesCacheTime < CACHE_TTL)) {
    console.log(`Using cached ${allNodesCache.length} nodes for search`);
    return allNodesCache;
  }
  
  try {
    console.log("Loading all nodes for client-side search...");
    const data = await fetchWithRetry(`${API_URL}/graph/initial`);
    
    if (data && data.nodes) {
      allNodesCache = data.nodes;
      allNodesCacheTime = Date.now();
      console.log(`Loaded and cached ${allNodesCache.length} nodes for search`);
      return allNodesCache;
    } else {
      throw new Error('No nodes found in initial graph response');
    }
  } catch (error) {
    console.error('Error loading all nodes for search:', error);
    // If we have an old cache, still use it as a fallback
    if (allNodesCache) {
      console.log(`Using stale cache of ${allNodesCache.length} nodes as fallback`);
      return allNodesCache;
    }
    return [];
  }
};

/**
 * Perform client-side search on all nodes
 * @param {string} query - Search query
 * @returns {Array} - Search results
 */
const clientSideSearch = async (query) => {
  console.log(`Performing client-side search for "${query}"`);
  
  if (!query || query.trim() === '') {
    return { nodes: [] };
  }
  
  const lowerQuery = query.toLowerCase();
  const allNodes = await loadAllNodesForSearch();
  
  if (!allNodes || allNodes.length === 0) {
    console.log('No nodes available for client-side search');
    return { nodes: [] };
  }
  
  // Use any property for matching
  const filteredNodes = allNodes.filter(node => {
    // Name match (most common)
    const nameMatch = node.properties?.name?.toString().toLowerCase().includes(lowerQuery);
    
    // ID match
    const idMatch = node.id?.toString().toLowerCase().includes(lowerQuery);
    
    // Labels match (could be string or array)
    let labelMatch = false;
    if (typeof node.label === 'string') {
      labelMatch = node.label.toLowerCase().includes(lowerQuery);
    } else if (node.labels && Array.isArray(node.labels)) {
      labelMatch = node.labels.some(label => 
        label?.toString().toLowerCase().includes(lowerQuery)
      );
    }
    
    // Check property values
    let propsMatch = false;
    if (node.properties) {
      propsMatch = Object.values(node.properties).some(prop => {
        if (prop === null || prop === undefined) return false;
        return prop.toString().toLowerCase().includes(lowerQuery);
      });
    }
    
    return nameMatch || idMatch || labelMatch || propsMatch;
  });
  
  // Apply node styling
  const styledNodes = applyNodeStyling(filteredNodes);
  
  console.log(`Client-side search found ${styledNodes.length} matches`);
  
  return { nodes: styledNodes };
};

/**
 * Search the knowledge graph
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Search results
 */
export const searchNodes = async (query) => {
  console.log(`Search request for "${query}"`);
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    return mockSearch(query);
  }

  if (!query || query.trim() === '') {
    return { nodes: [] };
  }

  // Try client-side search first if enabled
  if (ENABLE_CLIENT_SEARCH) {
    try {
      const clientResults = await clientSideSearch(query);
      if (clientResults && clientResults.nodes && clientResults.nodes.length > 0) {
        console.log(`Using client-side search results: ${clientResults.nodes.length} matches`);
        return clientResults;
      }
    } catch (err) {
      console.error("Client-side search failed:", err);
    }
  }

  // Fall back to server-side search
  try {
    console.log(`Falling back to server-side search for "${query}"`);
    const results = await fetchWithRetry(`${API_URL}/graph/search?term=${encodeURIComponent(query)}`);
    
    console.log(`Server search for "${query}" returned ${results?.nodes?.length || 0} results`);
    
    if (!results || !results.nodes || results.nodes.length === 0) {
      console.log("Server returned no results, using client-side search as fallback");
      return await clientSideSearch(query);
    }
    
    return results;
  } catch (error) {
    console.error('Server-side search failed:', error);
    console.log("Trying client-side search as a fallback after server error");
    
    // If server search fails, try client-side search again as last resort
    try {
      return await clientSideSearch(query);
    } catch (err) {
      console.error("All search methods failed:", err);
      return { nodes: [] };
    }
  }
};

/**
 * Get relationships between nodes
 * @param {string} nodeId - ID of the starting node
 * @param {number} depth - Relationship depth
 * @returns {Promise<Object>} - Node relationships
 */
export const getRelationships = async (nodeId, depth = 1) => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    return mockGetRelationships(nodeId);
  }

  try {
    const data = await fetchWithRetry(`${API_URL}/graph/expand?nodeId=${nodeId}`);
    console.log('Raw relationship data:', data);
    
    // Transform the data to ensure labels are properly set
    const transformedData = {
      nodes: data.nodes.map(node => ({
        ...node,
        labels: node.labels || (node.n1 ? node.n1.labels : null) || (node.n2 ? node.n2.labels : null) || []
      })),
      edges: data.edges
    };
    
    // Apply custom styling from localStorage
    transformedData.nodes = applyNodeStyling(transformedData.nodes);
    
    console.log('Transformed relationship data with styles:', transformedData);
    return transformedData;
  } catch (error) {
    console.error('Error fetching relationships:', error);
    // Return minimal data structure
    return {
      nodes: [],
      edges: []
    };
  }
};

/**
 * Get detailed node information
 * @param {string} nodeId - ID of the node
 * @returns {Promise<Object>} - Node details
 */
export const getNodeDetails = async (nodeId) => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    const data = await mockGetRelationships(nodeId);
    
    // Find the node with the matching ID
    const node = data.nodes.find(n => n.id === nodeId);
    
    if (!node) {
      throw new Error('Node not found in response');
    }
    
    // Use the actual node.id (which might differ from the original nodeId param)
    const primaryId = node.id || nodeId;

    // Format relationships – use the resolved primaryId to match edges reliably
    const relationships = (data.edges || [])
      .filter(edge => edge.from === primaryId || edge.to === primaryId)
      .map(edge => {
        // Determine direction relative to the primary node ID
        const isOutgoing = edge.from === primaryId;
        const relatedNodeId = isOutgoing ? edge.to : edge.from;
        const relatedNode = data.nodes.find(n => n.id === relatedNodeId);
        
        return {
          type: edge.label,
          direction: isOutgoing ? 'outgoing' : 'incoming',
          node: relatedNode
        };
      });
    
    return {
      ...node,
      relationships
    };
  }

  try {
    // Properly encode the nodeId for URL, handling both numeric IDs and names with spaces/special chars
    const encodedNodeId = encodeURIComponent(nodeId);
    const data = await fetchWithRetry(`${API_URL}/graph/expand?nodeId=${encodedNodeId}`);
    
    // Find the node with the matching ID or name. This is more robust because
    // the initial node ID might be a name from a URL parameter.
    // Also check against decoded nodeId in case of URL encoding issues
    const decodedNodeId = decodeURIComponent(nodeId);
    
    const node = data.nodes.find(n => 
      n.id === nodeId || 
      n.id === decodedNodeId ||
      n.properties.name === nodeId || 
      n.properties.name === decodedNodeId ||
      n.label === nodeId ||
      n.label === decodedNodeId
    );
    
    if (!node) {
      // WORKAROUND: If the primary node is not in the expand response, construct it manually.
      // This handles cases where the expand query only returns neighbors.
      const relationships = data.edges
        .filter(edge => edge.from === nodeId || edge.to === nodeId)
        .map(edge => {
          const isOutgoing = edge.from === nodeId;
          const relatedNodeId = isOutgoing ? edge.to : edge.from;
          const relatedNode = data.nodes.find(n => n.id === relatedNodeId);
          return {
            type: edge.label,
            direction: isOutgoing ? 'outgoing' : 'incoming',
            node: relatedNode
          };
        });
      
      return {
        id: nodeId,
        properties: { name: nodeId },
        labels: ['Unknown'],
        relationships: relationships
      };
    }
    
    // Use the actual node.id (which might differ from the original nodeId param)
    const primaryId = node.id || nodeId;

    // Format relationships – use the resolved primaryId to match edges reliably
    const relationships = (data.edges || [])
      .filter(edge => edge.from === primaryId || edge.to === primaryId)
      .map(edge => {
        // Determine direction relative to the primary node ID
        const isOutgoing = edge.from === primaryId;
        const relatedNodeId = isOutgoing ? edge.to : edge.from;
        const relatedNode = data.nodes.find(n => n.id === relatedNodeId);
        
        return {
          type: edge.label,
          direction: isOutgoing ? 'outgoing' : 'incoming',
          node: relatedNode
        };
      });
    
    return {
      ...node,
      relationships
    };
  } catch (error) {
    console.error('Error fetching node details:', error);
    // Return minimal data structure
    return {
      id: nodeId,
      properties: { name: 'Data unavailable due to network error' },
      relationships: []
    };
  }
};

/**
 * Utility function to apply styling from localStorage to graph nodes
 * @param {Array} nodes - Array of nodes to style
 * @returns {Array} - Styled nodes
 */
const applyNodeStyling = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return nodes;
  
  // Load stored node styling configuration from localStorage
  let customNodeStyling = {};
  try {
    const savedConfig = localStorage.getItem('knowledge-graph-node-config');
    if (savedConfig) {
      customNodeStyling = JSON.parse(savedConfig);
    }
  } catch (e) {
    console.warn('Failed to read node styling from localStorage:', e);
  }
  
  // No styling to apply
  if (!customNodeStyling || Object.keys(customNodeStyling).length === 0) {
    return nodes;
  }
  
  // Apply styling to each node
  return nodes.map(node => {
    // Ensure node has labels
    const labels = node.labels || 
                  (node.label ? [node.label] : null) ||
                  (node.n1 ? node.n1.labels : null) || 
                  (node.n2 ? node.n2.labels : null) || 
                  [];
                  
    // Determine node type for styling
    const nodeType = labels.length > 0 ? labels[0] : (node.group || 'Default');
    
    // Apply customized colors and sizes if available
    return {
      ...node,
      labels: labels,
      // Include direct color property for D3
      color: customNodeStyling?.colors?.[nodeType] || null,
      // Include direct size property for D3
      size: customNodeStyling?.sizes?.[nodeType] || null
    };
  });
};

/**
 * Run impact analysis on a node
 * @param {string} nodeId - ID of the node
 * @returns {Promise<Object>} - Impact analysis results
 */
export const runImpactAnalysis = async (nodeId) => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    return mockImpactAnalysis(nodeId);
  }

  try {
    const results = await fetchWithRetry(`${API_URL}/graph/expand?nodeId=${nodeId}`);
    
    // Transform the results to be compatible with D3, with safety checks
    const transformedResults = {
      nodes: (results.nodes || []).map(node => ({ 
        ...node,
        label: node.label || node.properties?.name || node.properties?.test_case_id || node.id,
        group: node.group || node.labels?.[0] || 'Default',
        labels: node.labels && Array.isArray(node.labels) && node.labels.length > 0 ? node.labels : [(node.group || 'Default')]
      })),
      links: (results.edges || []).map(edge => ({
        ...edge,
        source: edge.from,
        target: edge.to,
        type: edge.label
      }))
    };
    
    // Apply styling to nodes
    transformedResults.nodes = applyNodeStyling(transformedResults.nodes);
    
    return transformedResults;
  } catch (error) {
    console.error('Error running impact analysis:', error);
    // Return minimal data structure
    return {
      nodes: [],
      links: []
    };
  }
};

/**
 * Get all available node types
 * @returns {Promise<Array>} - Available node types
 */
export const getNodeTypes = async () => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    const data = await mockGetMetadata();
    return data.nodeLabels;
  }

  try {
    const data = await fetchWithRetry(`${API_URL}/metadata`);
    return data.nodeLabels;
  } catch (error) {
    console.error('Error fetching node types:', error);
    // Return empty array
    return [];
  }
};

/**
 * Get all available relationship types
 * @returns {Promise<Array>} - Available relationship types
 */
export const getRelationshipTypes = async () => {
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    const data = await mockGetMetadata();
    return data.relationshipTypes;
  }

  try {
    const data = await fetchWithRetry(`${API_URL}/metadata`);
    return data.relationshipTypes;
  } catch (error) {
    console.error('Error fetching relationship types:', error);
    // Return empty array
    return [];
  }
};

/**
 * Run dependency analysis on a node
 * @param {string} nodeId - ID of the node
 * @returns {Promise<Object>} - Dependency analysis results
 */
export const runDependencyAnalysis = async (nodeId) => {
  try {
    const data = await fetchWithRetry(`${API_URL}/analysis/dependencies?nodeId=${nodeId}`);
    
    // Apply styling to nodes
    if (data && data.nodes) {
      data.nodes = applyNodeStyling(data.nodes);
    }
    
    return {
      nodes: data.nodes,
      links: data.edges ? data.edges.map(edge => ({
        ...edge,
        source: edge.from,
        target: edge.to,
        type: edge.label
      })) : []
    };
  } catch (error) {
    console.error('Error running dependency analysis:', error);
    // Return minimal data structure
    return {
      nodes: [],
      links: []
    };
  }
};

/**
 * Find paths between two nodes
 * @param {string} sourceId - ID of the source node
 * @param {string} targetId - ID of the target node
 * @returns {Promise<Object>} - Path finding results
 */
export const findPaths = async (sourceId, targetId) => {
  try {
    const data = await fetchWithRetry(`${API_URL}/analysis/paths?sourceId=${sourceId}&targetId=${targetId}`);
    
    // Apply styling to nodes
    if (data && data.nodes) {
      data.nodes = applyNodeStyling(data.nodes);
    }
    
    return {
      nodes: data.nodes,
      links: data.edges ? data.edges.map(edge => ({
        ...edge,
        source: edge.from,
        target: edge.to,
        type: edge.label
      })) : []
    };
  } catch (error) {
    console.error('Error finding paths:', error);
    throw error; // We'll keep this throw since the UI handles this specific error
  }
};

/**
 * Run centrality analysis on the graph
 * @param {string} type - Type of centrality (degree, betweenness, closeness)
 * @returns {Promise<Object>} - Centrality analysis results
 */
export const runCentralityAnalysis = async (type = 'degree') => {
  try {
    const results = await fetchWithRetry(`${API_URL}/analysis/centrality?type=${encodeURIComponent(type)}`);
    
    // Apply styling to nodes
    if (results && results.nodes) {
      results.nodes = applyNodeStyling(results.nodes);
    }
    
    return results;
  } catch (error) {
    console.error('Error running centrality analysis:', error);
    // Return minimal data structure
    return {
      nodes: [],
      edges: []
    };
  }
};

/**
 * Get search suggestions based on partial input
 * @param {string} partialQuery - Partial search query
 * @returns {Promise<Array>} - Search suggestions
 */
export const getSearchSuggestions = async (partialQuery) => {
  // If query is empty, return empty array
  if (!partialQuery || partialQuery.trim() === '') {
    return { nodes: [] };
  }
  
  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    // For mock data, we just filter the results from mockSearch
    const results = await mockSearch(partialQuery);
    return results;
  }

  try {
    // Use searchNodes directly - it now handles all the fallbacks and case insensitivity
    const results = await searchNodes(partialQuery);
    
    // Limit the number of results for suggestions
    if (results && results.nodes) {
      return {
        ...results,
        nodes: results.nodes.slice(0, 10)
      };
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    // Return empty array on error to avoid breaking the UI
    return { nodes: [] };
  }
}; 