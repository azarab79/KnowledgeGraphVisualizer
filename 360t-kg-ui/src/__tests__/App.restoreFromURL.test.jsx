import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils/renderWithProviders';
import App from '../App';

// Mock API services as in other App tests
jest.mock('../services/api', () => ({
  getInitialGraph: jest.fn(() => Promise.resolve({ nodes: [], links: [] })),
  getRelationships: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  runImpactAnalysis: jest.fn(),
  runDependencyAnalysis: jest.fn(),
  findPaths: jest.fn(),
  runCentralityAnalysis: jest.fn(),
  searchNodes: jest.fn(),
}));

jest.mock('../services/chatApiService', () => ({
  getConversations: jest.fn(() => Promise.resolve([])),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  saveConversation: jest.fn(),
}));

describe('URL restoration fallback', () => {
  it('falls back to Explorer when ?view=dashboard is present', async () => {
    window.history.pushState({}, '', '/?view=dashboard');
    renderWithProviders(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /explorer/i })
      ).toHaveClass('active');
    });
  });
}); 