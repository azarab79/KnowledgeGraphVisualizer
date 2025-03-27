# Quick Exploration Guide

This guide provides a fast path to exploring the 360T Knowledge Graph for first-time users. Follow these simple steps to quickly start discovering relationships and insights.

## 1. Access the Knowledge Graph

1. Open your web browser and navigate to `http://localhost:3002`
2. Log in with your credentials
   - If you don't have credentials, contact your administrator

## 2. Five-Minute Exploration

### Module Dependencies (2 minutes)

1. From the dashboard, click on **Visualizations** in the left menu
2. Click **New Visualization**
3. Select **Module Dependencies**
4. In the "Starting Module" field, type `Trading Core`
5. Set depth to `2`
6. Click **Generate**
7. Explore the visualization:
   - Hover over nodes to see details
   - Click on nodes to select them
   - Use the mouse wheel to zoom in/out
   - Click and drag to move around

### Impact Analysis (3 minutes)

1. In the search bar at the top, type `Market Data`
2. From the results, select the **Market Data Module**
3. In the details panel, click **View Impact Analysis**
4. The visualization shows:
   - Components that depend on Market Data
   - Components that Market Data depends on
   - Critical paths in the dependency chain

## 3. Common Exploration Paths

### Finding Related Components

1. Use the search bar to find a component of interest
2. Select the component from the search results
3. Click **View Relationships**

### Discovering Test Coverage

1. Click on **Reports** in the left menu
2. Select **Test Coverage Overview**
3. The heatmap shows test coverage across all modules
4. Click on any module to drill down

### Exploring UI Navigation Flows

1. Click on **Visualizations**
2. Select **UI Navigation Flow**
3. Choose any UI area (e.g., `Trading Dashboard`)
4. The resulting diagram shows all possible navigation paths

## 4. Useful Search Examples

Try these example searches to get started:

- `name:"Trading Core" type:module`
- `CONTAINS relationship:*`
- `created:>2023-01-01 type:product`
- `"market data" AND connection`

## 5. Quick Visualization Tips

- Double-click on a node to expand its relationships
- Right-click on a node for additional options
- Use the filter panel (right side) to focus on specific node types
- Click the **Style** button to customize the visualization
- Use the **Legend** to understand node and relationship types

## 6. Five Useful Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Ctrl/Cmd + F |
| Save Current View | Ctrl/Cmd + S |
| Refresh | F5 |
| Full Screen | F11 |
| Help | F1 |

## Next Steps

After this quick exploration:

1. Check the [User Guide](./user-guide.md) for complete details
2. Review the [Data Model Guide](./data-model.md) to understand the underlying structure
3. Explore the [Query Guide](./query-guide.md) for advanced querying techniques

## Quick Troubleshooting

- **Visualization too complex?** Reduce the relationship depth or apply filters
- **Search not finding expected results?** Try alternative terms or check advanced search syntax
- **Performance issues?** Close other applications and try a smaller data subset 