import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from './utils/renderWithProviders';
import Header from '../components/Header';

/**
 * Unit tests for the Header component to verify the Dashboard button has been
 * removed and navigation events still function as expected.
 */
describe('Header navigation', () => {
  const setup = (view = 'explorer') => {
    const onSwitchView = jest.fn();
    renderWithProviders(
      <Header currentView={view} onSwitchView={onSwitchView} />
    );
    return { onSwitchView };
  };

  it('does not render a Dashboard nav button', () => {
    setup();
    const dashboardButton = screen.queryByRole('button', { name: /dashboard/i });
    expect(dashboardButton).toBeNull();
  });

  it('renders expected navigation buttons', () => {
    setup();
    ['Explorer', 'Analysis', 'Chat', 'Documentation'].forEach(label => {
      expect(
        screen.getByRole('button', { name: new RegExp(label, 'i') })
      ).toBeInTheDocument();
    });
  });

  it('calls onSwitchView when Explorer button is clicked', () => {
    const { onSwitchView } = setup();
    const explorerBtn = screen.getByRole('button', { name: /explorer/i });
    fireEvent.click(explorerBtn);
    expect(onSwitchView).toHaveBeenCalledWith('explorer');
  });
}); 