import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import NodeChip from '../components/NodeChip';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock node data
const mockNode = {
  id: 'test-node-123',
  name: 'Test Node',
  labels: ['TestType', 'ExampleLabel']
};

describe('NodeChip Accessibility', () => {
  beforeEach(() => {
    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be accessible and have no axe violations', async () => {
    const { container } = render(
      <NodeChip 
        node={mockNode} 
        onSelect={jest.fn()} 
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be accessible without onSelect handler', async () => {
    const { container } = render(
      <NodeChip node={mockNode} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be accessible with minimal node data', async () => {
    const minimalNode = {
      id: 'minimal-123'
    };

    const { container } = render(
      <NodeChip node={minimalNode} onSelect={jest.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be accessible with tooltip visible', async () => {
    const { container } = render(
      <NodeChip node={mockNode} onSelect={jest.fn()} />
    );

    // Simulate hover to show tooltip
    const chip = container.querySelector('.node-chip');
    chip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
}); 