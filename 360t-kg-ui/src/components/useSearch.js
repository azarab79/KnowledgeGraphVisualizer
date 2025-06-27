import { useState, useCallback, useRef } from 'react';
import { getRelationships } from '../services/api';

export function useSearch(setGraphData, setSelectedNode, setShowDetails, setLoading, setError, setAnalysisResults) {
  const [searchResults, setSearchResults] = useState([]);
  const isInitialized = useRef(false);

  // Ensure initialization flag is set
  if (!isInitialized.current) {
    isInitialized.current = true;
  }

  const handleSearchResults = useCallback((results) => {
    if (!isInitialized.current) return;
    
    if (results && results.nodes) {
      setSearchResults(results.nodes);

      if (results.nodes.length === 1) {
        const node = results.nodes[0];
        setSelectedNode(node);
        setShowDetails(true);
        setLoading(true);

        getRelationships(node.id)
          .then(relationships => {
            if (relationships && relationships.nodes) {
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
        setSelectedNode(null);
        setShowDetails(false);
        setGraphData(null);
        setAnalysisResults(null);
      }
    }
  }, [setGraphData, setSelectedNode, setShowDetails, setLoading, setError, setAnalysisResults]);

  const clearSearch = useCallback(() => {
    if (!isInitialized.current) return;
    try {
      setSearchResults([]);
    } catch (error) {
      console.warn('Error clearing search results:', error);
    }
  }, []);

  return { searchResults, handleSearchResults, clearSearch };
}
