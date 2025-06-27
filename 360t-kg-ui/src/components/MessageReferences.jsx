import React, { useState, useMemo, useCallback } from 'react';
import DocumentIcon from './DocumentIcon';
import NodeChip from './NodeChip';
import './MessageReferences.css';
import '../types/chat.js';

/**
 * MessageReferences component that displays source documents and nodes for a chat message
 * Features a tabbed interface with Sources, Nodes, and All tabs
 * Optimized for performance with React.memo and memoized calculations
 * 
 * @param {Object} props
 * @param {SourceDocument[]} props.sourceDocuments - Array of source documents
 * @param {SourceNode[]} props.sourceNodes - Array of source nodes
 * @param {('user'|'assistant')} props.messageRole - Role of the message
 * @param {function(string): void} [props.onNodeSelect] - Callback when a node is selected
 */
const MessageReferences = ({ 
  sourceDocuments = [], 
  sourceNodes = [], 
  messageRole = 'assistant',
  onNodeSelect 
}) => {
  // Only show references for assistant messages
  if (messageRole !== 'assistant') {
    return null;
  }

  // Memoize computed values for performance
  const hasDocuments = useMemo(() => sourceDocuments && sourceDocuments.length > 0, [sourceDocuments]);
  const hasNodes = useMemo(() => sourceNodes && sourceNodes.length > 0, [sourceNodes]);
  
  // If no references at all, don't render anything
  if (!hasDocuments && !hasNodes) {
    return null;
  }

  // Memoize the default tab calculation
  const defaultTab = useMemo(() => {
    if (hasDocuments && hasNodes) return 'all';
    if (hasDocuments) return 'sources';
    if (hasNodes) return 'nodes';
    return 'sources';
  }, [hasDocuments, hasNodes]);

  const [activeTab, setActiveTab] = useState(defaultTab);

  // Memoize node select handler
  const handleNodeSelect = useCallback((node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }, [onNodeSelect]);

  // Memoize tab change handlers
  const handleSourcesTab = useCallback(() => setActiveTab('sources'), []);
  const handleNodesTab = useCallback(() => setActiveTab('nodes'), []);
  const handleAllTab = useCallback(() => setActiveTab('all'), []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <div className="tab-content" role="tabpanel" aria-labelledby="sources-tab" id="sources-panel">
            {hasDocuments ? (
              <div className="document-icons-container">
                {sourceDocuments.map((document, index) => (
                  <DocumentIcon
                    key={document.id || `doc-${index}`}
                    document={{
                      ...document,
                      metadata: {
                        ...document.metadata,
                        total: sourceDocuments.length
                      }
                    }}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">No source documents available</div>
            )}
          </div>
        );

      case 'nodes':
        return (
          <div className="tab-content" role="tabpanel" aria-labelledby="nodes-tab" id="nodes-panel">
            {hasNodes ? (
              <div className="node-chips-container">
                {sourceNodes.map((node, index) => (
                  <NodeChip
                    key={node.id || `node-${index}`}
                    node={node}
                    onSelect={handleNodeSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">No source nodes available</div>
            )}
          </div>
        );

      case 'all':
        return (
          <div className="tab-content" role="tabpanel" aria-labelledby="all-tab" id="all-panel">
            <div className="all-references-container">
              {hasDocuments && (
                <div className="all-section">
                  <div className="all-section-label">Documents:</div>
                  <div className="document-icons-container">
                    {sourceDocuments.map((document, index) => (
                      <DocumentIcon
                        key={`all-doc-${document.id || index}`}
                        document={{
                          ...document,
                          metadata: {
                            ...document.metadata,
                            total: sourceDocuments.length
                          }
                        }}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}
              {hasNodes && (
                <div className="all-section">
                  <div className="all-section-label">Nodes:</div>
                  <div className="node-chips-container">
                    {sourceNodes.map((node, index) => (
                      <NodeChip
                        key={`all-node-${node.id || index}`}
                        node={node}
                        onSelect={handleNodeSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!hasDocuments && !hasNodes && (
                <div className="empty-state">No references available</div>
              )}
            </div>
          </div>
        );

      default:
        return <div className="empty-state">Unknown tab</div>;
    }
  };

  // Don't render if no documents AND no nodes (this was the bug!)
  if (!hasDocuments && !hasNodes) {
    return null;
  }

  return (
    <div className="message-references">
      {/* Tab Header */}
      <div className="tab-header" role="tablist" aria-label="Message references">
        {hasDocuments && (
          <button
            id="sources-tab"
            role="tab"
            aria-selected={activeTab === 'sources'}
            aria-controls="sources-panel"
            className={`tab-button ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={handleSourcesTab}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
            <span>Sources</span>
            <span className="count">({sourceDocuments.length})</span>
          </button>
        )}
        
        {hasNodes && (
          <button
            id="nodes-tab"
            role="tab"
            aria-selected={activeTab === 'nodes'}
            aria-controls="nodes-panel"
            className={`tab-button ${activeTab === 'nodes' ? 'active' : ''}`}
            onClick={handleNodesTab}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            <span>Nodes</span>
            <span className="count">({sourceNodes.length})</span>
          </button>
        )}
        
        {hasDocuments && hasNodes && (
          <button
            id="all-tab"
            role="tab"
            aria-selected={activeTab === 'all'}
            aria-controls="all-panel"
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={handleAllTab}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
            <span>All</span>
            <span className="count">({sourceDocuments.length + sourceNodes.length})</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

// Add display name for debugging
MessageReferences.displayName = 'MessageReferences';

export default React.memo(MessageReferences); 