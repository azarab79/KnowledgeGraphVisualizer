/**
 * MockGraphRepository - Test implementation that returns fixtures
 */
class MockGraphRepository {
  constructor() {
    this.mockNodes = [
      { id: '1', label: 'Product A', group: 'Product', properties: { name: 'Product A' } },
      { id: '2', label: 'Module B', group: 'Module', properties: { name: 'Module B' } },
      { id: '3', label: 'Feature C', group: 'Feature', properties: { name: 'Feature C' } }
    ];
    
    this.mockEdges = [
      { id: 'r1', from: '1', to: '2', label: 'CONTAINS' },
      { id: 'r2', from: '2', to: '3', label: 'USES' }
    ];
  }

  async getInitialGraph(limit = 100) {
    return {
      nodes: this.mockNodes.slice(0, limit),
      edges: this.mockEdges
    };
  }

  async runLouvain(resolution = 1.0, subGraph = null) {
    return {
      modularity: 0.45,
      communityCount: 2,
      communities: [
        { communityId: 1, size: 2, label: 'Product A', nodeId: '1' },
        { communityId: 2, size: 1, label: 'Feature C', nodeId: '3' }
      ],
      nodes: this.mockNodes.map(n => ({ ...n, communityId: n.id === '3' ? 2 : 1 })),
      edges: this.mockEdges
    };
  }

  async predictLinks(topN = 20, threshold = 0.4) {
    return {
      predictions: [
        { source: 1, target: 3, probability: 0.85 },
        { source: 2, target: 1, probability: 0.72 }
      ]
    };
  }

  async getCentrality(type = 'degree', limit = 20) {
    return {
      nodes: this.mockNodes.map((n, i) => ({
        ...n,
        centrality: 3 - i,
        size: 30 + (3 - i) * 5,
        title: `${n.group}: ${n.label}\nCentrality: ${(3-i).toFixed(3)}`
      })),
      edges: []
    };
  }
}

module.exports = MockGraphRepository; 