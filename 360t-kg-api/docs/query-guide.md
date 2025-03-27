# 360T Knowledge Graph - Query Guide

This guide provides comprehensive instructions for querying the 360T Knowledge Graph using Cypher, the query language for Neo4j.

## Basic Query Concepts

### Node Queries

Query nodes based on labels and properties:

```cypher
// Query all modules
MATCH (m:Module)
RETURN m

// Query modules with specific properties
MATCH (m:Module)
WHERE m.status = 'active'
RETURN m.name, m.version, m.owner

// Count nodes by type
MATCH (n)
RETURN labels(n) AS nodeType, count(*) AS count
ORDER BY count DESC
```

### Relationship Queries

Query relationships between nodes:

```cypher
// Find all relationships from modules
MATCH (m:Module)-[r]->(n)
RETURN m.name AS module, type(r) AS relationship, labels(n)[0] AS targetType, n.name AS targetName

// Find specific relationship types
MATCH (m:Module)-[r:CONTAINS]->(p:Product)
RETURN m.name AS module, p.name AS product

// Count relationships by type
MATCH ()-[r]->()
RETURN type(r) AS relationshipType, count(*) AS count
ORDER BY count DESC
```

### Path Queries

Query paths through the graph:

```cypher
// Find paths between two specific nodes
MATCH path = (m1:Module {name: 'RFS Live Pricing'})-[*1..3]->(m2:Module {name: 'Market Data Service'})
RETURN path

// Find all paths of a certain length
MATCH path = (m:Module)-[*1..2]->(n)
WHERE m.name = 'Order Management'
RETURN path

// Find shortest path
MATCH path = shortestPath((m1:Module {name: 'Post-Trade Processing'})-[*]-(m2:Module {name: 'RFS Live Pricing'}))
RETURN path
```

## Common Query Patterns

### Module Analysis

```cypher
// Find all components within a module
MATCH (m:Module {name: 'RFS Live Pricing'})-[r]->(n)
RETURN m.name AS module, type(r) AS relationship, labels(n)[0] AS componentType, n.name AS componentName

// Find module dependencies
MATCH (m1:Module)-[:REQUIRES]->(m2:Module)
RETURN m1.name AS module, m2.name AS requires

// Calculate module complexity (number of relationships)
MATCH (m:Module)
OPTIONAL MATCH (m)-[r]->()
RETURN m.name AS module, count(r) AS relationshipCount
ORDER BY relationshipCount DESC
```

### Product Analysis

```cypher
// Find modules containing specific products
MATCH (m:Module)-[:CONTAINS]->(p:Product)
WHERE p.name IN ['FX Spot', 'FX Forward', 'FX Swap']
RETURN m.name AS module, collect(p.name) AS products

// Find test cases for products
MATCH (tc:TestCase)-[:VALIDATES]->()-[:CONTAINS|USES]->(p:Product)
WHERE p.name = 'FX Spot'
RETURN tc.name AS testCase, tc.status AS status

// Analyze product coverage across modules
MATCH (p:Product)<-[:CONTAINS]-(m:Module)
RETURN p.name AS product, count(m) AS moduleCount
ORDER BY moduleCount DESC
```

### Test Coverage

```cypher
// Calculate test coverage per module
MATCH (m:Module)
OPTIONAL MATCH (tc:TestCase)-[:VALIDATES]->(m)
RETURN m.name AS module, count(tc) AS testCount
ORDER BY testCount DESC

// Find untested components
MATCH (m:Module)
WHERE NOT (m)<-[:VALIDATES]-(:TestCase)
RETURN m.name AS untested

// Test status summary
MATCH (tc:TestCase)
RETURN tc.status AS status, count(*) AS count
ORDER BY count DESC
```

### UI Navigation

```cypher
// Find all UI navigation paths
MATCH path = (ui1:UI_Area)-[:NAVIGATES_TO*]->(ui2:UI_Area)
RETURN ui1.name AS from, ui2.name AS to, length(path) AS steps

// Find dead ends in UI navigation
MATCH (ui:UI_Area)
WHERE NOT (ui)-[:NAVIGATES_TO]->()
RETURN ui.name AS deadEnd

// Find entry points (UI areas with no incoming navigation)
MATCH (ui:UI_Area)
WHERE NOT ()-[:NAVIGATES_TO]->(ui)
RETURN ui.name AS entryPoint
```

### Configuration Impact

