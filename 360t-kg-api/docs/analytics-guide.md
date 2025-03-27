# 360T Knowledge Graph - Analytics Guide

This guide provides comprehensive instructions for using the analytics capabilities of the 360T Knowledge Graph system.

## Overview

The 360T Knowledge Graph analytics system provides powerful tools for extracting insights from your graph data. This guide covers:

1. Running analytics scripts
2. Understanding analytics reports
3. Using the dashboard visualizations
4. Creating custom analytics
5. Integrating analytics into your workflows

## Analytics Scripts

### Running the Analytics Script

To run the main analytics script:

```bash
npm run analyze-graph
```

This script executes a series of Cypher queries against the Neo4j database and saves the results as JSON files in the `360t-kg-api/reports` directory.

### Available Analytics

The analytics script provides the following insights:

1. **Module Statistics**
   - Module counts and composition
   - Module dependencies
   - Module complexity metrics

2. **Test Coverage Analytics**
   - Test coverage by module
   - Test status distribution
   - Untested components

3. **Product Usage Analytics**
   - Product distribution across modules
   - Product relationship analysis
   - Product workflow integration

4. **UI Navigation Analytics**
   - UI flow analysis
   - Navigation path complexity
   - Entry and exit points

5. **Configuration Impact Analytics**
   - Configuration dependencies
   - Shared configuration analysis
   - Configuration impact assessment

### Analytics Reports

Reports are generated in JSON format and saved to:

```
360t-kg-api/reports/module-statistics.json
360t-kg-api/reports/test-coverage.json
360t-kg-api/reports/product-usage.json
360t-kg-api/reports/ui-navigation.json
360t-kg-api/reports/config-impact.json
```

Example report format:

```json
{
  "reportTitle": "Module Statistics Report",
  "generatedAt": "2023-05-15T14:30:00.000Z",
  "summary": {
    "totalModules": 4,
    "totalRelationships": 24,
    "averageComponentsPerModule": 6
  },
  "moduleDetails": [
    {
      "name": "RFS Live Pricing",
      "componentCount": 8,
      "dependencyCount": 1,
      "testCoverage": 0.75
    },
    // Other module details...
  ]
}
```

## Dashboard Visualizations

### Generating the Dashboard

To generate the analytics dashboard:

```bash
npm run generate-dashboard
```

This creates an interactive HTML dashboard in the `360t-kg-api/dashboard` directory.

### Accessing the Dashboard

Open `360t-kg-api/dashboard/index.html` in your web browser to access the dashboard.

### Dashboard Components

The dashboard consists of multiple visualization components:

1. **Module Composition Chart**
   - Visual breakdown of components by module
   - Interactive filtering by module name
   - Color-coded by component type

2. **Test Coverage Dashboard**
   - Coverage percentage by module
   - Test status distribution
   - Coverage gap analysis

3. **Relationship Analysis**
   - Network visualization of relationships
   - Relationship distribution charts
   - Key connection points

4. **Module Dependency Network**
   - Interactive D3.js visualization of module dependencies
   - Dependency chain exploration
   - Critical path highlighting

5. **Product Integration View**
   - Product distribution across modules
   - Product usage metrics
   - Product relationship visualization

### Dashboard Interaction

The dashboard provides several interactive features:

- **Filtering**: Filter data by module, component type, or date range
- **Drill-down**: Click on chart elements to see detailed information
- **Export**: Export visualizations or data in various formats (PNG, CSV)
- **Time comparison**: Compare metrics across different time periods (if historical data is available)

## Data Validation

### Running Validation

To validate your knowledge graph data:

```bash
npm run validate-data
```

This script checks for data integrity issues and produces validation reports.

### Validation Rules

The validation script checks for:

1. **Missing Properties**
   - Nodes with required properties missing
   - Relationship properties validation

2. **Orphaned Nodes**
   - Nodes with no relationships
   - Disconnected subgraphs

3. **Invalid Relationships**
   - Relationships with invalid start/end node types
   - Circular dependency detection

4. **Data Consistency**
   - Duplicate nodes check
   - Naming convention validation
   - Data format verification

### Validation Reports

Validation results are available in two formats:

1. **JSON Report**: `360t-kg-api/reports/validation-report.json`
2. **HTML Report**: `360t-kg-api/reports/validation-report.html`

Each validation issue includes:

- Issue type
- Severity level (High, Medium, Low)
- Affected node(s) or relationship(s)
- Description of the issue
- Recommended action

## System Monitoring

### Running the Monitoring Script

To monitor system health:

```bash
npm run monitor-system
```

This script checks the health of the Neo4j database, API, and system resources.

### Monitoring Components

The monitoring script tracks:

1. **Database Health**
   - Connection status
   - Transaction statistics
   - Node and relationship counts
   - Query performance metrics
   - Memory usage

