import React, { useState, useEffect } from 'react';
import neo4jService from '../services/neo4jService';

const FilterPanel = ({ onFilterChange, onError }) => {
    const [nodeLabels, setNodeLabels] = useState([]);
    const [relationshipTypes, setRelationshipTypes] = useState([]);
    const [selectedNodeLabels, setSelectedNodeLabels] = useState([]);
    const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Load metadata (available node labels and relationship types)
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                setIsLoading(true);
                const data = await neo4jService.getMetadata();
                
                setNodeLabels(data.nodeLabels);
                setRelationshipTypes(data.relationshipTypes);
                
                // Initially select all node labels and relationship types
                setSelectedNodeLabels(data.nodeLabels.map(item => item.label));
                setSelectedRelationshipTypes(data.relationshipTypes.map(item => item.type));
                
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading metadata:', error);
                setIsLoading(false);
                onError('Failed to load filter options. Please check API connection.');
            }
        };
        
        loadMetadata();
    }, [onError]);
    
    // Handle node label checkbox change
    const handleNodeLabelChange = (label) => {
        const updatedSelection = selectedNodeLabels.includes(label)
            ? selectedNodeLabels.filter(item => item !== label)
            : [...selectedNodeLabels, label];
            
        setSelectedNodeLabels(updatedSelection);
    };
    
    // Handle relationship type checkbox change
    const handleRelationshipTypeChange = (type) => {
        const updatedSelection = selectedRelationshipTypes.includes(type)
            ? selectedRelationshipTypes.filter(item => item !== type)
            : [...selectedRelationshipTypes, type];
            
        setSelectedRelationshipTypes(updatedSelection);
    };
    
    // Apply filters
    const applyFilters = () => {
        onFilterChange(selectedNodeLabels, selectedRelationshipTypes);
    };
    
    // Select/deselect all node labels
    const toggleAllNodeLabels = (select) => {
        if (select) {
            setSelectedNodeLabels(nodeLabels.map(item => item.label));
        } else {
            setSelectedNodeLabels([]);
        }
    };
    
    // Select/deselect all relationship types
    const toggleAllRelationshipTypes = (select) => {
        if (select) {
            setSelectedRelationshipTypes(relationshipTypes.map(item => item.type));
        } else {
            setSelectedRelationshipTypes([]);
        }
    };
    
    return (
        <div className="filter-panel">
            <h2>Filters</h2>
            
            {isLoading ? (
                <div className="filter-loading">Loading filter options...</div>
            ) : (
                <>
                    <div className="filter-section">
                        <div className="filter-header">
                            <h3>Node Types</h3>
                            <div className="filter-actions">
                                <button 
                                    onClick={() => toggleAllNodeLabels(true)}
                                    className="select-all-btn"
                                >
                                    Select All
                                </button>
                                <button 
                                    onClick={() => toggleAllNodeLabels(false)}
                                    className="clear-all-btn"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                        
                        <div className="filter-options">
                            {nodeLabels.map(item => (
                                <label key={item.label} className="filter-option">
                                    <input
                                        type="checkbox"
                                        checked={selectedNodeLabels.includes(item.label)}
                                        onChange={() => handleNodeLabelChange(item.label)}
                                    />
                                    {item.label} ({item.count})
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-section">
                        <div className="filter-header">
                            <h3>Relationship Types</h3>
                            <div className="filter-actions">
                                <button 
                                    onClick={() => toggleAllRelationshipTypes(true)}
                                    className="select-all-btn"
                                >
                                    Select All
                                </button>
                                <button 
                                    onClick={() => toggleAllRelationshipTypes(false)}
                                    className="clear-all-btn"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                        
                        <div className="filter-options">
                            {relationshipTypes.map(item => (
                                <label key={item.type} className="filter-option">
                                    <input
                                        type="checkbox"
                                        checked={selectedRelationshipTypes.includes(item.type)}
                                        onChange={() => handleRelationshipTypeChange(item.type)}
                                    />
                                    {item.type} ({item.count})
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-actions-container">
                        <button 
                            onClick={applyFilters}
                            className="apply-filters-btn"
                            disabled={selectedNodeLabels.length === 0 || selectedRelationshipTypes.length === 0}
                        >
                            Apply Filters
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default FilterPanel; 