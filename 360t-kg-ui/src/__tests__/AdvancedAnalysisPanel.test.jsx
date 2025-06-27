import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdvancedAnalysisPanel from '../components/AdvancedAnalysisPanel';
import * as api from '../services/analysisApi';

jest.mock('../services/analysisApi');

const mockResponse = {
  modularity: 0.45,
  communityCount: 3,
  nodes: [],
  edges: [],
  communities: []
};

describe('AdvancedAnalysisPanel', () => {
  it('runs cluster analysis and shows summary', async () => {
    api.fetchClusters.mockResolvedValue(mockResponse);
    render(<AdvancedAnalysisPanel />);

    const runBtn = screen.getByRole('button', { name: /run/i });
    fireEvent.click(runBtn);

    expect(api.fetchClusters).toHaveBeenCalled();
    // Wait for summary text
    const summary = await screen.findByText(/Modularity/i);
    expect(summary).toBeInTheDocument();
  });
}); 