/* eslint-env jest */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ColorPickerModal from '../components/ColorPickerModal';

describe('ColorPickerModal', () => {
  const createProps = (overrides = {}) => ({
    type: 'Module',
    isNodeType: true,
    initialColor: '#123456',
    initialSize: 25,
    initialShape: 'circle',
    onApply: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with initial values', () => {
    const props = createProps();
    render(<ColorPickerModal {...props} />);
    expect(screen.getByText(/Customize Module/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/i).value).toBe('#123456');
    expect(screen.getByLabelText(/Size/i).value).toBe('25');
  });

  it('calls onClose when Cancel button is clicked', () => {
    const props = createProps();
    render(<ColorPickerModal {...props} />);
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onApply with correct data when Apply button is clicked', () => {
    const props = createProps();
    render(<ColorPickerModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Color/i), { target: { value: '#654321' } });
    fireEvent.change(screen.getByLabelText(/Size/i), { target: { value: '30' } });
    fireEvent.click(screen.getByText(/Apply/i));
    expect(props.onApply).toHaveBeenCalledWith('Module', {
      color: '#654321',
      size: 30,
      shape: 'circle',
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders without crashing for relationship type (isNodeType=false)', () => {
    const props = createProps({ isNodeType: false });
    render(<ColorPickerModal {...props} />);
    expect(screen.getByText(/Customize Module/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Size/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Shape/i)).not.toBeInTheDocument();
  });
});
