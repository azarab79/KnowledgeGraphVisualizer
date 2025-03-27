import React from 'react';

const DetailsPanel = ({ selectedNode }) => {
    if (!selectedNode) {
        return (
            <div className="details-panel">
                <h2>Node Details</h2>
                <p>Select a node to view its details</p>
            </div>
        );
    }
    
    // Get label/type and all properties
    const nodeType = selectedNode.group;
    const nodeProperties = selectedNode.properties || {};
    
    // Format property display
    const renderPropertyValue = (key, value) => {
        // If the property is a URL or guide_page_ref, make it clickable
        if ((key === 'guide_page_ref' || key.toLowerCase().includes('url')) && 
            typeof value === 'string' && 
            (value.startsWith('http') || value.startsWith('/'))) {
            
            const href = value.startsWith('/') 
                ? `${window.location.origin}${value}`
                : value;
                
            return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                    {value}
                </a>
            );
        }
        
        // If the value is an array, join it
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        
        // Handle boolean values
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        
        // Default case, just return the value as string
        return String(value);
    };
    
    return (
        <div className="details-panel">
            <h2>{nodeType} Details</h2>
            
            <div className="node-header">
                <h3>{nodeProperties.name || nodeProperties.test_case_id || 'Unnamed node'}</h3>
                <span className="node-id">ID: {selectedNode.id}</span>
            </div>
            
            <div className="property-list">
                {Object.entries(nodeProperties).map(([key, value]) => (
                    <div className="property-item" key={key}>
                        <div className="property-key">{key}:</div>
                        <div className="property-value">
                            {renderPropertyValue(key, value)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DetailsPanel; 