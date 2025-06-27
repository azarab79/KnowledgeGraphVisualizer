# Graph Visualization Guide

This guide provides a comprehensive overview of the interactive graph visualization features within the 360T Knowledge Graph application. The visualization is powered by D3.js and offers a rich, interactive experience for exploring your data.

## The Interactive Graph

The main feature of the visualization is the interactive, force-directed graph. It's designed to help you discover connections and explore relationships in your data intuitively.

### Basic Interactions

You can interact with the graph in several ways:

*   **Zoom**: Use your mouse wheel to zoom in and out.
*   **Pan**: Click and drag on an empty area of the canvas to move the entire graph.
*   **Drag Nodes**: Click and drag any node to reposition it. The simulation will temporarily be affected, but you can rearrange the graph to your liking.

### Node Details

- **Click a node**: A single click on any node will select it and display its details in the "Node Details" panel. This panel shows the node's type, properties, and other relevant information.

## Customizing the Visualization

The visualization is highly customizable. You can control the appearance of nodes and relationships to suit your needs. These settings can be managed through the UI and are saved locally in your browser.

### Node Appearance

Nodes are styled based on their type. You can customize the color, size, and shape of each node type.

*   **Node Colors**: Each node type is assigned a default color. You can change these colors in the Legend.
*   **Node Sizes**: The size of a node can be adjusted to represent its importance or any other metric.
*   **Node Shapes**: Different node types can be assigned different shapes (e.g., circles, squares, triangles) for easier identification.

### Relationship Appearance

Relationships (or links) between nodes can also be styled:

*   **Relationship Colors**: Different types of relationships are assigned different colors.
*   **Relationship Styles**: Relationships can be represented by solid or dashed lines to indicate different types of connections (e.g., a "requires" relationship might be a solid line, while a "related to" relationship might be dashed).

## The Legend

The legend provides a key to the visual language of the graph. It shows you what the different colors, shapes, and line styles mean.

### Showing and Hiding the Legend

- Use the **"Show Legend"** button, located at the bottom-right of the screen, to toggle the visibility of the legend.

### Customizing Styles from the Legend

The legend is not just for viewing; it's also interactive. You can click on items in the legend to customize their styles. For example, you can click on a node type in the legend to open a color picker and change its color.

## Managing Your Configuration

Your custom styles and other visualization settings are saved as a configuration. You can manage this configuration using the buttons at the bottom-left of the screen.

*   **Export Config**: Click this button to save your current settings (node colors, sizes, shapes, etc.) to a JSON file. This is useful for backing up your settings or sharing them with others.
*   **Import Config**: Click this button to load a previously exported configuration file. This will replace your current settings with the ones from the file.
*   **Reset Config**: Click this button to restore all visualization settings to their default values.

## Performance Considerations

For very large graphs, rendering performance can be a consideration. The application is optimized for performance, but if you experience slowness, consider the following:

*   **Filter Your Data**: Before visualizing, try to filter your data to show only the nodes and relationships you are interested in.
*   **Hardware Acceleration**: Ensure your browser has hardware acceleration enabled for the best performance.

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