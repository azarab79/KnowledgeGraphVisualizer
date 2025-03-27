import React, { useEffect, useState } from 'react';
import { getNodeDetails, runImpactAnalysis } from '../services/api';

/**
 * NodeDetails component for displaying detailed information about a selected node
 * @param {Object} props - Component props
 * @param {Object} props.selectedNode - The currently selected node
 * @param {Function} props.onClose - Function to close the details panel
 * @param {Function} props.onAnalysisResults - Function to handle impact analysis results
 */
function NodeDetails({ selectedNode, onClose, onAnalysisResults }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  // Fetch node details when selectedNode changes
  useEffect(() => {
    if (!selectedNode) {
      setDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const nodeDetails = await getNodeDetails(selectedNode.id);
        setDetails(nodeDetails);
      } catch (err) {
        console.error('Error fetching node details:', err);
        setError('Failed to load node details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedNode]);
  
  // Add escape key listener
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    // Add event listener
    document.addEventListener('keydown', handleEscKey);
    
    // Clean up
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  // Run impact analysis for the selected node
  const handleRunAnalysis = async () => {
    if (!selectedNode) return;
    
    setRunningAnalysis(true);
    
    try {
      const results = await runImpactAnalysis(selectedNode.id);
      onAnalysisResults(results);
    } catch (err) {
      console.error('Error running impact analysis:', err);
      setError('Failed to run impact analysis. Please try again.');
    } finally {
      setRunningAnalysis(false);
    }
  };

  if (!selectedNode) {
    return (
      <div className="details-panel empty-panel">
        <p>Select a node to view details</p>
      </div>
    );
  }

  return (
    <div className="details-panel">
      <div className="panel-header">
        <h2>Node Details</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      {loading ? (
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p>Loading details...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => {
              setDetails(null);
              setError(null);
            }}
          >
            Retry
          </button>
        </div>
      ) : details ? (
        <div className="details-content">
          <div className="detail-group">
            <h3 className="detail-type">{details.label || details.group}</h3>
            <h4 className="detail-name">{details.properties?.name || 'Unnamed'}</h4>
          </div>
          
          <div className="properties-list">
            <h4>Properties</h4>
            <table>
              <tbody>
                {Object.entries(details.properties || {})
                  .filter(([key]) => key !== 'name') // Skip name as it's already displayed
                  .map(([key, value]) => (
                    <tr key={key}>
                      <th>{key.replace('_', ' ')}</th>
                      <td>{String(value)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          
          {details.relationships && details.relationships.length > 0 && (
            <div className="relationships-list">
              <h4>Relationships</h4>
              <ul>
                {details.relationships.map((rel, index) => (
                  <li key={index}>
                    <span className="relationship-type">
                      {rel.direction === 'outgoing' ? 'OUT: ' : 'IN: '}
                      {rel.type}
                    </span>
                    <span className="relationship-node">{rel.node?.properties?.name || rel.node?.label || 'Unnamed'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="detail-actions">
            <button 
              className="action-button"
              onClick={handleRunAnalysis}
              disabled={runningAnalysis}
            >
              {runningAnalysis ? 'Running Analysis...' : 'Run Impact Analysis'}
            </button>
            
            <button 
              className="back-button"
              onClick={onClose}
            >
              Back to Graph
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-message">
          <p>No details available</p>
        </div>
      )}
      
      <div className="panel-footer">
        <p className="hint">Press ESC to return to graph view</p>
      </div>
    </div>
  );
}

export default NodeDetails; 