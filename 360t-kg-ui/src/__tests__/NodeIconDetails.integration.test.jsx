import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NodeChip from '../components/NodeChip';
import NodeDetails from '../components/NodeDetails';

// Mock API calls used by NodeDetails so the component renders quickly
jest.mock('../services/api', () => ({
  getNodeDetails: jest.fn(async (id) => ({
    id,
    label: 'System',
    group: 'System',
    properties: { name: `Node ${id}` },
    relationships: []
  })),
  runImpactAnalysis: jest.fn()
}));

function Wrapper({ nodes }) {
  const [selectedNode, setSelectedNode] = React.useState(null);

  return (
    <div>
      {/* Render NodeChip list */}
      <div data-testid="chip-list">
        {nodes.map((node) => (
          <NodeChip key={node.id} node={node} onSelect={setSelectedNode} />
        ))}
      </div>

      {/* Conditionally render NodeDetails when a node is selected */}
      {selectedNode && (
        <NodeDetails selectedNode={selectedNode} onClose={() => setSelectedNode(null)} onAnalysisResults={() => {}} onNodeSelect={setSelectedNode} />
      )}
    </div>
  );
}

describe('Node icons and details integration', () => {
  const mockNodes = Array.from({ length: 10 }).map((_, i) => ({
    id: `node-${i + 1}`,
    name: `Node ${i + 1}`,
    labels: ['System']
  }));

  it('renders 10 node icons and opens details on click', async () => {
    const user = userEvent.setup();

    render(<Wrapper nodes={mockNodes} />);

    // Ensure 10 NodeChips are rendered (each has role button)
    const chips = await screen.findAllByRole('button');
    expect(chips).toHaveLength(10);

    // Click the first chip
    await user.click(chips[0]);

    // NodeDetails should appear with "Node Details" heading
    const heading = await screen.findByRole('heading', { name: /node details/i });
    expect(heading).toBeInTheDocument();
  });
}); 