jest.mock('../services/api', () => ({
  getInitialGraph: jest.fn(() => Promise.resolve({ nodes: [], links: [] })),
  getRelationships: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  runImpactAnalysis: jest.fn(),
  runDependencyAnalysis: jest.fn(),
  findPaths: jest.fn(),
  runCentralityAnalysis: jest.fn(),
  searchNodes: jest.fn(),
}));

// Mock the chat API service
jest.mock('../services/chatApiService', () => ({
  getConversations: jest.fn(() => Promise.resolve([])),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  saveConversation: jest.fn(),
}));

import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './utils/renderWithProviders';
import App from '../App';

describe('App integration', () => {
  it('renders without crashing and handles loadInitialGraph event', async () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: /Explorer/i })).toBeInTheDocument();

    // Simulate loadInitialGraph event
    window.dispatchEvent(new Event('loadInitialGraph'));

    // Should show loading or placeholder without errors
    expect(screen.getByText(/Loading graph data/i) || screen.getByText(/Search for a node/i)).toBeTruthy();
  });
});
