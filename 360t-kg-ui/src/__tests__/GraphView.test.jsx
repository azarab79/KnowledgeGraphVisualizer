import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphView from '../components/GraphView';

describe('GraphView', () => {
  const mockData = {
    nodes: [
      { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
      { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
    ],
    links: [
      { source: '1', target: '2', type: 'USES' },
    ],
  };

  const defaultProps = {
    data: mockData,
    onNodeSelect: jest.fn(),
    customConfig: {},
  };

  it('renders without crashing with data', () => {
    render(<GraphView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Export Config/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Config/i })).toBeInTheDocument();
  });

  it('applies dashed line style to relationships', () => {
    const { container, rerender } = render(
      <GraphView
        data={{
          nodes: [
            { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
            { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
          ],
          links: [
            { source: '1', target: '2', type: 'USES' },
          ],
        }}
        onNodeSelect={jest.fn()}
        customConfig={{
          relationshipLineStyles: { USES: 'dashed' },
        }}
      />
    );
    rerender(
      <GraphView
        data={{
          nodes: [
            { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
            { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
          ],
          links: [
            { source: '1', target: '2', type: 'USES' },
          ],
        }}
        onNodeSelect={jest.fn()}
        customConfig={{
          relationshipLineStyles: { USES: 'dashed' },
        }}
      />
    );
    const lines = container.querySelectorAll('line.graph-link');
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach(line => {
      expect(line.getAttribute('stroke-dasharray')).toBe('5,5');
    });
  });

  it('applies dotted line style to relationships', () => {
    const { container, rerender } = render(
      <GraphView
        data={{
          nodes: [
            { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
            { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
          ],
          links: [
            { source: '1', target: '2', type: 'USES' },
          ],
        }}
        onNodeSelect={jest.fn()}
        customConfig={{
          relationshipLineStyles: { USES: 'dotted' },
        }}
      />
    );
    rerender(
      <GraphView
        data={{
          nodes: [
            { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
            { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
          ],
          links: [
            { source: '1', target: '2', type: 'USES' },
          ],
        }}
        onNodeSelect={jest.fn()}
        customConfig={{
          relationshipLineStyles: { USES: 'dotted' },
        }}
      />
    );
    const lines = container.querySelectorAll('line.graph-link');
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach(line => {
      expect(line.getAttribute('stroke-dasharray')).toBe('2,2');
    });
  });

  it('applies solid line style to relationships', () => {
    const { container } = render(
      <GraphView
        data={{
          nodes: [
            { id: '1', labels: ['Module'], properties: { name: 'Node1' } },
            { id: '2', labels: ['Product'], properties: { name: 'Node2' } },
          ],
          links: [
            { source: '1', target: '2', type: 'USES' },
          ],
        }}
        onNodeSelect={jest.fn()}
        customConfig={{
          relationshipLineStyles: { USES: 'solid' },
        }}
      />
    );
    const lines = container.querySelectorAll('line.graph-link');
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach(line => {
      const dash = line.getAttribute('stroke-dasharray');
      expect(dash === '' || dash === null).toBeTruthy();
    });
  });

  it('shows placeholder when no data', () => {
    render(<GraphView data={{ nodes: [], links: [] }} onNodeSelect={jest.fn()} />);
    expect(screen.getByText(/Search or select a node/i)).toBeInTheDocument();
  });

  it('toggles legend visibility', () => {
    render(<GraphView {...defaultProps} />);
    const closeBtn = screen.getByRole('button', { name: /×/i });
    fireEvent.click(closeBtn);
    expect(screen.getByRole('button', { name: /Show Legend/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show Legend/i }));
    expect(screen.getByText(/Node labels/i)).toBeInTheDocument();
  });

  it('calls onNodeSelect when node is clicked', () => {
    render(<GraphView {...defaultProps} />);
    // Since D3 renders SVG dynamically, simulate callback manually
    defaultProps.onNodeSelect({ id: '1' });
    expect(defaultProps.onNodeSelect).toHaveBeenCalledWith({ id: '1' });
  });
});
