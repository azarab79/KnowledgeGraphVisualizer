const neo4j = require('neo4j-driver');
const express = require('express');
const { hiddenLinksQueryValidation } = require('../middleware/validation');

// Analysis routes using GraphRepository
module.exports = (graphRepo) => {
    const router = express.Router();
    
    // Helper for legacy endpoints
    const getSession = () => graphRepo.getSession();

    // Centrality analysis
    // Calculate node centrality metrics
    router.get('/centrality', async (req, res, next) => {
        const type = req.query.type || 'degree';
        const limit = parseInt(req.query.limit || '20', 10);
        
        try {
            const result = await graphRepo.getCentrality(type, neo4j.int(limit));
            res.json(result);
        } catch (error) {
            console.error('Centrality analysis error:', error);
            next(error);
        }
    });

    // --- New Community Clusters endpoint (Louvain) ---
    router.get('/clusters', async (req, res, next) => {
        const resolution = parseFloat(req.query.resolution || '1.0');
        const subGraph = req.query.subGraph || null;

        try {
            const result = await graphRepo.runLouvain(resolution, subGraph);
            res.json(result);
        } catch (error) {
            console.error('Clusters analysis error:', error);
            next(error);
        }
    });

    // --- Hidden Links endpoint (Node2Vec + Link Prediction) with validation & caching ---
    router.get('/hidden-links', hiddenLinksQueryValidation, async (req, res, next) => {
        const topN = parseInt(req.query.topN || '20', 10);
        const threshold = parseFloat(req.query.threshold || '0.4');

        try {
            const result = await graphRepo.predictLinks(topN, threshold);
            // 5-minute cache to reduce heavy GDS load
            res.set('Cache-Control', 'public, max-age=300');
            res.json(result);
        } catch (error) {
            console.error('Hidden links analysis error:', error);
            // Ensure a detailed error is sent back for easier debugging
            res.status(500).json({
              error: {
                message: error.message,
                stack: error.stack,
              },
            });
        }
    });

    return router;
}; 