```cypher
// Find modules affected by configuration item
MATCH (ci:ConfigurationItem)-[:CONFIGURES_IN]->(m:Module)
RETURN ci.name AS configItem, collect(m.name) AS affectedModules

// Find configuration dependencies between modules
MATCH (m1:Module)<-[:CONFIGURES_IN]-(ci:ConfigurationItem)-[:CONFIGURES_IN]->(m2:Module)
WHERE m1 <> m2
RETURN m1.name AS module1, m2.name AS module2, collect(ci.name) AS sharedConfig
```

## Advanced Analytics Queries

### Module Dependencies Analysis

```cypher
// Identify critical modules by dependency count
MATCH (m:Module)<-[:REQUIRES]-(dep:Module)
WITH m, count(dep) AS dependencyCount
RETURN m.name AS module, dependencyCount
ORDER BY dependencyCount DESC
LIMIT 10

// Calculate module dependency depth
MATCH path = (m:Module)-[:REQUIRES*]->(dep:Module)
WHERE NOT (dep)-[:REQUIRES]->()
WITH m, max(length(path)) AS maxDepth
RETURN m.name AS module, maxDepth
ORDER BY maxDepth DESC
```

### Test Coverage Analytics

```cypher
// Test coverage ratios by module
MATCH (m:Module)
OPTIONAL MATCH (m)-[r]->(comp)
WITH m, count(comp) AS componentCount
OPTIONAL MATCH (tc:TestCase)-[:VALIDATES]->(m)
WITH m, componentCount, count(tc) AS testCount
RETURN 
  m.name AS module, 
  componentCount,
  testCount,
  CASE WHEN componentCount > 0 
    THEN toFloat(testCount) / componentCount 
    ELSE 0 
  END AS coverageRatio
ORDER BY coverageRatio ASC

// Test status distribution by module
MATCH (tc:TestCase)-[:VALIDATES]->(m:Module)
RETURN 
  m.name AS module,
  sum(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) AS passed,
  sum(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) AS failed,
  sum(CASE WHEN tc.status NOT IN ['passed', 'failed'] THEN 1 ELSE 0 END) AS other
```

### Product Usage Analytics

```cypher
// Product usage across system
MATCH (p:Product)<-[:CONTAINS|USES]-(n)
WITH p, labels(n)[0] AS nodeType, count(n) AS usageCount
RETURN 
  p.name AS product,
  sum(CASE WHEN nodeType = 'Module' THEN usageCount ELSE 0 END) AS moduleUsage,
  sum(CASE WHEN nodeType = 'Workflow' THEN usageCount ELSE 0 END) AS workflowUsage,
  sum(usageCount) AS totalUsage
ORDER BY totalUsage DESC

// Product relationships analysis
MATCH (p:Product)
OPTIONAL MATCH (p)<-[r]-()
WITH p, count(r) AS incomingRel
OPTIONAL MATCH (p)-[r2]->()
WITH p, incomingRel, count(r2) AS outgoingRel
RETURN 
  p.name AS product,
  incomingRel,
  outgoingRel,
  incomingRel + outgoingRel AS totalRel
ORDER BY totalRel DESC
```

### System Integration Analysis

```cypher
// Module connectivity analysis
MATCH (m:Module)
OPTIONAL MATCH (m)-[:CONNECTS_TO]->(other:Module)
WITH m, count(other) AS outConnections
OPTIONAL MATCH (m)<-[:CONNECTS_TO]-(other:Module)
WITH m, outConnections, count(other) AS inConnections
RETURN 
  m.name AS module,
  inConnections,
  outConnections,
  inConnections + outConnections AS totalConnections
ORDER BY totalConnections DESC

// Identify integration hubs
MATCH (m:Module)-[:CONNECTS_TO]-(other:Module)
WITH m, count(DISTINCT other) AS connectedModules
WHERE connectedModules > 1
RETURN m.name AS integrationHub, connectedModules
ORDER BY connectedModules DESC
```

### UI Flow Analysis

```cypher
// Identify most complex UI paths
MATCH path = (start:UI_Area)-[:NAVIGATES_TO*]->(end:UI_Area)
WHERE NOT (end)-[:NAVIGATES_TO]->()
RETURN 
  start.name AS entryPoint,
  end.name AS exitPoint,
  length(path) AS pathLength,
  [node IN nodes(path) | node.name] AS completePath
ORDER BY pathLength DESC
LIMIT 10

// UI area usage frequency
MATCH (ui:UI_Area)<-[:DISPLAYS]-(m:Module)
OPTIONAL MATCH (ui)<-[:NAVIGATES_TO]-(other:UI_Area)
WITH ui, count(m) AS moduleCount, count(other) AS incomingNavigation
RETURN 
  ui.name AS uiArea,
  moduleCount,
  incomingNavigation,
  moduleCount + incomingNavigation AS usageScore
ORDER BY usageScore DESC
```

