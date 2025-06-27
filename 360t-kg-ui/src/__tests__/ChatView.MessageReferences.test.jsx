import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithProviders } from './utils/renderWithProviders';
import ChatView from '../components/ChatView';
import mockChatApiService from '../services/chatApiService';

jest.mock('../services/chatApiService');

describe('ChatView MessageReferences Integration', () => {
  describe('First Message Icon Display Issue', () => {
    test('should always render MessageReferences for assistant messages, even with empty arrays', async () => {
      // This test specifically addresses the "first message" icon issue
      const messagesWithEmptyArrays = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Hi there!', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [], // Empty array - this was causing the bug
          sourceNodes: []       // Empty array - this was causing the bug
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithEmptyArrays },
          history: messagesWithEmptyArrays,
        }
      });

      // The MessageReferences component should be rendered even with empty arrays
      await waitFor(() => {
        // Look for the tab structure which indicates MessageReferences is rendered
        expect(screen.queryByRole('tablist')).toBeInTheDocument();
      });
    });

    test('should show empty state when no documents or nodes available', async () => {
      const messagesWithEmptyArrays = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Hi there!', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [],
          sourceNodes: []
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithEmptyArrays },
          history: messagesWithEmptyArrays,
        }
      });

      // MessageReferences should render but show no content since arrays are empty
      await waitFor(() => {
        // The component should not render tabs when both arrays are empty
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      });
    });

    test('should render tabs correctly when sourceDocuments exist', async () => {
      const messagesWithDocuments = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Hi there!', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [
            { 
              id: 'doc1', 
              title: 'Document 1', 
              full_text: 'Content of document 1',
              metadata: { page: 1 }
            }
          ],
          sourceNodes: []
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithDocuments },
          history: messagesWithDocuments,
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /nodes/i })).not.toBeInTheDocument();
      });
    });

    test('should render tabs correctly when sourceNodes exist', async () => {
      const messagesWithNodes = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Hi there!', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [],
          sourceNodes: [
            { 
              id: 'node1', 
              name: 'Risk Management System',
              labels: ['System'],
              properties: { type: 'system' }
            }
          ]
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithNodes },
          history: messagesWithNodes,
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /sources/i })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /nodes/i })).toBeInTheDocument();
      });
    });

    test('should render both tabs when both sourceDocuments and sourceNodes exist', async () => {
      const messagesWithBoth = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Hi there!', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [
            { 
              id: 'doc1', 
              title: 'Document 1', 
              full_text: 'Content of document 1',
              metadata: { page: 1 }
            }
          ],
          sourceNodes: [
            { 
              id: 'node1', 
              name: 'Risk Management System',
              labels: ['System'],
              properties: { type: 'system' }
            }
          ]
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithBoth },
          history: messagesWithBoth,
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /nodes/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
      });
    });

    test('should never render MessageReferences for user messages', async () => {
      const userOnlyMessages = [
        { 
          role: 'user', 
          content: 'Hello', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [{ id: 'doc1', title: 'Document 1', full_text: 'Content' }],
          sourceNodes: [{ id: 'node1', name: 'Node 1', labels: ['System'] }]
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: userOnlyMessages },
          history: userOnlyMessages,
        }
      });

      await waitFor(() => {
        // No tabs should be rendered for user messages
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      });
    });
  });

  describe('Node Selection Flow', () => {
    test('should handle node selection correctly', async () => {
      const onNodeSelectMock = jest.fn();
      const messagesWithNodes = [
        { 
          role: 'assistant', 
          content: 'Here are some nodes', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [],
          sourceNodes: [
            { 
              id: 'node1', 
              name: 'Risk Management System',
              labels: ['System'],
              properties: { type: 'system' }
            }
          ]
        }
      ];

      renderWithProviders(<ChatView onNodeSelect={onNodeSelectMock} />, {
        initialChatState: {
          currentConversation: { id: '1', history: messagesWithNodes },
          history: messagesWithNodes,
        }
      });

      await waitFor(() => {
        const nodeChip = screen.getByRole('button', { name: /Risk Management System/i });
        fireEvent.click(nodeChip);
        expect(onNodeSelectMock).toHaveBeenCalledWith({
          id: 'node1', 
          name: 'Risk Management System',
          labels: ['System'],
          properties: { type: 'system' }
        });
      });
    });
  });

  describe('Multi-step Message Verification', () => {
    test('should maintain consistent behavior across multiple assistant messages', async () => {
      const multipleMessages = [
        { 
          role: 'user', 
          content: 'First question', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'First answer', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [],
          sourceNodes: [] // First message with empty arrays
        },
        { 
          role: 'user', 
          content: 'Second question', 
          timestamp: new Date().toISOString() 
        },
        { 
          role: 'assistant', 
          content: 'Second answer', 
          timestamp: new Date().toISOString(),
          sourceDocuments: [{ id: 'doc1', title: 'Doc1', full_text: 'Content' }],
          sourceNodes: [{ id: 'node1', name: 'Node1', labels: ['System'] }]
        }
      ];

      renderWithProviders(<ChatView />, {
        initialChatState: {
          currentConversation: { id: '1', history: multipleMessages },
          history: multipleMessages,
        }
      });

      await waitFor(() => {
        // Should have tabs for the second message that has content
        const tablists = screen.getAllByRole('tablist');
        expect(tablists).toHaveLength(1); // Only one message has actual content to show tabs
      });
    });
  });
}); 