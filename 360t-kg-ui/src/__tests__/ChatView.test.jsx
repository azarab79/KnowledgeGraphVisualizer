import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithProviders } from './utils/renderWithProviders';
import ChatView from '../components/ChatView';
import mockChatApiService from '../services/chatApiService';

jest.mock('../services/chatApiService');

describe('ChatView', () => {
  const initialConversations = [
    { id: '1', name: 'Conversation 1', timestamp: new Date().toISOString(), history: [] },
  ];

  const initialMessages = [
    { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatApiService.getConversations.mockResolvedValue(initialConversations);
    mockChatApiService.getConversation.mockResolvedValue({ id: '1', history: initialMessages });
    mockChatApiService.createConversation.mockResolvedValue({ id: '2', name: 'New Conversation', history: [] });
    mockChatApiService.sendMessage.mockResolvedValue({ updatedHistory: [...initialMessages, { role: 'user', content: 'New message' }] });
  });

  describe('Rendering and Initialization', () => {
    test('renders ChatView and loads conversations', async () => {
      renderWithProviders(<ChatView />);
      await waitFor(() => {
        expect(screen.getByText('Conversation 1')).toBeInTheDocument();
      });
    });

    test('displays messages with correct roles', async () => {
      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: initialMessages },
          history: initialMessages,
        }
      });
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction', () => {
    test('sends a message and updates history', async () => {
      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: initialMessages },
          history: initialMessages,
        }
      });

      const input = screen.getByPlaceholderText(/Ask me anything about the knowledge graph/i);
      fireEvent.change(input, { target: { value: 'New message' } });
      fireEvent.submit(input.closest('form'));

      await waitFor(() => {
        expect(mockChatApiService.sendMessage).toHaveBeenCalledWith('1', 'New message');
      });
    });

    test('creates a new conversation', async () => {
      renderWithProviders(<ChatView />);
      const newChatButton = screen.getByRole('button', { name: /New Chat/i });
      fireEvent.click(newChatButton);

      await waitFor(() => {
        expect(mockChatApiService.createConversation).toHaveBeenCalled();
        expect(screen.getByText('New Conversation')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error when conversation list fails to load', async () => {
      mockChatApiService.getConversations.mockRejectedValue(new Error('Failed to load'));
      renderWithProviders(<ChatView />);
      await waitFor(() => {
        expect(screen.getByText(/Failed to load conversation list/i)).toBeInTheDocument();
      });
    });

    test('displays error when send message fails', async () => {
      mockChatApiService.sendMessage.mockRejectedValue(new Error('Send failed'));
      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: initialMessages },
          history: initialMessages,
        }
      });

      const input = screen.getByPlaceholderText(/Ask me anything about the knowledge graph/i);
      fireEvent.change(input, { target: { value: 'A message that will fail' } });
      fireEvent.submit(input.closest('form'));
      
      await waitFor(() => {
        expect(screen.getByText(/Error: Send failed/i)).toBeInTheDocument();
      });
    });
  });
}); 