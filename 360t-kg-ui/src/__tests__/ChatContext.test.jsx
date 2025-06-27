import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatProvider, useChatState, useChatActions, useChatSelectors } from '../contexts/ChatContext';

// Mock the chat API service
jest.mock('../services/chatApiService', () => ({
  getConversations: jest.fn(),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  saveConversation: jest.fn(),
}));

// Mock window.location for tests
const mockLocation = {
  search: '',
  href: 'http://localhost:3000',
  toString: () => 'http://localhost:3000'
};

const mockHistory = {
  replaceState: jest.fn(),
  pushState: jest.fn(),
};

// Global setup for URL mocking
beforeAll(() => {
  delete window.location;
  window.location = mockLocation;
  window.history = mockHistory;
});

// Mock component to test hooks
const TestComponent = ({ testAction }) => {
  const state = useChatState();
  const actions = useChatActions();
  const selectors = useChatSelectors();
  const [messageSent, setMessageSent] = React.useState(false);

  React.useEffect(() => {
    if (testAction === 'loadConversations') {
      actions.loadConversations();
    } else if (testAction === 'createNew') {
      actions.createNewConversation();
    }
  }, [testAction, actions]);

  // Separate effect for sending messages - only send once
  React.useEffect(() => {
    if (testAction === 'sendMessage' && state.currentConversation && state.conversationsLoaded && !messageSent) {
      setMessageSent(true);
      actions.sendMessage('Test message');
    }
  }, [testAction, state.currentConversation, state.conversationsLoaded, messageSent, actions]);

  return (
    <div>
      <div data-testid="loading">{state.isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error">{state.error || 'No Error'}</div>
      <div data-testid="conversations-count">{state.conversations.length}</div>
      <div data-testid="current-conversation">{state.currentConversation?.name || 'None'}</div>
      <div data-testid="messages-count">{state.history.length}</div>
      <div data-testid="has-messages">{selectors.getHasMessages() ? 'Yes' : 'No'}</div>
      <div data-testid="conversations-loaded">{state.conversationsLoaded ? 'Yes' : 'No'}</div>
    </div>
  );
};

describe('ChatContext', () => {
  let mockChatApiService;

  beforeAll(async () => {
    // Import the mocked service after setting up the mock
    mockChatApiService = await import('../services/chatApiService');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHistory.replaceState.mockClear();
    mockHistory.pushState.mockClear();
    
    // Reset location
    mockLocation.search = '';
    mockLocation.href = 'http://localhost:3000';
    
    // Reset all mock implementations
    mockChatApiService.getConversations.mockResolvedValue([]);
    mockChatApiService.getConversation.mockResolvedValue({ id: 'test-id', name: 'Test Chat', history: [] });
    mockChatApiService.createConversation.mockResolvedValue({ id: 'new-id', name: 'New Chat', history: [] });
    mockChatApiService.deleteConversation.mockResolvedValue({ message: 'Deleted' });
    mockChatApiService.sendMessage.mockResolvedValue({ 
      updatedHistory: [
        { role: 'user', content: 'Test message', timestamp: '2023-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Response', timestamp: '2023-01-01T00:00:01Z' }
      ]
    });
    mockChatApiService.saveConversation.mockResolvedValue({ message: 'Saved' });
  });

  describe('Provider and Hooks', () => {
    test('provides initial state correctly', async () => {
      // Mock empty conversations to prevent auto-initialization
      mockChatApiService.getConversations.mockResolvedValue([]);
      mockChatApiService.createConversation.mockResolvedValue({ id: 'new-id', name: 'New Chat', history: [] });
      
      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      expect(screen.getByTestId('error')).toHaveTextContent('No Error');
      // When no conversations exist, one is auto-created
      expect(screen.getByTestId('conversations-count')).toHaveTextContent('1');
      expect(screen.getByTestId('current-conversation')).toHaveTextContent('New Chat');
      expect(screen.getByTestId('messages-count')).toHaveTextContent('0');
      expect(screen.getByTestId('has-messages')).toHaveTextContent('No');
    });

    test('throws error when hooks used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useChatState must be used within a ChatProvider');

      console.error = originalError;
    });
  });

  describe('Conversation Management', () => {
    test('loads conversations on initialization', async () => {
      const mockConversations = [
        { id: '1', name: 'Chat 1', history: [] },
        { id: '2', name: 'Chat 2', history: [] }
      ];
      
      mockChatApiService.getConversations.mockResolvedValue(mockConversations);
      mockChatApiService.getConversation.mockResolvedValue(mockConversations[0]);

      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      expect(screen.getByTestId('conversations-count')).toHaveTextContent('2');
      expect(mockChatApiService.getConversations).toHaveBeenCalledTimes(1);
    });

    test('creates new conversation when none exist', async () => {
      const newConversation = { id: 'new-id', name: 'New Chat', history: [] };
      
      mockChatApiService.getConversations.mockResolvedValue([]);
      mockChatApiService.createConversation.mockResolvedValue(newConversation);

      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-conversation')).toHaveTextContent('New Chat');
      });

      expect(mockChatApiService.createConversation).toHaveBeenCalledWith('New Chat');
    });

    test('handles conversation loading errors', async () => {
      mockChatApiService.getConversations.mockRejectedValue(new Error('Network error'));

      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load conversation list.');
      });
    });

    test('creates new conversation manually', async () => {
      const newConversation = { id: 'manual-new', name: 'New Chat', history: [] };
      mockChatApiService.getConversations.mockResolvedValue([]);
      mockChatApiService.createConversation.mockResolvedValue(newConversation);

      render(
        <ChatProvider>
          <TestComponent testAction="createNew" />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-conversation')).toHaveTextContent('New Chat');
      });

      expect(mockChatApiService.createConversation).toHaveBeenCalledWith('New Chat');
    });
  });

  describe('Message Management', () => {
    test('sends message successfully', async () => {
      const conversation = { id: 'test-conv', name: 'Test Chat', history: [] };
      const responseHistory = [
        { role: 'user', content: 'Test message', timestamp: '2023-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Response', timestamp: '2023-01-01T00:00:01Z' }
      ];

      mockChatApiService.getConversations.mockResolvedValue([conversation]);
      mockChatApiService.getConversation.mockResolvedValue(conversation);
      mockChatApiService.sendMessage.mockResolvedValue({ updatedHistory: responseHistory });

      render(
        <ChatProvider>
          <TestComponent testAction="sendMessage" />
        </ChatProvider>
      );

      // Wait for conversation to load first
      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      // Wait for message to be processed
      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
      });

      expect(mockChatApiService.sendMessage).toHaveBeenCalledWith('Test message', expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'Test message'
        })
      ]));
    });

    test('handles message sending errors', async () => {
      const conversation = { id: 'test-conv', name: 'Test Chat', history: [] };
      
      mockChatApiService.getConversations.mockResolvedValue([conversation]);
      mockChatApiService.getConversation.mockResolvedValue(conversation);
      mockChatApiService.sendMessage.mockRejectedValue(new Error('Send failed'));

      render(
        <ChatProvider>
          <TestComponent testAction="sendMessage" />
        </ChatProvider>
      );

      // Wait for conversation to load
      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Send failed');
      });

      // Should have the user message plus error message
      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Selectors', () => {
    test('provides correct computed values', async () => {
      const conversation = { id: 'test-conv', name: 'Test Chat', history: [
        { role: 'user', content: 'Hello', timestamp: '2023-01-01T00:00:00Z' }
      ]};
      
      mockChatApiService.getConversations.mockResolvedValue([conversation]);
      mockChatApiService.getConversation.mockResolvedValue(conversation);

      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('has-messages')).toHaveTextContent('Yes');
      });

      expect(screen.getByTestId('messages-count')).toHaveTextContent('1');
      expect(screen.getByTestId('current-conversation')).toHaveTextContent('Test Chat');
    });
  });

  describe('Error Handling', () => {
    test('clears errors correctly', async () => {
      mockChatApiService.getConversations.mockRejectedValue(new Error('Test error'));

      const TestErrorClear = () => {
        const state = useChatState();
        const actions = useChatActions();

        return (
          <div>
            <div data-testid="error">{state.error || 'No Error'}</div>
            <button onClick={actions.clearError}>Clear Error</button>
          </div>
        );
      };

      render(
        <ChatProvider>
          <TestErrorClear />
        </ChatProvider>
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load conversation list.');
      });

      // Clear the error
      fireEvent.click(screen.getByText('Clear Error'));

      expect(screen.getByTestId('error')).toHaveTextContent('No Error');
    });
  });

  describe('URL Deep-linking', () => {
    test('handles URL parameters on initialization', async () => {
      const conversations = [
        { id: 'url-chat', name: 'URL Chat', history: [] }
      ];
      const targetConversation = { id: 'url-chat', name: 'URL Chat', history: [] };

      // Mock URL search params
      mockLocation.search = '?chatId=url-chat';
      mockLocation.href = 'http://localhost:3000?chatId=url-chat';

      mockChatApiService.getConversations.mockResolvedValue(conversations);
      mockChatApiService.getConversation.mockResolvedValue(targetConversation);

      render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-conversation')).toHaveTextContent('URL Chat');
      });

      expect(mockChatApiService.getConversation).toHaveBeenCalledWith('url-chat');
    });
  });

  describe('React 18 StrictMode Protection', () => {
    test('prevents double initialization', async () => {
      const conversations = [{ id: 'test', name: 'Test', history: [] }];
      mockChatApiService.getConversations.mockResolvedValue(conversations);
      mockChatApiService.getConversation.mockResolvedValue(conversations[0]);

      // Render twice to simulate StrictMode behavior
      const { rerender } = render(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      rerender(
        <ChatProvider>
          <TestComponent />
        </ChatProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('conversations-loaded')).toHaveTextContent('Yes');
      });

      // Should only be called once despite double render
      expect(mockChatApiService.getConversations).toHaveBeenCalledTimes(1);
    });
  });
}); 