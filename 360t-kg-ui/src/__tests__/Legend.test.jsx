import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Legend from '../components/Legend';

describe('Legend', () => {
  const mockData = {
    nodes: [
      { id: '1', labels: ['Module'] },
      { id: '2', labels: ['Product'] },
    ],
    links: [
      { source: '1', target: '2', type: 'USES' },
    ],
  };

  const defaultProps = {
    data: mockData,
    initialConfig: {},
    onNodeConfigChange: jest.fn(),
    onClose: jest.fn(),
  };

  it('renders node and relationship badges', () => {
    render(<Legend {...defaultProps} />);
    expect(screen.getByText(/Module/i)).toBeInTheDocument();
    expect(screen.getByText(/Product/i)).toBeInTheDocument();
    expect(screen.getByText(/USES/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<Legend {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /×/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('opens ColorPickerModal when node badge is clicked', () => {
    render(<Legend {...defaultProps} />);
    fireEvent.click(screen.getByText(/Module/i));
    expect(screen.getByText(/Customize Module/i)).toBeInTheDocument();
  });

  it('opens ColorPickerModal when relationship badge is clicked', () => {
    render(<Legend {...defaultProps} />);
    fireEvent.click(screen.getByText(/USES/i));
    expect(screen.getByText(/Customize USES/i)).toBeInTheDocument();
  });

  it('calls onNodeConfigChange when modal applies changes', () => {
    render(<Legend {...defaultProps} />);
    fireEvent.click(screen.getByText(/Module/i));
    const applyButton = screen.getByText(/Apply/i);
    fireEvent.click(applyButton);
    expect(defaultProps.onNodeConfigChange).toHaveBeenCalled();
  });
});
