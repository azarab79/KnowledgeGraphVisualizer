import axios from 'axios';

// Community Clusters (Louvain)
export const fetchClusters = async ({ resolution = 1.0, subGraph } = {}) => {
  const { data } = await axios.get('/api/analysis/clusters', {
    params: { resolution, subGraph },
  });
  return data;
};

// Hidden Links (Link Prediction)
export const fetchHiddenLinks = async ({ topN = 20, threshold = 0.4 } = {}) => {
  const { data } = await axios.get('/api/analysis/hidden-links', {
    params: { topN, threshold },
  });
  return data;
};

// Criticality (PageRank + Betweenness)
export const fetchCriticality = async ({ topN = 50 } = {}) => {
  const { data } = await axios.get('/api/analysis/centrality', {
    params: { type: 'pagerank', topN },
  });
  return data;
}; 