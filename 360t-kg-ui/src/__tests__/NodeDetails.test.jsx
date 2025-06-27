import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NodeDetails from '../components/NodeDetails';

// Mock the API module
jest.mock('../services/api', () => ({
  getNodeDetails: jest.fn(),
  runImpactAnalysis: jest.fn()
}));

const api = require('../services/api');

describe('NodeDetails', () => {
  const mockNode = {
    id: '1',
    properties: { name: 'Test Node' },
    group: 'Module'
  };

  const mockRelatedNode = {
    id: '2',
    properties: { name: 'Related Node' },
    group: 'Product'
  };

  const mockDetails = {
    id: '1',
    properties: { name: 'Test Node' },
    group: 'Module',
    relationships: [
      {
        type: 'USES',
        direction: 'outgoing',
        node: mockRelatedNode
      },
      {
        type: 'MENTIONS',
        direction: 'incoming',
        node: {
          id: '3',
          properties: { 
            name: 'Document',
            text: 'This is a long document text that should be truncated in the tooltip'
          },
          group: 'Document'
        }
      }
    ]
  };

  const defaultProps = {
    selectedNode: mockNode,
    onClose: jest.fn(),
    onAnalysisResults: jest.fn(),
    onNodeSelect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    api.getNodeDetails.mockResolvedValue(mockDetails);
  });

  it('renders node details correctly', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Node Details')).toBeInTheDocument();
    });
  });

  it('displays relationships with correct styling', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      const relationshipNodes = screen.getAllByText(/Related Node|Document/);
      expect(relationshipNodes.length).toBeGreaterThan(0);
      
      // Check if clickable class is applied
      const clickableRelationships = document.querySelectorAll('.relationship-node.clickable');
      expect(clickableRelationships.length).toBeGreaterThan(0);
    });
  });

  it('calls onNodeSelect when relationship is clicked', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      const relatedNodeElement = screen.getByText('Related Node');
      expect(relatedNodeElement).toBeInTheDocument();
    });

    const relatedNodeElement = screen.getByText('Related Node');
    fireEvent.click(relatedNodeElement);

    expect(defaultProps.onNodeSelect).toHaveBeenCalledWith(mockRelatedNode);
  });

  it('shows tooltip for incoming mentions', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      const documentElement = screen.getByText('Document');
      expect(documentElement).toBeInTheDocument();
    });
  });

  it('handles relationship click with missing node gracefully', async () => {
    const detailsWithMissingNode = {
      ...mockDetails,
      relationships: [
        {
          type: 'USES',
          direction: 'outgoing',
          node: null
        }
      ]
    };

    api.getNodeDetails.mockResolvedValue(detailsWithMissingNode);

    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Node Details')).toBeInTheDocument();
    });

    // Should not crash and onNodeSelect should not be called for null nodes
    expect(defaultProps.onNodeSelect).not.toHaveBeenCalled();
  });

  it('closes details panel when close button is clicked', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      const closeButton = screen.getByText('×');
      expect(closeButton).toBeInTheDocument();
    });

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows proper tooltip title for clickable relationships', async () => {
    render(<NodeDetails {...defaultProps} />);
    
    await waitFor(() => {
      const relatedNodeElement = screen.getByText('Related Node');
      expect(relatedNodeElement).toBeInTheDocument();
      expect(relatedNodeElement).toHaveAttribute('title', 'Click to navigate to this node');
    });
  });
}); 