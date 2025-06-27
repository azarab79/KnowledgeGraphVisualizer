import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageReferences from '../components/MessageReferences';

// Mock data for testing
const mockSourceDocuments = [
  {
    id: 'doc-1',
    title: 'Risk Management Guide',
    full_text: 'This document explains risk management procedures and best practices for financial institutions.',
    metadata: { title: 'Risk Management Guide', source: 'documentation' }
  },
  {
    id: 'doc-2', 
    title: 'Trading Procedures',
    full_text: 'Guidelines for trading operations and compliance requirements for traders.',
    metadata: { title: 'Trading Procedures', source: 'manual' }
  }
];

const mockSourceNodes = [
  {
    id: 'node-123',
    name: 'Risk Management System',
    labels: ['System', 'Risk']
  },
  {
    id: 'node-456',
    name: 'Trading Platform', 
    labels: ['Platform', 'Trading']
  },
  {
    id: 'node-789',
    name: 'Analytics Engine',
    labels: ['Engine', 'Analytics']
  }
];

describe('MessageReferences Integration', () => {
  beforeEach(() => {
    // Mock console methods to reduce noise
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render tabs correctly with both documents and nodes', () => {
    const mockOnNodeSelect = jest.fn();
    
    render(
      <MessageReferences
        sourceDocuments={mockSourceDocuments}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Should show all three tabs
    expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /nodes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();

    // Should show correct counts
    expect(screen.getByText('(2)')).toBeInTheDocument(); // 2 documents
    expect(screen.getByText('(3)')).toBeInTheDocument(); // 3 nodes
    expect(screen.getByText('(5)')).toBeInTheDocument(); // 5 total
  });

  it('should show only sources tab when no nodes present', () => {
    render(
      <MessageReferences
        sourceDocuments={mockSourceDocuments}
        sourceNodes={[]}
        messageRole="assistant"
        onNodeSelect={jest.fn()}
      />
    );

    // Should only show Sources tab
    expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /nodes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /all/i })).not.toBeInTheDocument();
  });

  it('should show only nodes tab when no documents present', () => {
    render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={jest.fn()}
      />
    );

    // Should only show Nodes tab
    expect(screen.queryByRole('tab', { name: /sources/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /nodes/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /all/i })).not.toBeInTheDocument();
  });

  it('should not render for user messages', () => {
    const { container } = render(
      <MessageReferences
        sourceDocuments={mockSourceDocuments}
        sourceNodes={mockSourceNodes}
        messageRole="user"
        onNodeSelect={jest.fn()}
      />
    );

    // Should render nothing for user messages
    expect(container.firstChild).toBeNull();
  });

  it('should not render when no sources or nodes', () => {
    const { container } = render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={[]}
        messageRole="assistant"
        onNodeSelect={jest.fn()}
      />
    );

    // Should render nothing when no references
    expect(container.firstChild).toBeNull();
  });

  it('should switch tabs correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <MessageReferences
        sourceDocuments={mockSourceDocuments}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={jest.fn()}
      />
    );

    // Should start with All tab active (default when both documents and nodes are present)
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    const nodesTab = screen.getByRole('tab', { name: /nodes/i });
    const allTab = screen.getByRole('tab', { name: /all/i });

    expect(sourcesTab).toHaveAttribute('aria-selected', 'false');
    expect(nodesTab).toHaveAttribute('aria-selected', 'false');
    expect(allTab).toHaveAttribute('aria-selected', 'true');

    // Click Nodes tab
    await user.click(nodesTab);

    expect(sourcesTab).toHaveAttribute('aria-selected', 'false');
    expect(nodesTab).toHaveAttribute('aria-selected', 'true');
    expect(allTab).toHaveAttribute('aria-selected', 'false');

    // Should show node chips
    expect(screen.getByText('node-123')).toBeInTheDocument();
    expect(screen.getByText('node-456')).toBeInTheDocument();
    expect(screen.getByText('node-789')).toBeInTheDocument();

    // Click All tab
    await user.click(allTab);

    expect(sourcesTab).toHaveAttribute('aria-selected', 'false');
    expect(nodesTab).toHaveAttribute('aria-selected', 'false');
    expect(allTab).toHaveAttribute('aria-selected', 'true');

    // Should show section labels
    expect(screen.getByText('Documents:')).toBeInTheDocument();
    expect(screen.getByText('Nodes:')).toBeInTheDocument();
  });

  it('should handle node selection correctly', async () => {
    const user = userEvent.setup();
    const mockOnNodeSelect = jest.fn();
    
    render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Find and click a node chip
    const nodeChip = screen.getByText('node-123').closest('.node-chip');
    await user.click(nodeChip);

    // Should call onNodeSelect with the node ID
    expect(mockOnNodeSelect).toHaveBeenCalledWith('node-123');
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple node selections', async () => {
    const user = userEvent.setup();
    const mockOnNodeSelect = jest.fn();
    
    render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Click multiple nodes
    const firstChip = screen.getByText('node-123').closest('.node-chip');
    const secondChip = screen.getByText('node-456').closest('.node-chip');
    
    await user.click(firstChip);
    await user.click(secondChip);

    // Should call onNodeSelect for each click
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(2);
    expect(mockOnNodeSelect).toHaveBeenNthCalledWith(1, 'node-123');
    expect(mockOnNodeSelect).toHaveBeenNthCalledWith(2, 'node-456');
  });

  it('should work without onNodeSelect handler', async () => {
    const user = userEvent.setup();
    
    render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
      />
    );

    // Should not crash when clicking without handler
    const nodeChip = screen.getByText('node-123').closest('.node-chip');
    await user.click(nodeChip);

    // Component should still be rendered
    expect(screen.getByText('node-123')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <MessageReferences
        sourceDocuments={mockSourceDocuments}
        sourceNodes={mockSourceNodes}
        messageRole="assistant"
        onNodeSelect={jest.fn()}
      />
    );

    // Tab container should have proper role
    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('aria-label', 'Message references');

    // Tabs should have proper attributes
    const sourcesTab = screen.getByRole('tab', { name: /sources/i });
    expect(sourcesTab).toHaveAttribute('aria-controls', 'sources-panel');
    expect(sourcesTab).toHaveAttribute('id', 'sources-tab');

    // Tab panels should exist (even if not visible)
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /nodes/i })).toHaveAttribute('aria-controls', 'tabpanel-nodes');
  });

  // New test case based on the PRD for icon mapping
  it('should render correct icons for all node types from the icon map', async () => {
    const user = userEvent.setup();
    const mockOnNodeSelect = jest.fn();
    
    // Create mock nodes based on ICON_MAP from the application
    const { ICON_MAP } = await import('../components/constants/iconMap');
    const mockNodesForIcons = Object.keys(ICON_MAP).map((label, index) => ({
      id: `node-icon-${index}`,
      name: `${label} Node`,
      labels: [label],
    }));

    render(
      <MessageReferences
        sourceDocuments={[]}
        sourceNodes={mockNodesForIcons}
        messageRole="assistant"
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // 1. Check if all images (icons) are rendered.
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(mockNodesForIcons.length);

    // 2. Check if the rendered icons have the correct src from the map.
    images.forEach((img, index) => {
      const node = mockNodesForIcons[index];
      const expectedIconFile = ICON_MAP[node.labels[0]];
      expect(img.src).toContain(`/svg/${expectedIconFile}`);
    });

    // 3. Simulate a click on the first chip and verify the callback.
    const firstChip = screen.getByText(`${mockNodesForIcons[0].labels[0]} Node`).closest('.node-chip');
    await user.click(firstChip);

    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1);
    expect(mockOnNodeSelect).toHaveBeenCalledWith(mockNodesForIcons[0]);
  });
}); 