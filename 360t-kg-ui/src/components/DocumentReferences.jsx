import React from 'react';
import DocumentIcon from './DocumentIcon';
import './DocumentReferences.css';

/**
 * DocumentReferences component that displays source documents for a chat message
 * Shows small document icons that reveal full text content on hover
 */
function DocumentReferences({ documents = [], messageRole = 'assistant' }) {
  // Only show documents for assistant messages
  if (messageRole !== 'assistant' || !documents || documents.length === 0) {
    return null;
  }

  return (
    <div className="document-references">
      <div className="document-references-label">
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
        <span>Sources:</span>
      </div>
      <div className="document-icons-container">
        {documents.map((document, index) => (
          <DocumentIcon
            key={document.id || `doc-${index}`}
            document={{
              ...document,
              metadata: {
                ...document.metadata,
                total: documents.length
              }
            }}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

export default DocumentReferences; 