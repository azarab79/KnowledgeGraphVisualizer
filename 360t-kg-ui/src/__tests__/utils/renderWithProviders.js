import React from 'react';
import { render } from '@testing-library/react';
import { ChatProvider } from '../../contexts/ChatContext';

/**
 * Test utility to render components with all necessary providers
 * This ensures components have access to ChatContext during testing
 * 
 * @param {React.ReactElement} ui - The component to render
 * @param {Object} options - Additional render options
 * @param {Object} options.initialChatState - Initial state for ChatContext (optional)
 * @returns {Object} - Testing Library render result
 */
export const renderWithProviders = (ui, options = {}) => {
  const {
    ...renderOptions
  } = options;

  // Wrapper component that provides all necessary contexts
  const Wrapper = ({ children }) => {
    return (
      <ChatProvider>
        {children}
      </ChatProvider>
    );
  };

  // Return render result with provider wrapper
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Re-export everything from @testing-library/react for convenience
 * This allows tests to import everything from this single file
 */
export * from '@testing-library/react';

// Override render to use our provider wrapper by default
export { renderWithProviders as render }; 