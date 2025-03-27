import React from 'react';

const AnalysisPanel = ({ onRunAnalysis, selectedNode }) => {
    // Determine which analyses can be run on the selected node
    const canRunImpactAnalysis = selectedNode && ['Module', 'Product', 'Workflow', 'ConfigurationItem'].includes(selectedNode.group);
    const canRunTestCoverage = selectedNode && ['Module', 'Product', 'Workflow'].includes(selectedNode.group);
    const canRunDependencyAnalysis = selectedNode && ['Module', 'Product'].includes(selectedNode.group);
    
    return (
        <div className="analysis-panel">
            <h2>Analysis</h2>
            
            {!selectedNode ? (
                <p className="analysis-instruction">Select a node to perform analysis</p>
            ) : (
                <div className="analysis-options">
                    <div className="analysis-option">
                        <h3>Impact Analysis</h3>
                        <p>
                            Shows which components are affected by changes to the selected {selectedNode.group.toLowerCase()}.
                        </p>
                        <button 
                            onClick={() => onRunAnalysis('impact')}
                            disabled={!canRunImpactAnalysis}
                            className="analysis-btn"
                        >
                            Run Impact Analysis
                        </button>
                    </div>
                    
                    <div className="analysis-option">
                        <h3>Test Coverage</h3>
                        <p>
                            Shows which test cases validate the selected {selectedNode.group.toLowerCase()}.
                        </p>
                        <button 
                            onClick={() => onRunAnalysis('test-coverage')}
                            disabled={!canRunTestCoverage}
                            className="analysis-btn"
                        >
                            Show Test Coverage
                        </button>
                    </div>
                    
                    <div className="analysis-option">
                        <h3>Dependencies</h3>
                        <p>
                            Shows what components the selected {selectedNode.group.toLowerCase()} depends on.
                        </p>
                        <button 
                            onClick={() => onRunAnalysis('dependencies')}
                            disabled={!canRunDependencyAnalysis}
                            className="analysis-btn"
                        >
                            Show Dependencies
                        </button>
                    </div>
                    
                    <div className="analysis-option">
                        <h3>Reset View</h3>
                        <p>
                            Return to the default graph view.
                        </p>
                        <button 
                            onClick={() => onRunAnalysis(null)}
                            className="reset-btn"
                        >
                            Reset View
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisPanel; 