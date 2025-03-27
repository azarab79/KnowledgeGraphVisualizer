const express = require('express');
const router = express.Router();

// Analysis routes will require access to the Neo4j driver
module.exports = (driver) => {
    // Impact analysis 
    // Find what is affected by a selected node
    router.get('/impact', async (req, res, next) => {
        const nodeId = req.query.nodeId;
        if (!nodeId) {
            return res.status(400).json({ error: 'Node ID is required' });
        }
        
        const session = driver.session();
        try {
            // Find paths from the selected node to other nodes (outgoing relationships)
            const result = await session.run(`
                MATCH path = (n)-[*1..3]->(m)
                WHERE id(n) = toInteger($nodeId)
                RETURN path
                LIMIT 50
            `, { nodeId });
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = new Map();
            
            result.records.forEach(record => {
                const path = record.get('path');
                const pathSegments = path.segments;
                
                // Add the starting node
                const startNode = path.start;
                const startNodeProps = startNode.properties;
                const startNodeLabel = startNode.labels[0];
                
                nodes.set(startNode.identity.toString(), {
                    id: startNode.identity.toString(),
                    label: startNodeProps.name || startNodeProps.test_case_id || 'Unnamed',
                    title: `${startNodeLabel}: ${startNodeProps.name || startNodeProps.test_case_id || 'Unnamed'}`,
                    group: startNodeLabel,
                    properties: startNodeProps,
                    level: 0,
                    color: { background: '#ff8080' } // Highlight the start node
                });
                
                // Process each path segment (relationship + end node)
                let level = 1;
                pathSegments.forEach(segment => {
                    const relationship = segment.relationship;
                    const endNode = segment.end;
                    
                    // Process end node
                    const endNodeProps = endNode.properties;
                    const endNodeLabel = endNode.labels[0];
                    
                    nodes.set(endNode.identity.toString(), {
                        id: endNode.identity.toString(),
                        label: endNodeProps.name || endNodeProps.test_case_id || 'Unnamed',
                        title: `${endNodeLabel}: ${endNodeProps.name || endNodeProps.test_case_id || 'Unnamed'}`,
                        group: endNodeLabel,
                        properties: endNodeProps,
                        level: level
                    });
                    
                    // Process relationship
                    edges.set(relationship.identity.toString(), {
                        id: relationship.identity.toString(),
                        from: relationship.start.toString(),
                        to: relationship.end.toString(),
                        label: relationship.type,
                        arrows: 'to',
                        title: relationship.type,
                        properties: relationship.properties,
                        level: level
                    });
                    
                    level++;
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: Array.from(edges.values())
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Test coverage analysis
    // Find what test cases validate a selected component
    router.get('/test-coverage', async (req, res, next) => {
        const nodeId = req.query.nodeId;
        if (!nodeId) {
            return res.status(400).json({ error: 'Node ID is required' });
        }
        
        const session = driver.session();
        try {
            // Find test cases that validate the selected component or its dependencies
            const result = await session.run(`
                MATCH path = (tc:TestCase)-[:VALIDATES*1..2]->(n)
                WHERE id(n) = toInteger($nodeId)
                RETURN path
                UNION
                MATCH path = (tc:TestCase)-[:VALIDATES]->()-[:CONTAINS|USES|REQUIRES*1..2]->(n)
                WHERE id(n) = toInteger($nodeId)
                RETURN path
                LIMIT 50
            `, { nodeId });
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = new Map();
            
            // First add the target node
            const targetResult = await session.run(`
                MATCH (n) WHERE id(n) = toInteger($nodeId)
                RETURN n
            `, { nodeId });
            
            if (targetResult.records.length > 0) {
                const targetNode = targetResult.records[0].get('n');
                const targetNodeProps = targetNode.properties;
                const targetNodeLabel = targetNode.labels[0];
                
                nodes.set(targetNode.identity.toString(), {
                    id: targetNode.identity.toString(),
                    label: targetNodeProps.name || targetNodeProps.test_case_id || 'Unnamed',
                    title: `${targetNodeLabel}: ${targetNodeProps.name || targetNodeProps.test_case_id || 'Unnamed'}`,
                    group: targetNodeLabel,
                    properties: targetNodeProps,
                    color: { background: '#80ff80' } // Highlight the target node
                });
            }
            
            result.records.forEach(record => {
                const path = record.get('path');
                const pathSegments = path.segments;
                
                // Add the starting node (test case)
                const startNode = path.start;
                const startNodeProps = startNode.properties;
                const startNodeLabel = startNode.labels[0];
                
                nodes.set(startNode.identity.toString(), {
                    id: startNode.identity.toString(),
                    label: startNodeProps.name || startNodeProps.test_case_id || 'Unnamed',
                    title: `${startNodeLabel}: ${startNodeProps.name || startNodeProps.test_case_id || 'Unnamed'}`,
                    group: startNodeLabel,
                    properties: startNodeProps,
                    color: { background: '#8080ff' } // Highlight test cases
                });
                
                // Process each path segment (relationship + end node)
                pathSegments.forEach(segment => {
                    const relationship = segment.relationship;
                    const endNode = segment.end;
                    
                    // Process end node
                    const endNodeProps = endNode.properties;
                    const endNodeLabel = endNode.labels[0];
                    
                    // Don't override the target node color
                    if (!nodes.has(endNode.identity.toString()) || endNode.identity.toString() !== nodeId) {
                        nodes.set(endNode.identity.toString(), {
                            id: endNode.identity.toString(),
                            label: endNodeProps.name || endNodeProps.test_case_id || 'Unnamed',
                            title: `${endNodeLabel}: ${endNodeProps.name || endNodeProps.test_case_id || 'Unnamed'}`,
                            group: endNodeLabel,
                            properties: endNodeProps
                        });
                    }
                    
                    // Process relationship
                    edges.set(relationship.identity.toString(), {
                        id: relationship.identity.toString(),
                        from: relationship.start.toString(),
                        to: relationship.end.toString(),
                        label: relationship.type,
                        arrows: 'to',
                        title: relationship.type,
                        properties: relationship.properties
                    });
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: Array.from(edges.values())
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });
    
    // Dependency analysis
    // Find what a selected node depends on
    router.get('/dependencies', async (req, res, next) => {
        const nodeId = req.query.nodeId;
        if (!nodeId) {
            return res.status(400).json({ error: 'Node ID is required' });
        }
        
        const session = driver.session();
        try {
            // Find paths to nodes that the selected node depends on (incoming relationships)
            const result = await session.run(`
                MATCH path = (n)<-[r:USES|REQUIRES|CONFIGURES_IN|CONTAINS|VALIDATES*1..3]-(m)
                WHERE id(n) = toInteger($nodeId)
                RETURN path
                LIMIT 50
            `, { nodeId });
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = new Map();
            
            // First add the target node
            const targetResult = await session.run(`
                MATCH (n) WHERE id(n) = toInteger($nodeId)
                RETURN n
            `, { nodeId });
            
            if (targetResult.records.length > 0) {
                const targetNode = targetResult.records[0].get('n');
                const targetNodeProps = targetNode.properties;
                const targetNodeLabel = targetNode.labels[0];
                
                nodes.set(targetNode.identity.toString(), {
                    id: targetNode.identity.toString(),
                    label: targetNodeProps.name || targetNodeProps.test_case_id || 'Unnamed',
                    title: `${targetNodeLabel}: ${targetNodeProps.name || targetNodeProps.test_case_id || 'Unnamed'}`,
                    group: targetNodeLabel,
                    properties: targetNodeProps,
                    color: { background: '#ff8080' } // Highlight the target node
                });
            }
            
            result.records.forEach(record => {
                const path = record.get('path');
                const pathSegments = path.segments;
                
                pathSegments.forEach(segment => {
                    const relationship = segment.relationship;
                    const startNode = segment.start;
                    
                    // Process start node
                    const startNodeProps = startNode.properties;
                    const startNodeLabel = startNode.labels[0];
                    
                    nodes.set(startNode.identity.toString(), {
                        id: startNode.identity.toString(),
                        label: startNodeProps.name || startNodeProps.test_case_id || 'Unnamed',
                        title: `${startNodeLabel}: ${startNodeProps.name || startNodeProps.test_case_id || 'Unnamed'}`,
                        group: startNodeLabel,
                        properties: startNodeProps
                    });
                    
                    // Process relationship
                    edges.set(relationship.identity.toString(), {
                        id: relationship.identity.toString(),
                        from: relationship.start.toString(),
                        to: relationship.end.toString(),
                        label: relationship.type,
                        arrows: 'to',
                        title: relationship.type,
                        properties: relationship.properties
                    });
                });
            });
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: Array.from(edges.values())
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });

    // Path finding
    // Find paths between two nodes
    router.get('/paths', async (req, res, next) => {
        const { sourceId, targetId } = req.query;
        if (!sourceId || !targetId) {
            return res.status(400).json({ error: 'Source and target node IDs are required' });
        }
        
        const session = driver.session();
        try {
            // Find paths between source and target nodes
            const result = await session.run(`
                // First find the shortest path
                MATCH path = shortestPath((source)-[*1..5]-(target))
                WHERE id(source) = toInteger($sourceId) AND id(target) = toInteger($targetId)
                RETURN path as p
                UNION
                // Then find alternative paths
                MATCH path = (source)-[*1..3]-(target)
                WHERE id(source) = toInteger($sourceId) 
                AND id(target) = toInteger($targetId)
                AND path <> shortestPath((source)-[*]-(target))
                RETURN path as p
                LIMIT 5
            `, { sourceId, targetId });
            
            // Transform Neo4j results to vis-network format
            const nodes = new Map();
            const edges = new Map();
            
            result.records.forEach(record => {
                const path = record.get('p');
                const pathSegments = path.segments;
                
                // Add source node
                const startNode = path.start;
                const startNodeProps = startNode.properties;
                const startNodeLabel = startNode.labels[0];
                
                nodes.set(startNode.identity.toString(), {
                    id: startNode.identity.toString(),
                    label: startNodeProps.name || startNodeProps.test_case_id || 'Unnamed',
                    title: `${startNodeLabel}: ${startNodeProps.name || startNodeProps.test_case_id || 'Unnamed'}`,
                    group: startNodeLabel,
                    properties: startNodeProps,
                    color: { background: '#80ff80' } // Highlight source node
                });
                
                pathSegments.forEach(segment => {
                    const relationship = segment.relationship;
                    const endNode = segment.end;
                    
                    // Process end node
                    const endNodeProps = endNode.properties;
                    const endNodeLabel = endNode.labels[0];
                    
                    nodes.set(endNode.identity.toString(), {
                        id: endNode.identity.toString(),
                        label: endNodeProps.name || endNodeProps.test_case_id || 'Unnamed',
                        title: `${endNodeLabel}: ${endNodeProps.name || endNodeProps.test_case_id || 'Unnamed'}`,
                        group: endNodeLabel,
                        properties: endNodeProps,
                        color: endNode.identity.toString() === targetId ? { background: '#ff8080' } : undefined // Highlight target node
                    });
                    
                    // Process relationship
                    edges.set(relationship.identity.toString(), {
                        id: relationship.identity.toString(),
                        from: relationship.start.toString(),
                        to: relationship.end.toString(),
                        label: relationship.type,
                        arrows: 'to',
                        title: relationship.type,
                        properties: relationship.properties
                    });
                });
            });
            
            if (nodes.size === 0) {
                return res.status(404).json({ error: 'No paths found between the selected nodes' });
            }
            
            res.json({
                nodes: Array.from(nodes.values()),
                edges: Array.from(edges.values())
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });

    // Centrality analysis
    // Calculate node centrality metrics
    router.get('/centrality', async (req, res, next) => {
        const type = req.query.type || 'degree';
        const session = driver.session();
        
        try {
            let query;
            switch (type) {
                case 'degree':
                    // Simple degree centrality - count all relationships
                    query = `
                        MATCH (n)
                        WITH n, size((n)--()) as degree
                        RETURN n, degree as centrality
                        ORDER BY centrality DESC
                        LIMIT 20
                    `;
                    break;
                    
                case 'betweenness':
                    // Simplified betweenness - count paths through each node
                    query = `
                        MATCH (n)
                        MATCH (s)-[*1..3]-(t)
                        WHERE s <> t AND s <> n AND t <> n
                        WITH n, s, t
                        MATCH p = shortestPath((s)-[*]-(t))
                        WHERE n IN nodes(p)
                        WITH n, COUNT(p) as centrality
                        RETURN n, centrality
                        ORDER BY centrality DESC
                        LIMIT 20
                    `;
                    break;
                    
                case 'closeness':
                    // Simplified closeness - average path length to other nodes
                    query = `
                        MATCH (n)
                        MATCH (other)
                        WHERE other <> n
                        WITH n, collect(other) as others
                        UNWIND others as other
                        OPTIONAL MATCH p = shortestPath((n)-[*]-(other))
                        WITH n, other, CASE WHEN p IS NULL THEN 0 ELSE 1.0/length(p) END as distance
                        WITH n, sum(distance) as centrality
                        RETURN n, centrality
                        ORDER BY centrality DESC
                        LIMIT 20
                    `;
                    break;
                    
                default:
                    return res.status(400).json({ error: 'Invalid centrality type' });
            }
            
            const result = await session.run(query);
            
            // Transform results
            const nodes = result.records.map(record => {
                const node = record.get('n');
                const centrality = record.get('centrality').toNumber();
                const props = node.properties;
                const label = node.labels[0];
                
                return {
                    id: node.identity.toString(),
                    label: props.name || props.test_case_id || 'Unnamed',
                    title: `${label}: ${props.name || props.test_case_id || 'Unnamed'}\nCentrality: ${centrality.toFixed(3)}`,
                    group: label,
                    properties: props,
                    centrality,
                    // Add size based on centrality for visualization
                    size: Math.max(30, 30 + (centrality * 5)),
                    color: {
                        background: '#' + Math.floor(Math.random()*16777215).toString(16),
                        highlight: { background: '#ff8080' }
                    }
                };
            });
            
            res.json({ 
                nodes,
                edges: [] // No edges needed for centrality visualization
            });
        } catch (error) {
            next(error);
        } finally {
            await session.close();
        }
    });

    return router;
}; 