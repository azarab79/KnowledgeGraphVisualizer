import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchNodes } from '../services/api';

// Debug mode constant - set to true to enable debug output in console
const DEBUG_MODE = true;

/**
 * Search bar component for searching nodes in the knowledge graph
 * @param {Object} props - Component props
 * @param {Function} props.onSearchResults - Callback for search results
 * @param {Function} props.onNodeSelect - Callback for when a search result is selected directly
 */
function SearchBar({ onSearchResults, onNodeSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const requestAbortController = useRef(null);

  const debugLog = (...args) => {
    if (DEBUG_MODE) {
      console.log("[SearchBar]", ...args);
    }
  };

  // Memoize the fetch suggestions function to prevent recreating it on each render
  const fetchSuggestions = useCallback(async (searchText) => {
    debugLog(`Fetching suggestions for: "${searchText}"`);
    
    if (!searchText || searchText.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    // Cancel any in-flight requests
    if (requestAbortController.current) {
      requestAbortController.current.abort();
    }

    // Create a new abort controller for this request
    requestAbortController.current = new AbortController();

    try {
      setNetworkError(false);
      setNoResults(false);
      
      const startTime = performance.now();
      const results = await searchNodes(searchText);
      const endTime = performance.now();
      
      debugLog(`Search suggestions took ${(endTime - startTime).toFixed(2)}ms`);
      
      if (results && results.nodes) {
        if (results.nodes.length === 0) {
          setNoResults(true);
          debugLog("No suggestions found");
        } else {
          debugLog(`Got ${results.nodes.length} suggestions`);
          setSuggestions(results.nodes.slice(0, 10));
          setShowSuggestions(true);
        }
      } else {
        debugLog("Empty or invalid response");
        setSuggestions([]);
        setNoResults(true);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setSuggestions([]);
      if (err.name !== 'AbortError') {
        setNetworkError(true);
      }
    }
  }, []);

  // Use a debounced approach to fetch suggestions
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    debugLog(`Input changed to: "${value}"`);
    setQuery(value);
    
    // Clear any existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    
    // Reset states when input changes
    setNoResults(false);
    
    // Only set new timer if length >= 2
    if (value.trim().length >= 2) {
      debugLog("Setting debounce timer for suggestions");
      typingTimerRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [fetchSuggestions]);

  // Clean up timer and abort controller on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (requestAbortController.current) {
        requestAbortController.current.abort();
      }
    };
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current !== event.target
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Handle search form submission - memoized to prevent recreating on each render
   */
  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    
    if (!query.trim()) return;
    
    debugLog(`Submitting search for: "${query}"`);
    setIsLoading(true);
    setError(null);
    setNoResults(false);
    setShowSuggestions(false);
    
    // Cancel any pending suggestion requests
    if (requestAbortController.current) {
      requestAbortController.current.abort();
    }
    
    const startTime = performance.now();
    searchNodes(query)
      .then(results => {
        const endTime = performance.now();
        debugLog(`Search took ${(endTime - startTime).toFixed(2)}ms, found ${results?.nodes?.length || 0} results`);
        
        if (results && results.nodes) {
          if (results.nodes.length === 0) {
            setNoResults(true);
          } else {
            setNetworkError(false);
            onSearchResults(results);
          }
        } else {
          setError('No results found. Please try a different search term.');
        }
      })
      .catch(err => {
        console.error('Search error:', err);
        setError('Failed to search. Please try again.');
        setNetworkError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [query, onSearchResults]);

  /**
   * Handle selecting a suggestion - memoized to prevent recreating on each render
   */
  const handleSelectSuggestion = useCallback((suggestion) => {
    const name = suggestion.properties?.name || 
                 suggestion.properties?.test_case_id || 
                 suggestion.id;
    debugLog(`Selected suggestion: "${name}"`);
    setQuery(name);
    setShowSuggestions(false);
    
    // If there's an onNodeSelect prop, use it directly for better graph display
    if (onNodeSelect) {
      debugLog("Using direct node selection");
      onNodeSelect(suggestion);
      return;
    }
    
    // Otherwise fallback to the search results approach
    debugLog("Falling back to search-based selection");
    setIsLoading(true);
    setError(null);
    
    // Cancel any pending suggestion requests
    if (requestAbortController.current) {
      requestAbortController.current.abort();
    }
    
    searchNodes(name)
      .then(results => {
        if (results && results.nodes) {
          setNetworkError(false);
          onSearchResults(results);
        } else {
          setError('No results found for the selected item.');
        }
      })
      .catch(err => {
        console.error('Search error:', err);
        setError('Failed to search. Please try again.');
        setNetworkError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [onSearchResults, onNodeSelect]);
  
  /**
   * Get node type for suggestion styling
   */
  const getNodeType = (suggestion) => {
    if (suggestion.labels && suggestion.labels.length > 0) {
      return suggestion.labels[0];
    }
    return suggestion.group || 'Default';
  };

  /**
   * Get the best display name for a node
   */
  const getNodeName = (node) => {
    return node.properties?.name || 
           node.properties?.test_case_id || 
           node.label || 
           node.id || 
           'Unknown Node';
  };

  // Handle input focus - memoized to prevent recreating function on every render
  const handleInputFocus = useCallback(() => {
    if (query.trim().length >= 2) {
      debugLog("Input focused, fetching suggestions");
      fetchSuggestions(query);
    }
  }, [query, fetchSuggestions]);

  // Reset network error state when user interacts
  const handleInteraction = useCallback(() => {
    if (networkError) {
      debugLog("User interaction, resetting network error");
      setNetworkError(false);
    }
    if (noResults) {
      setNoResults(false);
    }
  }, [networkError, noResults]);

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form" onClick={handleInteraction}>
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            className={`search-input ${networkError ? 'network-error' : ''} ${noResults ? 'no-results' : ''}`}
            placeholder="Search for modules, products, test cases... (case insensitive)"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            disabled={isLoading}
            autoComplete="off"
          />
          
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul 
              ref={suggestionsRef}
              className="search-suggestions"
            >
              {suggestions.map((suggestion) => (
                <li 
                  key={suggestion.id}
                  className={`suggestion-item ${getNodeType(suggestion).toLowerCase()}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <div className="suggestion-content">
                    <span className="suggestion-name">
                      {getNodeName(suggestion)}
                    </span>
                    <span className="suggestion-type">
                      {getNodeType(suggestion)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <button 
          type="submit" 
          className="search-button"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          )}
        </button>
      </form>
      {error && <div className="search-error">{error}</div>}
      {networkError && <div className="network-error-message">
        Network connection issues detected. Your searches might be slower than usual.
      </div>}
      {noResults && !error && !networkError && <div className="no-results-message">
        No results found. Try a different search term.
      </div>}

      <style jsx>{`
        .search-input {
          width: 100%;
          padding: 10px 15px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        
        .search-input:focus {
          border-color: #00973A;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 151, 58, 0.2);
        }
        
        .network-error {
          border-color: #e53e3e;
        }
        
        .no-results {
          border-color: #f6ad55;
        }
        
        .network-error-message {
          padding: 8px;
          margin-top: 8px;
          background-color: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 4px;
          color: #e53e3e;
          font-size: 14px;
        }
        
        .no-results-message {
          padding: 8px;
          margin-top: 8px;
          background-color: #fffbeb;
          border: 1px solid #fbd38d;
          border-radius: 4px;
          color: #c05621;
          font-size: 14px;
        }
        
        .search-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 10;
          margin: 4px 0 0 0;
          padding: 0;
          list-style: none;
        }
        
        .suggestion-item {
          padding: 10px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          transition: background-color 0.2s;
        }
        
        .suggestion-item:hover {
          background-color: #f9fafb;
        }
        
        .suggestion-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .suggestion-name {
          font-weight: 500;
        }
        
        .suggestion-type {
          font-size: 0.85em;
          padding: 2px 6px;
          background: #edf2f7;
          border-radius: 4px;
          color: #4a5568;
        }
      `}</style>
    </div>
  );
}

export default React.memo(SearchBar); 