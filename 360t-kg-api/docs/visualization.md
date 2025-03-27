# 360T Knowledge Graph - Visualization Guide

This guide provides comprehensive instructions for visualizing the 360T Knowledge Graph using the Neo4j Browser.

## Neo4j Browser Access

To access the Neo4j Browser:

1. Open your web browser and navigate to `http://localhost:7474` (or your configured Neo4j server address)
2. Login with your Neo4j credentials (default: username `neo4j`, password as configured during setup)
3. You will be presented with the Neo4j Browser interface

## Basic Visualization

### Viewing All Nodes

To view all nodes in the knowledge graph:

```cypher
MATCH (n)
RETURN n
LIMIT 300
```

> **Note**: Limiting results is recommended for large graphs to maintain performance.

### Viewing the Complete Graph

To view all nodes and relationships:

```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 300
```

### Viewing Specific Node Types

To view all nodes of a specific type:

```cypher
MATCH (n:Module)
RETURN n
```

## Styling the Visualization

### Basic Styling

Neo4j Browser automatically applies different colors to different node labels. You can customize this using Cypher queries:

```cypher
MATCH (n:Module)
RETURN n
```

After running the query, click on the node style button in the visualization panel to modify:
- Node colors
- Node sizes
- Relationship colors and widths

### Advanced Styling with Cypher

Apply custom styling directly in your queries:

```cypher
// Color modules by status
MATCH (n:Module)
RETURN n,
CASE n.status
  WHEN 'active' THEN '#00AA00'
  WHEN 'deprecated' THEN '#AA0000'
  ELSE '#AAAAAA'
END AS color
```

## Useful Visualization Queries

### Visualizing Module Dependencies

```cypher
MATCH path = (m1:Module)-[:REQUIRES]->(m2:Module)
RETURN path
```

This visualization shows which modules depend on other modules.

### Visualizing Test Coverage

```cypher
MATCH path = (tc:TestCase)-[:VALIDATES]->(n)
RETURN path
```

This shows all test cases and what they validate.

### Visualizing UI Navigation Flow

```cypher
MATCH path = (ui1:UI_Area)-[:NAVIGATES_TO*1..5]->(ui2:UI_Area)
RETURN path
```

This shows the navigation paths between UI components (limited to 5 hops).

### Visualizing Configuration Dependencies

```cypher
MATCH path = (ci:ConfigurationItem)-[:CONFIGURES_IN]->(m:Module)
RETURN path
```

This shows which configuration items belong to which modules.

### Visualizing the New Module Structure

```cypher
// Show the new modules and their connections
MATCH path = (m1:Module)-[:CONNECTS_TO|REQUIRES]->(m2:Module)
WHERE m1.name IN ['Market Data Service', 'Order Management', 'Post-Trade Processing', 'RFS Live Pricing']
RETURN path
```

This visualization highlights the newly added modules and their integration with existing modules.

### Visualizing Product Usage Across Modules

```cypher
// Show how products are used across different modules
MATCH path = (p:Product)<-[:CONTAINS]-(m:Module)
WHERE p.name IN ['FX Spot', 'FX Forward', 'FX Swap', 'NDF']
RETURN path
```

This shows how the various products (including newly added ones) are contained within modules.

## Interactive Features

### Node Interaction

- **Click a node**: Select and highlight it
- **Double-click a node**: Expand its connections
- **Shift + click**: Select multiple nodes
- **Right-click**: Open context menu with additional options

### Graph Manipulation

- **Mouse wheel**: Zoom in/out
- **Click and drag background**: Pan the view
- **Click and drag nodes**: Rearrange the visualization

### Layout Options

Neo4j Browser offers several layout algorithms:

1. **Force-directed**: Default layout, spreads nodes based on connections
2. **Circular**: Arranges nodes in a circle
3. **Hierarchical**: Shows hierarchical relationships (good for dependency trees)

Select layouts from the visualization panel settings.

## Saving and Sharing

### Exporting Graphs

To export the current visualization:

1. Create your visualization with a Cypher query
2. Click the export button in the bottom-right of the visualization panel
3. Choose from PNG, SVG, or JSON formats

### Saving Favorite Queries

Save frequently used visualization queries:

1. Write your Cypher query
2. Click the star icon next to the query input
3. Name your saved query
4. Access saved queries from the star menu

## Dashboard Visualization

### Accessing the Custom Dashboard

We've added a custom analytics dashboard that offers more sophisticated visualizations:

1. Run the dashboard generation script: `npm run generate-dashboard`
2. Open `360t-kg-api/dashboard/index.html` in your web browser

The dashboard includes:

- **Module Composition Chart**: Breakdown of components by module
- **Test Coverage Dashboard**: Visual representation of test coverage
- **Relationship Analysis**: Network visualization of relationships
- **Module Dependency Network**: Interactive D3.js visualization of module dependencies

## Performance Tips

### Limiting Large Results

For better performance with large graphs:

```cypher
MATCH (n)
RETURN n
LIMIT 100
```

### Optimizing Visualization

For complex visualizations:

```cypher
// Instead of returning all properties
MATCH (n:Module)
RETURN n.name, n.version
LIMIT 25
```

### Using Query Parameters

For frequently changed filters:

```cypher
// Using parameters (set in Neo4j Browser)
MATCH (m:Module {name: $moduleName})-[r]->(n)
RETURN m, r, n
```

## Common Visualization Patterns

### Impact Analysis

Visualize what would be affected by changing a module:

```cypher
MATCH path = (m:Module {name: 'Order Management'})-[*1..2]->(n)
RETURN path
```

### Dependency Chains

Visualize complete dependency chains:

```cypher
MATCH path = (m:Module {name: 'Post-Trade Processing'})-[:REQUIRES*]->(dep:Module)
RETURN path
```

### Coverage Analysis

Visualize test coverage for key components:

```cypher
MATCH (tc:TestCase)-[:VALIDATES]->(m:Module)
WITH m, count(tc) as testCount
RETURN m.name as Module, testCount as TestCoverage
ORDER BY testCount DESC
```

## Troubleshooting

### Performance Issues

- Reduce query result limits
- Apply more specific filters in your MATCH clauses
- Avoid visualizing the entire graph at once

### Layout Problems

- Try different layout algorithms
- Manually adjust node positions by dragging
- Reset the visualization by refreshing the browser

### Common Error Messages

- **"Too many nodes to display"**: Add LIMIT clause to your query
- **"Browser sync error"**: Refresh the Neo4j Browser
- **"Query execution error"**: Check your Cypher syntax and node/relationship names

## Best Practices

1. **Start Small**: Begin with specific nodes or small subgraphs
2. **Use Meaningful Colors**: Assign colors based on node properties
3. **Organize Layouts**: Choose appropriate layouts for different relationship types
4. **Regular Cleanup**: Close unused panels to maintain browser performance

## Support

For technical support and questions about visualization:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Visualization Suggestions**: Share visualization ideas through the established feedback process 