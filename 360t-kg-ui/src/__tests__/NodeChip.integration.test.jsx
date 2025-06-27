import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NodeChip from '../components/NodeChip';

// Mock node data
const mockNode = {
  id: 'test-node-123',
  name: 'Test Node',
  labels: ['TestType', 'ExampleLabel']
};

describe('NodeChip Integration', () => {
  beforeEach(() => {
    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render compact layout with only icon and ID', () => {
    render(<NodeChip node={mockNode} onSelect={jest.fn()} />);
    
    // Should show ID
    expect(screen.getByText('test-node-123')).toBeInTheDocument();
    
    // Should have icon
    const icon = screen.getByRole('img');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('alt', '');
    
    // Should NOT show name or labels in main display (only in tooltip)
    expect(screen.queryByText('Test Node')).not.toBeInTheDocument();
    expect(screen.queryByText('TestType')).not.toBeInTheDocument();
  });

  it('should call onSelect with node ID when clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();
    
    render(<NodeChip node={mockNode} onSelect={mockOnSelect} />);
    
    const chip = screen.getByRole('button');
    await user.click(chip);
    
    expect(mockOnSelect).toHaveBeenCalledWith('test-node-123');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onSelect when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();
    
    render(<NodeChip node={mockNode} onSelect={mockOnSelect} />);
    
    const chip = screen.getByRole('button');
    chip.focus();
    await user.keyboard('{Enter}');
    
    expect(mockOnSelect).toHaveBeenCalledWith('test-node-123');
  });

  it('should call onSelect when Space key is pressed', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();
    
    render(<NodeChip node={mockNode} onSelect={mockOnSelect} />);
    
    const chip = screen.getByRole('button');
    chip.focus();
    await user.keyboard(' ');
    
    expect(mockOnSelect).toHaveBeenCalledWith('test-node-123');
  });

  it('should show tooltip on hover with node details', async () => {
    const user = userEvent.setup();
    
    render(<NodeChip node={mockNode} onSelect={jest.fn()} />);
    
    const chip = screen.getByRole('button');
    await user.hover(chip);
    
    // Tooltip should show full details
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('test-node-123')).toBeInTheDocument();
    expect(screen.getByText('TestType, ExampleLabel')).toBeInTheDocument();
    expect(screen.getByText('Click to view details')).toBeInTheDocument();
  });

  it('should hide tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    
    render(<NodeChip node={mockNode} onSelect={jest.fn()} />);
    
    const chip = screen.getByRole('button');
    
    // Hover to show tooltip
    await user.hover(chip);
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    
    // Unhover to hide tooltip
    await user.unhover(chip);
    expect(screen.queryByText('Test Node')).not.toBeInTheDocument();
  });

  it('should work with minimal node data', () => {
    const minimalNode = { id: 'minimal-123' };
    
    render(<NodeChip node={minimalNode} onSelect={jest.fn()} />);
    
    // Should show ID as both display and name
    expect(screen.getByText('minimal-123')).toBeInTheDocument();
    
    // Should have proper aria-label
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-label', 'minimal-123');
  });

  it('should not crash without onSelect handler', async () => {
    const user = userEvent.setup();
    
    render(<NodeChip node={mockNode} />);
    
    const chip = screen.getByRole('button');
    
    // Should not throw when clicked
    await user.click(chip);
    await user.keyboard('{Enter}');
    
    // Component should still be rendered
    expect(screen.getByText('test-node-123')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<NodeChip node={mockNode} onSelect={jest.fn()} />);
    
    const chip = screen.getByRole('button');
    
    // Should be focusable
    expect(chip).toHaveAttribute('tabIndex', '0');
    
    // Should have proper role
    expect(chip).toHaveAttribute('role', 'button');
    
    // Should have descriptive aria-label
    expect(chip).toHaveAttribute('aria-label', 'Test Node');
    
    // Should have helpful title
    expect(chip).toHaveAttribute('title', 'Test Node - Click to view details');
  });
}); 