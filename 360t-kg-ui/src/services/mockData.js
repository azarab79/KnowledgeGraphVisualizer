/**
 * Mock data for testing the UI without a backend
 */

// Mock nodes
const mockNodes = [
  {
    id: "1",
    labels: ["Module"],
    properties: {
      name: "Trading Core",
      version: "1.2.3",
      description: "Core trading functionality module"
    }
  },
  {
    id: "2",
    labels: ["Module"],
    properties: {
      name: "Market Data Service",
      version: "2.0.1",
      description: "Market data processing service"
    }
  },
  {
    id: "3",
    labels: ["Product"],
    properties: {
      name: "FX Spot",
      product_type: "Currency",
      description: "Foreign Exchange Spot Trading"
    }
  },
  {
    id: "4",
    labels: ["TestCase"],
    properties: {
      name: "Market Data Setup",
      test_case_id: "TC-001",
      priority: "High",
      automation_status: "Automated"
    }
  },
  {
    id: "5",
    labels: ["ConfigurationItem"],
    properties: {
      name: "FX Configuration",
      config_type: "System",
      description: "FX system configuration"
    }
  },
  {
    id: "6",
    labels: ["Workflow"],
    properties: {
      name: "Order Execution",
      description: "Order execution workflow"
    }
  }
];

// Mock relationships
const mockRelationships = [
  {
    from: "1",
    to: "3",
    label: "SUPPORTS",
    id: "r1"
  },
  {
    from: "1",
    to: "2",
    label: "USES",
    id: "r2"
  },
  {
    from: "4",
    to: "2",
    label: "VALIDATES",
    id: "r3"
  },
  {
    from: "3",
    to: "5",
    label: "REQUIRES",
    id: "r4"
  },
  {
    from: "6",
    to: "1",
    label: "IMPLEMENTED_BY",
    id: "r5"
  }
];

/**
 * Mock search function
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results
 */
export const mockSearch = async (query) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Filter nodes based on query
      const filteredNodes = query 
        ? mockNodes.filter(node => 
            node.properties.name.toLowerCase().includes(query.toLowerCase()) ||
            node.label.toLowerCase().includes(query.toLowerCase()))
        : [];
        
      resolve({ nodes: filteredNodes });
    }, 500); // Simulate API delay
  });
};

/**
 * Mock get relationships function
 * @param {string} nodeId - ID of the node
 * @returns {Promise<Object>} - Relationships data
 */
export const mockGetRelationships = async (nodeId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Get all relationships where the node is involved
      const relevantRelationships = mockRelationships.filter(
        rel => rel.from === nodeId || rel.to === nodeId
      );
      
      // Get all connected node IDs
      const connectedNodeIds = new Set();
      relevantRelationships.forEach(rel => {
        connectedNodeIds.add(rel.from);
        connectedNodeIds.add(rel.to);
      });
      
      // Get all relevant nodes
      const nodes = mockNodes.filter(node => connectedNodeIds.has(node.id));
      
      resolve({
        nodes,
        edges: relevantRelationships
      });
    }, 700); // Simulate API delay
  });
};

/**
 * Mock impact analysis function
 * @param {string} nodeId - ID of the node
 * @returns {Promise<Object>} - Impact analysis results
 */
export const mockImpactAnalysis = async (nodeId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // For impact analysis, we'll just return a bigger graph
      const nodes = [...mockNodes];
      const edges = [...mockRelationships];
      
      resolve({
        nodes,
        edges
      });
    }, 1200); // Simulate API delay
  });
};

/**
 * Mock metadata function
 * @returns {Promise<Object>} - Metadata with node and relationship types
 */
export const mockGetMetadata = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nodeLabels: ["Module", "Product", "TestCase", "ConfigItem", "Workflow"],
        relationshipTypes: ["SUPPORTS", "USES", "VALIDATES", "REQUIRES", "IMPLEMENTED_BY"]
      });
    }, 300);
  });
};

// Add a mock initial graph function that returns a simple node-link structure
export const mockInitialGraph = () => {
  return {
    nodes: [
      { id: '1', labels: ['Product'], properties: { name: 'Product A' } },
      { id: '2', labels: ['Module'], properties: { name: 'Module B' } },
      { id: '3', labels: ['TestCase'], properties: { name: 'TestCase C' } },
      { id: '4', labels: ['UI_Area'], properties: { name: 'UI Area D' } },
      { id: '5', labels: ['ConfigurationItem'], properties: { name: 'Config E' } },
      { id: '6', labels: ['Workflow'], properties: { name: 'Workflow F' } },
      { id: '7', labels: ['Database'], properties: { name: 'Database G' } },
      { id: '8', labels: ['Service'], properties: { name: 'Service H' } }
    ],
    links: [
      { id: '1', source: '1', target: '2', type: 'CONTAINS' },
      { id: '2', source: '2', target: '3', type: 'VALIDATES' },
      { id: '3', source: '2', target: '4', type: 'DISPLAYS' },
      { id: '4', source: '1', target: '5', type: 'CONFIGURES_IN' },
      { id: '5', source: '4', target: '3', type: 'VALIDATES' },
      { id: '6', source: '6', target: '2', type: 'EXECUTES' },
      { id: '7', source: '7', target: '1', type: 'STORES' },
      { id: '8', source: '8', target: '7', type: 'ACCESSES' }
    ]
  };
}; 