const express = require('express');
const router = express.Router();

// Helper to determine node label from its properties
const getLabel = (properties, nodeLabels = []) => {
    // For Document nodes, return empty label since text snippets are too long
    if (nodeLabels && nodeLabels.includes('Document')) {
        return '';
    }
    
    // A better fallback for labels, considering the new schema.
    if (properties.name) return properties.name;
    if (properties.test_case_id) return properties.test_case_id;

    // Use 'id' if it's a descriptive string and not a UUID.
    if (properties.id && typeof properties.id === 'string' && !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(properties.id)) {
        return properties.id;
    }

    // Use a snippet of 'text' if it exists.
    if (properties.text) {
        const snippet = properties.text.substring(0, 50);
        return properties.text.length > 50 ? `${snippet}...` : snippet;
    }

    return 'Unnamed';
};

// Graph routes will require access to the Neo4j driver
module.exports = (driver) => {
    // Use the database specified via environment variable (defaults to 'neo4j')
    const neo4jDatabase = process.env.NEO4J_DATABASE || 'neo4j';

    // Helper for creating sessions that automatically target the configured database
    const getSession = () => driver.session({ database: neo4jDatabase });

    // Get initial graph data
    router.get('/initial', async (req, res, next) => {
        const session = getSession();
        try {
            const result = await session.run(`
                MATCH (n)-[r]->(m)
                WHERE (NOT 'Document' IN labels(n) AND NOT 'Document' IN labels(m))
                  AND NOT type(r) = 'MENTIONS'
                RETURN n, r, m
                LIMIT 2500
            `);
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = [];
            
            result.records.forEach(record => {
                const sourceNode = record.get('n');
                const targetNode = record.get('m');
                const relationship = record.get('r');
                
                // Process source node
                if (!nodes.has(sourceNode.identity.toString())) {
                    const nodeProps = sourceNode.properties;
                    const nodeLabel = sourceNode.labels[0];
                    const displayLabel = getLabel(nodeProps, sourceNode.labels);
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        labels: sourceNode.labels,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    const displayLabel = getLabel(nodeProps, targetNode.labels);
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        labels: targetNode.labels,
                        properties: nodeProps
                    });
                }
                
                // Process relationship
                edges.push({
                    id: relationship.identity.toString(),
                    from: sourceNode.identity.toString(),
                    to: targetNode.identity.toString(),
                    label: relationship.type,
                    arrows: 'to',
                    title: relationship.type,
                    properties: relationship.properties
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: edges
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Search nodes by name or properties
    router.get('/search', async (req, res, next) => {
        const term = req.query.term;
        if (!term) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        
        const session = getSession();
        try {
            const result = await session.run(`
                MATCH (n) 
                WHERE (n.name IS NOT NULL AND toLower(n.name) CONTAINS toLower($term))
                   OR (n.test_case_id IS NOT NULL AND toLower(n.test_case_id) CONTAINS toLower($term))
                   OR (n.id IS NOT NULL AND toLower(n.id) CONTAINS toLower($term))
                   OR (n.text IS NOT NULL AND toLower(n.text) CONTAINS toLower($term))
                RETURN n
                LIMIT 20
            `, { term });
            
            const nodes = [];
            
            result.records.forEach(record => {
                const node = record.get('n');
                const nodeProps = node.properties;
                const nodeLabel = node.labels[0];
                const displayLabel = getLabel(nodeProps, node.labels);
                
                nodes.push({
                    id: node.identity.toString(),
                    label: displayLabel,
                    title: `${nodeLabel}: ${displayLabel}`,
                    group: nodeLabel,
                    properties: nodeProps
                });
            });
            
            res.json({ nodes });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Expand a node (get connected nodes)
    router.get('/expand', async (req, res, next) => {
        const nodeId = req.query.nodeId;
        if (!nodeId) {
            return res.status(400).json({ error: 'Node ID is required' });
        }
        
        const session = getSession();
        try {
            const result = await session.run(`
                MATCH (n)-[r]-(m)
                WHERE (id(n) = toInteger($nodeId) OR n.name = $nodeId OR n.id = $nodeId)
                RETURN n, r, m
                LIMIT 100
            `, { nodeId });
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = [];
            
            result.records.forEach(record => {
                const sourceNode = record.get('n');
                const targetNode = record.get('m');
                const relationship = record.get('r');
                
                // Determine direction
                let from, to;
                if (relationship.startNodeElementId === sourceNode.elementId) {
                    from = sourceNode.identity.toString();
                    to = targetNode.identity.toString();
                } else {
                    from = targetNode.identity.toString();
                    to = sourceNode.identity.toString();
                }
                
                // Process source node
                if (!nodes.has(sourceNode.identity.toString())) {
                    const nodeProps = sourceNode.properties;
                    const nodeLabel = sourceNode.labels[0];
                    const displayLabel = getLabel(nodeProps, sourceNode.labels);
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    const displayLabel = getLabel(nodeProps, targetNode.labels);
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process relationship
                edges.push({
                    id: relationship.identity.toString(),
                    from,
                    to,
                    label: relationship.type,
                    arrows: 'to',
                    title: relationship.type,
                    properties: relationship.properties
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: edges
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Get filtered graph data
    router.post('/filter', async (req, res, next) => {
        const { nodeLabels = [], relationshipTypes = [] } = req.body;
        
        const session = getSession();
        try {
            let query = `
                MATCH (n)-[r]->(m)
                WHERE 1=1
            `;
            
            const params = {};
            
            if (nodeLabels.length > 0) {
                query += `
                    AND labels(n)[0] IN $nodeLabels
                    AND labels(m)[0] IN $nodeLabels
                `;
                params.nodeLabels = nodeLabels;
            }
            
            if (relationshipTypes.length > 0) {
                query += `
                    AND type(r) IN $relationshipTypes
                `;
                params.relationshipTypes = relationshipTypes;
            }
            
            query += `
                RETURN n, r, m
                LIMIT 100
            `;
            
            const result = await session.run(query, params);
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = [];
            
            result.records.forEach(record => {
                const sourceNode = record.get('n');
                const targetNode = record.get('m');
                const relationship = record.get('r');
                
                // Process source node
                if (!nodes.has(sourceNode.identity.toString())) {
                    const nodeProps = sourceNode.properties;
                    const nodeLabel = sourceNode.labels[0];
                    const displayLabel = getLabel(nodeProps, sourceNode.labels);
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    const displayLabel = getLabel(nodeProps, targetNode.labels);
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: displayLabel,
                        title: `${nodeLabel}: ${displayLabel}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process relationship
                edges.push({
                    id: relationship.identity.toString(),
                    from: sourceNode.identity.toString(),
                    to: targetNode.identity.toString(),
                    label: relationship.type,
                    arrows: 'to',
                    title: relationship.type,
                    properties: relationship.properties
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: edges
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Execute arbitrary Cypher query (for Python proxy)
    router.post('/query', async (req, res) => {
        try {
            const { query, parameters = {} } = req.body;
            
            if (!query) {
                return res.status(400).json({ error: 'Query is required' });
            }
            
            console.log('Executing Cypher query:', query);
            console.log('Parameters:', parameters);
            
            const session = getSession();
            const result = await session.run(query, parameters);
            
            // Convert Neo4j result to a format compatible with Python
            const data = result.records.map(record => {
                const obj = {};
                record.keys.forEach(key => {
                    const value = record.get(key);
                    // Handle Neo4j types
                    if (value && typeof value === 'object' && value.constructor.name === 'Integer') {
                        obj[key] = value.toNumber();
                    } else if (value && typeof value === 'object' && value.properties) {
                        // Node or relationship
                        obj[key] = {
                            ...value.properties,
                            labels: value.labels || [],
                            type: value.type || null
                        };
                    } else {
                        obj[key] = value;
                    }
                });
                return obj;
            });
            
            await session.close();
            
            res.json({
                data: data,
                summary: {
                    queryType: result.summary.queryType,
                    counters: result.summary.counters,
                    resultAvailableAfter: result.summary.resultAvailableAfter,
                    resultConsumedAfter: result.summary.resultConsumedAfter
                }
            });
            
        } catch (error) {
            console.error('Query execution error:', error);
            res.status(500).json({ 
                error: 'Query execution failed', 
                details: error.message 
            });
        }
    });

    return router;
}; 