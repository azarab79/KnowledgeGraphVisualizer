const express = require('express');
const router = express.Router();

// Graph routes will require access to the Neo4j driver
module.exports = (driver) => {
    // Get initial graph data
    router.get('/initial', async (req, res, next) => {
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (n)-[r]->(m)
                WHERE labels(n)[0] IN ['Module', 'Product', 'Workflow', 'TestCase', 'UI_Area', 'ConfigurationItem']
                AND labels(m)[0] IN ['Module', 'Product', 'Workflow', 'TestCase', 'UI_Area', 'ConfigurationItem']
                RETURN n, r, m
                LIMIT 50
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
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
                        group: nodeLabel,
                        labels: sourceNode.labels,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
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
        
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (n) 
                WHERE n.name CONTAINS $term OR n.test_case_id CONTAINS $term
                RETURN n
                LIMIT 20
            `, { term });
            
            const nodes = [];
            
            result.records.forEach(record => {
                const node = record.get('n');
                const nodeProps = node.properties;
                const nodeLabel = node.labels[0];
                
                nodes.push({
                    id: node.identity.toString(),
                    label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                    title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
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
        
        const session = driver.session();
        try {
            const result = await session.run(`
                MATCH (n)-[r]-(m)
                WHERE id(n) = toInteger($nodeId)
                RETURN n, r, m
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
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
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
        
        const session = driver.session();
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
                    
                    nodes.set(sourceNode.identity.toString(), {
                        id: sourceNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
                        group: nodeLabel,
                        properties: nodeProps
                    });
                }
                
                // Process target node
                if (!nodes.has(targetNode.identity.toString())) {
                    const nodeProps = targetNode.properties;
                    const nodeLabel = targetNode.labels[0];
                    
                    nodes.set(targetNode.identity.toString(), {
                        id: targetNode.identity.toString(),
                        label: nodeProps.name || nodeProps.test_case_id || 'Unnamed',
                        title: `${nodeLabel}: ${nodeProps.name || nodeProps.test_case_id || 'Unnamed'}`,
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
    
    return router;
}; 