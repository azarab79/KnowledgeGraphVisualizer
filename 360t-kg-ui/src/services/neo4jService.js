import axios from 'axios';

// API base URL 
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// Service for interacting with our Neo4j backend
const neo4jService = {
    /**
     * Get initial graph data
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    getInitialGraph: async () => {
        try {
            const response = await axios.get(`${API_URL}/graph/initial`);
            return response.data;
        } catch (error) {
            console.error('Error fetching initial graph:', error);
            throw error;
        }
    },
    
    /**
     * Search for nodes by term
     * @param {string} term - The search term
     * @returns {Promise<{nodes: Array}>}
     */
    searchNodes: async (term) => {
        try {
            const response = await axios.get(`${API_URL}/graph/search`, {
                params: { term }
            });
            return response.data;
        } catch (error) {
            console.error('Error searching nodes:', error);
            throw error;
        }
    },
    
    /**
     * Expand a node to show its connections
     * @param {string} nodeId - The ID of the node to expand
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    expandNode: async (nodeId) => {
        try {
            const response = await axios.get(`${API_URL}/graph/expand`, {
                params: { nodeId }
            });
            return response.data;
        } catch (error) {
            console.error('Error expanding node:', error);
            throw error;
        }
    },
    
    /**
     * Filter graph data by node labels and relationship types
     * @param {Array<string>} nodeLabels - Array of node labels to include
     * @param {Array<string>} relationshipTypes - Array of relationship types to include
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    filterGraph: async (nodeLabels, relationshipTypes) => {
        try {
            const response = await axios.post(`${API_URL}/graph/filter`, {
                nodeLabels,
                relationshipTypes
            });
            return response.data;
        } catch (error) {
            console.error('Error filtering graph:', error);
            throw error;
        }
    },
    
    /**
     * Get metadata about available node labels and relationship types
     * @returns {Promise<{nodeLabels: Array, relationshipTypes: Array}>}
     */
    getMetadata: async () => {
        try {
            const response = await axios.get(`${API_URL}/metadata`);
            return response.data;
        } catch (error) {
            console.error('Error fetching metadata:', error);
            throw error;
        }
    },
    
    /**
     * Perform impact analysis on a node
     * @param {string} nodeId - The ID of the node to analyze
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    getImpactAnalysis: async (nodeId) => {
        try {
            const response = await axios.get(`${API_URL}/analysis/impact`, {
                params: { nodeId }
            });
            return response.data;
        } catch (error) {
            console.error('Error performing impact analysis:', error);
            throw error;
        }
    },
    
    /**
     * Get test coverage for a component
     * @param {string} nodeId - The ID of the node to analyze
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    getTestCoverage: async (nodeId) => {
        try {
            const response = await axios.get(`${API_URL}/analysis/test-coverage`, {
                params: { nodeId }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching test coverage:', error);
            throw error;
        }
    },
    
    /**
     * Get dependencies for a component
     * @param {string} nodeId - The ID of the node to analyze
     * @returns {Promise<{nodes: Array, edges: Array}>}
     */
    getDependencies: async (nodeId) => {
        try {
            const response = await axios.get(`${API_URL}/analysis/dependencies`, {
                params: { nodeId }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching dependencies:', error);
            throw error;
        }
    },
    
    /**
     * Get health status of the API
     * @returns {Promise<{status: string, timestamp: string}>}
     */
    checkHealth: async () => {
        try {
            const response = await axios.get(`${API_URL}/health`);
            return response.data;
        } catch (error) {
            console.error('Error checking API health:', error);
            throw error;
        }
    }
};

export default neo4jService; 