2. **API Health**
   - Endpoint response times
   - Error rates
   - Request volume

3. **System Resources**
   - CPU usage
   - Memory utilization
   - Disk space

### Monitoring Reports

The monitoring script generates:

1. **Health Report**: `360t-kg-api/reports/health-report.json`
2. **Performance Logs**: `360t-kg-api/logs/performance.log`

## Creating Custom Analytics

### Custom Cypher Queries

To create custom analytics, you can add new Cypher queries to the analytics script:

1. Open `360t-kg-api/scripts/analyzeGraph.js`
2. Add your custom query to the `queries` object:

```javascript
const queries = {
  // Existing queries...
  
  // Add your custom query
  myCustomAnalytic: `
    MATCH (m:Module)
    OPTIONAL MATCH (m)-[r]->(n)
    RETURN m.name AS module, count(r) AS relationCount
    ORDER BY relationCount DESC
  `
};
```

3. Add a processing function for your query results:

```javascript
async function processCustomAnalytic(results) {
  // Process and transform the results
  const processed = {
    reportTitle: "My Custom Analytic",
    generatedAt: new Date().toISOString(),
    data: results.records.map(record => ({
      module: record.get('module'),
      relationCount: record.get('relationCount').toNumber()
    }))
  };
  
  // Save to a file
  await fs.writeFile(
    path.join(reportsDir, 'custom-analytic.json'),
    JSON.stringify(processed, null, 2)
  );
  
  console.log('Custom analytic completed and saved');
}
```

4. Call your processing function in the main execution:

```javascript
// In the main execution function
await processCustomAnalytic(await runQuery(session, queries.myCustomAnalytic));
```

### Custom Dashboard Components

To add custom visualizations to the dashboard:

1. Create a new visualization function in `360t-kg-api/scripts/generateDashboard.js`:

```javascript
function createCustomVisualization(data, containerId) {
  // Use D3.js or Chart.js to create your visualization
  const chart = new Chart(document.getElementById(containerId), {
    type: 'bar',
    data: {
      labels: data.map(item => item.module),
      datasets: [{
        label: 'Relation Count',
        data: data.map(item => item.relationCount),
        backgroundColor: 'rgba(75, 192, 192, 0.2)'
      }]
    }
  });
  
  return chart;
}
```

2. Add your visualization to the dashboard:

```javascript
// In the dashboard generation code
const customData = JSON.parse(await fs.readFile(
  path.join(reportsDir, 'custom-analytic.json'), 'utf8'
));

createCustomVisualization(customData.data, 'custom-chart-container');
```

## Best Practices

### Analytics Optimization

1. **Query Performance**
   - Use indexes for frequently queried properties
   - Limit result sets for complex analytics
   - Use query profiling to identify bottlenecks

2. **Scheduled Analytics**
   - Run heavy analytics during off-peak hours
   - Set up scheduled jobs for recurring analytics
   - Cache results when appropriate

3. **Incremental Analytics**
   - For large graphs, consider incremental analysis
   - Focus on recently changed nodes/relationships
   - Maintain analytics metadata for change tracking

### Dashboard Design

1. **User Experience**
   - Organize related visualizations together
   - Provide clear titles and descriptions
   - Include interactive filters and controls

2. **Performance**
   - Limit data volume in single visualizations
   - Use pagination for large datasets
   - Implement lazy-loading for complex dashboards

3. **Accessibility**
   - Use color schemes that are accessible to color-blind users
   - Provide alternative text representations of data
   - Ensure keyboard navigation for interactive elements

## Integration with External Tools

### Exporting Data

Analytics data can be exported for use in external tools:

```javascript
// In analyzeGraph.js
function exportToCsv(data, filename) {
  const csvContent = convertJsonToCsv(data);
  fs.writeFile(path.join(reportsDir, `${filename}.csv`), csvContent);
}

// Example usage
exportToCsv(moduleStatistics.moduleDetails, 'module-statistics');
```

### Automated Reporting

Schedule regular analytics runs and reports:

```bash
# In your crontab or scheduler
0 1 * * * cd /path/to/360t-kg-api && npm run analyze-graph && npm run generate-dashboard
```

### Alerting

Implement alerting based on analytics results:

```javascript
// In validateData.js
function checkForCriticalIssues(validationResults) {
  const criticalIssues = validationResults.filter(issue => 
    issue.severity === 'High'
  );
  
  if (criticalIssues.length > 0) {
    sendAlert('Critical data validation issues detected', criticalIssues);
  }
}

function sendAlert(subject, data) {
  // Implementation of alerting mechanism (email, Slack, etc.)
}
```

## Support

For technical support and questions about analytics:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Feature Requests**: For new analytics features, email kg-analytics@360t.com 