## Advanced Query Techniques

### Aggregation

Aggregate and analyze data:

```cypher
// Count and group
MATCH (n:Module)-[:CONTAINS]->(p:Product)
RETURN n.name AS module, collect(p.name) AS products, count(p) AS productCount
ORDER BY productCount DESC

// Statistics
MATCH (tc:TestCase)-[:VALIDATES]->(m:Module)
RETURN m.name AS module, 
       count(tc) AS testCount,
       sum(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) AS passedTests,
       sum(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) AS failedTests
```

### Pattern Matching

Detect patterns in the graph:

```cypher
// Find triangular dependencies
MATCH (a:Module)-[:REQUIRES]->(b:Module)-[:REQUIRES]->(c:Module)-[:REQUIRES]->(a)
RETURN a.name AS module1, b.name AS module2, c.name AS module3

// Find orphaned nodes (nodes with no relationships)
MATCH (n)
WHERE NOT (n)--()
RETURN labels(n) AS nodeType, collect(n.name) AS orphanedNodes
```

### Performance Optimization

Optimize query performance:

```cypher
// Use EXPLAIN to analyze query execution
EXPLAIN MATCH (m:Module)-[:CONTAINS]->(p:Product)
RETURN m.name, p.name

// Use indexes for faster lookups
CREATE INDEX module_name_idx IF NOT EXISTS FOR (m:Module) ON (m.name)

// Use query profiling
PROFILE MATCH (m:Module {name: 'RFS Live Pricing'})-[r]->(n)
RETURN labels(n) AS type, count(*) AS count
```

## Best Practices

### Query Structure

- Start with specific node labels rather than all nodes
- Use parameters for query values
- Apply filters early in the query to reduce processing
- Limit results when working with large datasets

### Performance

- Use appropriate indexes for frequently queried properties
- Avoid returning entire node objects for large results
- Use `EXPLAIN` and `PROFILE` to analyze query performance
- Break complex queries into simpler parts

### Maintainability

- Use meaningful variable names in queries
- Comment complex queries to explain the logic
- Create reusable Cypher procedures for common queries
- Use consistent naming patterns for queries

## Common Use Cases

### Impact Analysis

Analyze the impact of changing a component:

```cypher
// Find what would be affected by changing a module
MATCH (m:Module {name: 'Market Data Service'})
OPTIONAL MATCH (m)<-[:REQUIRES]-(dependent:Module)
OPTIONAL MATCH (m)-[:CONTAINS]->(p:Product)
OPTIONAL MATCH (m)-[:DISPLAYS]->(ui:UI_Area)
RETURN 
  m.name AS module,
  collect(DISTINCT dependent.name) AS dependentModules,
  collect(DISTINCT p.name) AS containedProducts,
  collect(DISTINCT ui.name) AS displayedUIs
```

### Coverage Analysis

Analyze test coverage:

```cypher
// Find components without test coverage
MATCH (m:Module)
WHERE NOT (m)<-[:VALIDATES]-(:TestCase)
RETURN m.name AS untested

// Analyze test coverage for new components
MATCH (m:Module)
WHERE m.name IN ['Market Data Service', 'Order Management', 'Post-Trade Processing']
OPTIONAL MATCH (tc:TestCase)-[:VALIDATES]->(m)
RETURN 
  m.name AS module,
  count(tc) AS testCases,
  collect(tc.name) AS testNames
```

### Dependency Analysis

Analyze dependencies:

```cypher
// Find all dependencies for a module
MATCH path = (m:Module {name: 'Post-Trade Processing'})-[:REQUIRES*]->(dep:Module)
RETURN dep.name AS dependency, length(path) AS distanceFromRoot

// Find shared dependencies between modules
MATCH (m1:Module)-[:REQUIRES]->(shared:Module)<-[:REQUIRES]-(m2:Module)
WHERE m1 <> m2
RETURN m1.name AS module1, m2.name AS module2, shared.name AS sharedDependency
```

## Support

For technical support and questions about queries:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Query Optimization**: For assistance with optimizing complex queries, email kg-performance@360t.com 