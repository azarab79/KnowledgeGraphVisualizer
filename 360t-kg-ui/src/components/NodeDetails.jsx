import React, { useState, useEffect, useCallback } from 'react';
import { getNodeDetails } from '../services/api';
import { getNodeIcon as getNodeIconFromMap } from '../constants/iconMap.js';

/**
 * NodeDetails component displays detailed information about a selected node
 * @param {Object} selectedNode - The selected node object
 * @param {Function} onClose - Callback when closing details
 * @param {Function} onAnalysisResults - Callback when analysis results are received
 * @param {Function} onNodeSelect - Callback when a related node is selected
 */
function NodeDetails({ selectedNode, onClose, onAnalysisResults, onNodeSelect }) {
  const [nodeData, setNodeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to get appropriate icon for node type
  const getNodeIcon = useCallback((nodeType) => {
    return getNodeIconFromMap(nodeType);
  }, []);

  // Function to get node type from labels or fallback
  const getNodeType = useCallback((node) => {
    if (node.labels && Array.isArray(node.labels) && node.labels.length > 0) {
      return node.labels[0];
    }
    if (node.group) {
      return node.group;
    }
    return 'Unknown';
  }, []);

  // Function to get display name (remove "Show " prefix if present)
  const getDisplayName = useCallback((node) => {
    let name = node.name || node.label || node.title || node.id || 'Unknown Node';
    // Remove "Show " prefix if present
    name = name.replace(/^show\s+/i, '');
    return name;
  }, []);

  /**
   * Filters out technical/system properties that contain large data or are not user-friendly
   * This improves the UI by hiding fields like n2v embeddings, vector data, etc.
   * @param {Object} properties - The raw properties object from the node
   * @returns {Object} Filtered properties object with technical fields removed
   */
  const getFilteredProperties = useCallback((properties) => {
    if (!properties || typeof properties !== 'object') return {};
    
    // List of property keys to hide from the user interface
    const hiddenPropertyKeys = [
      'n2v',           // Node2Vec embeddings - large numerical vectors
      'embeddings',    // Any other embedding data
      'vector_data',   // Vector representations
      'embedding',     // Alternative embedding field names
      'vectors',       // Plural vector fields
      'features',      // Feature vectors
      'representation' // Data representations
    ];
    
    return Object.fromEntries(
      Object.entries(properties).filter(([key]) => 
        !hiddenPropertyKeys.some(hiddenKey => 
          key.toLowerCase().includes(hiddenKey.toLowerCase())
        )
      )
    );
  }, []);

  // Effect to load node details when selectedNode changes
  useEffect(() => {
    if (!selectedNode) {
      setNodeData(null);
      setError(null);
      return;
    }

    const isDataComplete = selectedNode.relationships && 
                          Array.isArray(selectedNode.relationships) && 
                          selectedNode.relationships.length > 0;

    // If data is complete, use it immediately without loading state
    if (isDataComplete) {
      setNodeData({
        id: selectedNode.id,
        name: getDisplayName(selectedNode),
        type: getNodeType(selectedNode),
        labels: selectedNode.labels || [],
        properties: selectedNode.properties || {},
        relationships: selectedNode.relationships
      });
    } else {
      // Handle case where relationships exist but are empty array
      if (Array.isArray(selectedNode.relationships) && selectedNode.relationships.length === 0) {
        setNodeData({
          id: selectedNode.id,
          name: getDisplayName(selectedNode),
          type: getNodeType(selectedNode),
          labels: selectedNode.labels || [],
          properties: selectedNode.properties || {},
          relationships: []
        });
        return;
      }

      // Need to fetch relationship data
      setIsLoading(true);
      setError(null);
      
      const fetchNodeDetails = async () => {
        try {
          const response = await getNodeDetails(selectedNode.id);
          
          setNodeData({
            id: response.id || selectedNode.id,
            name: getDisplayName(response) || getDisplayName(selectedNode),
            type: getNodeType(response) || getNodeType(selectedNode),
            labels: response.labels || selectedNode.labels || [],
            properties: response.properties || selectedNode.properties || {},
            relationships: response.relationships || []
          });
        } catch (err) {
          console.error('Error fetching node details:', err);
          setError('Failed to load node details');
          
          // Preserve basic node information even on error
          setNodeData({
            id: selectedNode.id,
            name: getDisplayName(selectedNode),
            type: getNodeType(selectedNode),
            labels: selectedNode.labels || [],
            properties: selectedNode.properties || {},
            relationships: []
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchNodeDetails();
    }
  }, [selectedNode]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle relationship node clicks
  const handleRelationshipNodeClick = useCallback((relatedNode) => {
    if (onNodeSelect && relatedNode) {
      onNodeSelect(relatedNode);
    }
  }, [onNodeSelect]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="details-panel">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading node details...</p>
        </div>
      </div>
    );
  }

  // Render error state if fetching fails
  if (error && !nodeData) {
    return (
      <div className="details-panel">
        <div className="error-message" style={{ margin: '20px' }}>
          <p>⚠️ {error}</p>
          <button className="close-button" onClick={onClose} style={{ top: '10px', right: '10px' }}>×</button>
        </div>
      </div>
    );
  }

  // Render when no node is selected
  if (!nodeData) {
    return (
      <div className="details-panel empty-panel">
        <p>No node selected</p>
      </div>
    );
  }

  const nodeType = nodeData.type;
  const iconSrc = `/svg/${getNodeIcon(nodeType)}`;

  return (
    <div className="details-panel">
      <div className="panel-header">
        <div className="node-icon-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={iconSrc} 
            alt={`${nodeType} icon`} 
            className="relationship-icon"
            onError={(e) => {
              console.warn(`Failed to load icon: ${iconSrc}`);
              e.target.src = '/svg/system-svgrepo-com.svg';
            }}
          />
          <div>
            <h2>{nodeData.name}</h2>
            <span className="detail-type">{nodeType}</span>
          </div>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="details-content">
        {/* Properties Section */}
        {nodeData.properties && Object.keys(nodeData.properties).length > 0 && (() => {
          const filteredProperties = getFilteredProperties(nodeData.properties);
          const hasVisibleProperties = Object.keys(filteredProperties).length > 0;
          
          return hasVisibleProperties ? (
            <div className="properties-list">
              <h4>Properties</h4>
              <table>
                <tbody>
                  {Object.entries(filteredProperties).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key.replace(/_/g, ' ')}</th>
                      <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null;
        })()}

        {/* Labels Section */}
        {nodeData.labels && nodeData.labels.length > 0 && (
          <div className="detail-group">
            <h4>Labels</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {nodeData.labels.map((label, index) => (
                <span key={index} className="legend-badge" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Relationships Section */}
        {nodeData.relationships && nodeData.relationships.length > 0 && (
          <div className="section">
            {(() => {
              // Separate MENTIONS relationships from others
              const mentionsRelationships = nodeData.relationships.filter(rel => 
                rel && typeof rel === 'object' && rel.type === 'MENTIONS'
              );
              const otherRelationships = nodeData.relationships.filter(rel => 
                rel && typeof rel === 'object' && rel.type !== 'MENTIONS'
              );

              // Further separate by direction
              const outgoingRelationships = otherRelationships.filter(rel => rel.direction === 'outgoing');
              const incomingRelationships = otherRelationships.filter(rel => rel.direction === 'incoming');

              return (
                <>
                  {/* Outgoing Relationships */}
                  {outgoingRelationships.length > 0 && (
                    <>
                      <h3 className="section-title outgoing-section">Outgoing Relationships ({outgoingRelationships.length})</h3>
                      <div className="relationships-list outgoing-list">
                        {outgoingRelationships.map((rel, index) => (
                          <div 
                            key={`${rel.type || 'unknown'}-${rel.direction || 'none'}-${index}`} 
                            className="relationship-item outgoing-item"
                            onClick={() => onNodeSelect && rel.node && onNodeSelect(rel.node)}
                          >
                            <div className="relationship-inline">
                              <span className="relationship-type">{rel.type || 'Unknown'}</span>
                              <span className="relationship-direction">
                                {rel.direction === 'outgoing' ? '→' : rel.direction === 'incoming' ? '←' : '↔'}
                              </span>
                              {rel.node ? (
                                <>
                                  <img 
                                    src={`/svg/${getNodeIcon(getNodeType(rel.node))}`}
                                    alt={`${getNodeType(rel.node)} icon`}
                                    className="relationship-icon"
                                    onError={(e) => e.target.src = '/svg/system-svgrepo-com.svg'}
                                  />
                                  <span className="node-name">{getDisplayName(rel.node) || 'Unnamed Node'}</span>
                                  <span className="node-type-separator">:</span>
                                  <span className="node-type">{getNodeType(rel.node) || 'Unknown Type'}</span>
                                </>
                              ) : (
                                <span className="node-name">Unknown Node</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Incoming Relationships */}
                  {incomingRelationships.length > 0 && (
                    <>
                      <h3 className="section-title incoming-section">Incoming Relationships ({incomingRelationships.length})</h3>
                      <div className="relationships-list incoming-list">
                        {incomingRelationships.map((rel, index) => (
                          <div 
                            key={`${rel.type || 'unknown'}-${rel.direction || 'none'}-${index}`} 
                            className="relationship-item incoming-item"
                            onClick={() => onNodeSelect && rel.node && onNodeSelect(rel.node)}
                          >
                            <div className="relationship-inline">
                              <span className="relationship-type">{rel.type || 'Unknown'}</span>
                              <span className="relationship-direction">
                                {rel.direction === 'outgoing' ? '→' : rel.direction === 'incoming' ? '←' : '↔'}
                              </span>
                              {rel.node ? (
                                <>
                                  <img 
                                    src={`/svg/${getNodeIcon(getNodeType(rel.node))}`}
                                    alt={`${getNodeType(rel.node)} icon`}
                                    className="relationship-icon"
                                    onError={(e) => e.target.src = '/svg/system-svgrepo-com.svg'}
                                  />
                                  <span className="node-name">{getDisplayName(rel.node) || 'Unnamed Node'}</span>
                                  <span className="node-type-separator">:</span>
                                  <span className="node-type">{getNodeType(rel.node) || 'Unknown Type'}</span>
                                </>
                              ) : (
                                <span className="node-name">Unknown Node</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Mentions Section - Separated */}
                  {mentionsRelationships.length > 0 && (
                    <>
                      <h3 className="section-title mentions-section">Document References ({mentionsRelationships.length})</h3>
                      <div className="relationships-list mentions-list">
                        {mentionsRelationships.map((rel, index) => (
                          <div 
                            key={`${rel.type || 'unknown'}-${rel.direction || 'none'}-${index}`} 
                            className="relationship-item mentions-item"
                            onClick={() => onNodeSelect && rel.node && onNodeSelect(rel.node)}
                          >
                            <div className="relationship-inline">
                              <span className="relationship-type">{rel.type || 'Unknown'}</span>
                              <span className="relationship-direction">
                                {rel.direction === 'outgoing' ? '→' : rel.direction === 'incoming' ? '←' : '↔'}
                              </span>
                              {rel.node ? (
                                <>
                                  <img 
                                    src={`/svg/${getNodeIcon(getNodeType(rel.node))}`}
                                    alt={`${getNodeType(rel.node)} icon`}
                                    className="relationship-icon"
                                    onError={(e) => e.target.src = '/svg/system-svgrepo-com.svg'}
                                  />
                                  <span className="node-name">{getDisplayName(rel.node) || 'Unnamed Node'}</span>
                                  <span className="node-type-separator">:</span>
                                  <span className="node-type">{getNodeType(rel.node) || 'Unknown Type'}</span>
                                </>
                              ) : (
                                <span className="node-name">Unknown Node</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Error Section */}
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="detail-actions">
          <button 
            className="back-button"
            onClick={onClose}
          >
            Back to Graph
          </button>
        </div>
      </div>
      
      <div className="panel-footer">
        <p className="hint">Press ESC to return to graph view</p>
      </div>
    </div>
  );
}

export default NodeDetails; 