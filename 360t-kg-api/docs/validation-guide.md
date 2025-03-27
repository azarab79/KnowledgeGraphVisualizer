# 360T Knowledge Graph - Validation Guide

This guide provides comprehensive instructions for validating data integrity in the 360T Knowledge Graph.

## Overview

Data validation ensures the accuracy, consistency, and reliability of your knowledge graph. The 360T Knowledge Graph validation system checks for data integrity issues, identifies potential problems, and provides actionable recommendations for fixing them.

## Validation Components

The validation system includes:

1. **Validation Script**: `validateData.js` - Executes validation rules against the Neo4j database
2. **Validation Rules**: A set of rules that check data integrity and quality
3. **Reporting**: JSON and HTML reports detailing validation results
4. **Visualization**: Graphical representation of validation issues

## Running the Validation Script

### Basic Usage

To run the validation script:

```bash
npm run validate-data
```

This executes the script at `360t-kg-api/scripts/validateData.js`, which performs all validation checks and generates comprehensive reports.

### Configuration Options

The validation script uses environment variables for configuration:

```
# Neo4j Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Validation Configuration
VALIDATION_REPORT_DIR=reports
VALIDATION_RULES=all  # or comma-separated list of rule IDs
VALIDATION_SEVERITY_THRESHOLD=low  # low, medium, or high
```

You can modify these in your `.env` file or set them directly in your environment.

## Validation Rules

The validation script includes 10 core validation rules:

### 1. Required Properties Check

Validates that nodes have all required properties.

**Rule ID**: `required-properties`

```javascript
// Example implementation
async function validateRequiredProperties(session) {
  const requiredProperties = {
    Module: ['name', 'description', 'version'],
    Product: ['name', 'description', 'assetClass'],
    Workflow: ['name', 'description', 'steps'],
    UI_Area: ['name', 'description', 'path'],
    ConfigurationItem: ['name', 'description', 'defaultValue'],
    TestCase: ['name', 'description', 'testType', 'status']
  };
  
  let issues = [];
  
  for (const [label, properties] of Object.entries(requiredProperties)) {
    for (const property of properties) {
      const result = await session.run(`
        MATCH (n:${label})
        WHERE n.${property} IS NULL OR n.${property} = ""
        RETURN n.name AS name
      `);
      
      for (const record of result.records) {
        issues.push({
          ruleId: 'required-properties',
          severity: 'high',
          label,
          name: record.get('name'),
          property,
          message: `${label} node missing required property: ${property}`
        });
      }
    }
  }
  
  return issues;
}
```

### 2. Orphaned Nodes Check

Identifies nodes with no relationships.

**Rule ID**: `orphaned-nodes`

```javascript
async function validateOrphanedNodes(session) {
  const result = await session.run(`
    MATCH (n)
    WHERE NOT (n)--()
    RETURN labels(n) AS labels, n.name AS name
  `);
  
  return result.records.map(record => ({
    ruleId: 'orphaned-nodes',
    severity: 'medium',
    label: record.get('labels')[0],
    name: record.get('name'),
    message: `Orphaned ${record.get('labels')[0]} node: ${record.get('name')}`
  }));
}
```

### 3. Invalid Relationships Check

Ensures relationships connect appropriate node types.

**Rule ID**: `invalid-relationships`

```javascript
async function validateInvalidRelationships(session) {
  const validRelationships = [
    { start: 'Module', relationship: 'CONTAINS', end: 'Product' },
    { start: 'Module', relationship: 'DISPLAYS', end: 'UI_Area' },
    { start: 'Module', relationship: 'REQUIRES', end: 'Module' },
    { start: 'Module', relationship: 'CONNECTS_TO', end: 'Module' },
    { start: 'Workflow', relationship: 'USES', end: 'Module' },
    { start: 'ConfigurationItem', relationship: 'CONFIGURES_IN', end: 'Module' },
    { start: 'TestCase', relationship: 'VALIDATES', end: 'Module' },
    { start: 'UI_Area', relationship: 'NAVIGATES_TO', end: 'UI_Area' }
  ];
  
  let issues = [];
  
  for (const { start, relationship, end } of validRelationships) {
    const result = await session.run(`
      MATCH (a)-[r:${relationship}]->(b)
      WHERE NOT a:${start} OR NOT b:${end}
      RETURN labels(a) AS startLabels, a.name AS startName, 
             labels(b) AS endLabels, b.name AS endName
    `);
    
    for (const record of result.records) {
      issues.push({
        ruleId: 'invalid-relationships',
        severity: 'high',
        startLabel: record.get('startLabels')[0],
        startName: record.get('startName'),
        relationship,
        endLabel: record.get('endLabels')[0],
        endName: record.get('endName'),
        message: `Invalid relationship: ${record.get('startLabels')[0]}(${record.get('startName')})-[${relationship}]->${record.get('endLabels')[0]}(${record.get('endName')})`
      });
    }
  }
  
  return issues;
}
```

### 4. Circular Dependencies Check

Detects circular dependencies between modules.

**Rule ID**: `circular-dependencies`

```javascript
async function validateCircularDependencies(session) {
  const result = await session.run(`
    MATCH path = (m:Module)-[:REQUIRES*2..10]->(m)
    RETURN [node IN nodes(path) | node.name] AS cycle
  `);
  
  return result.records.map(record => {
    const cycle = record.get('cycle');
    return {
      ruleId: 'circular-dependencies',
      severity: 'high',
      modules: cycle,
      message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`
    };
  });
}
```

### 5. Naming Convention Check

Ensures nodes follow naming conventions.

**Rule ID**: `naming-conventions`

```javascript
async function validateNamingConventions(session) {
  const namingRules = {
    Module: /^[A-Z][a-zA-Z0-9\s]+$/,
    Product: /^[A-Z][a-zA-Z0-9\s]+$/,
    TestCase: /^TC_[A-Z0-9_]+$/
  };
  
  let issues = [];
  
  for (const [label, pattern] of Object.entries(namingRules)) {
    const result = await session.run(`
      MATCH (n:${label})
      WHERE NOT n.name =~ $pattern
      RETURN n.name AS name
    `, { pattern: pattern.source });
    
    for (const record of result.records) {
      issues.push({
        ruleId: 'naming-conventions',
        severity: 'low',
        label,
        name: record.get('name'),
        pattern: pattern.source,
        message: `${label} name does not follow convention: ${record.get('name')}`
      });
    }
  }
  
  return issues;
}
```

### 6. Duplicate Nodes Check

Identifies potentially duplicate nodes.

**Rule ID**: `duplicate-nodes`

```javascript
async function validateDuplicateNodes(session) {
  const result = await session.run(`
    MATCH (n1)
    MATCH (n2)
    WHERE id(n1) < id(n2)
      AND labels(n1) = labels(n2)
      AND n1.name = n2.name
    RETURN labels(n1) AS labels, n1.name AS name
  `);
  
  return result.records.map(record => ({
    ruleId: 'duplicate-nodes',
    severity: 'high',
    label: record.get('labels')[0],
    name: record.get('name'),
    message: `Duplicate ${record.get('labels')[0]} nodes with name: ${record.get('name')}`
  }));
}
```

### 7. Missing Test Coverage Check

Identifies modules without test coverage.

**Rule ID**: `missing-test-coverage`

```javascript
async function validateTestCoverage(session) {
  const result = await session.run(`
    MATCH (m:Module)
    WHERE NOT (m)<-[:VALIDATES]-(:TestCase)
    RETURN m.name AS name
  `);
  
  return result.records.map(record => ({
    ruleId: 'missing-test-coverage',
    severity: 'medium',
    module: record.get('name'),
    message: `Module has no test coverage: ${record.get('name')}`
  }));
}
```

### 8. Incomplete UI Navigation Check

Identifies UI areas with missing navigation paths.

**Rule ID**: `incomplete-ui-navigation`

```javascript
async function validateUiNavigation(session) {
  const result = await session.run(`
    MATCH (ui:UI_Area)
    WHERE NOT (ui)-[:NAVIGATES_TO]->() AND NOT ()-[:NAVIGATES_TO]->(ui)
    RETURN ui.name AS name
  `);
  
  return result.records.map(record => ({
    ruleId: 'incomplete-ui-navigation',
    severity: 'low',
    uiArea: record.get('name'),
    message: `UI Area is disconnected from navigation: ${record.get('name')}`
  }));
}
```

### 9. Reference Integrity Check

Ensures relationship references point to existing nodes.

**Rule ID**: `reference-integrity`

```javascript
async function validateReferenceIntegrity(session) {
  // This would be implemented differently in Neo4j because relationships
  // cannot exist without their nodes, but this example shows the concept
  const result = await session.run(`
    MATCH (a)-[r]->(b)
    WHERE a IS NULL OR b IS NULL
    RETURN type(r) AS relType, id(r) AS relId
  `);
  
  return result.records.map(record => ({
    ruleId: 'reference-integrity',
    severity: 'high',
    relType: record.get('relType'),
    relId: record.get('relId').toNumber(),
    message: `Relationship with broken references: ${record.get('relType')} (ID: ${record.get('relId').toNumber()})`
  }));
}
```

### 10. Data Format Check

Validates data formats for specific properties.

**Rule ID**: `data-format`

```javascript
async function validateDataFormat(session) {
  const formatRules = [
    { 
      label: 'TestCase', 
      property: 'lastRun', 
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
      message: 'should be ISO date format (YYYY-MM-DDThh:mm:ss.sssZ)'
    },
    { 
      label: 'Module', 
      property: 'version', 
      pattern: /^\d+\.\d+(\.\d+)?$/,
      message: 'should be semantic version format (e.g., 1.2.3)'
    }
  ];
  
  let issues = [];
  
  for (const { label, property, pattern, message } of formatRules) {
    const result = await session.run(`
      MATCH (n:${label})
      WHERE n.${property} IS NOT NULL AND NOT n.${property} =~ $pattern
      RETURN n.name AS name, n.${property} AS value
    `, { pattern: pattern.source });
    
    for (const record of result.records) {
      issues.push({
        ruleId: 'data-format',
        severity: 'medium',
        label,
        name: record.get('name'),
        property,
        value: record.get('value'),
        message: `Invalid format for ${label}.${property}: ${record.get('value')} ${message}`
      });
    }
  }
  
  return issues;
}
```

## Validation Reports

### JSON Report

The validation script generates a JSON report at `360t-kg-api/reports/validation-report.json`. This report includes:

```json
{
  "timestamp": "2023-05-15T14:30:00.000Z",
  "summary": {
    "totalIssues": 12,
    "highSeverity": 3,
    "mediumSeverity": 5,
    "lowSeverity": 4
  },
  "issues": [
    {
      "ruleId": "required-properties",
      "severity": "high",
      "label": "Module",
      "name": "Market Data Service",
      "property": "description",
      "message": "Module node missing required property: description"
    },
    {
      "ruleId": "orphaned-nodes",
      "severity": "medium",
      "label": "Product",
      "name": "NDF",
      "message": "Orphaned Product node: NDF"
    },
    // Other issues...
  ]
}
```

### HTML Report

The script also generates an HTML report at `360t-kg-api/reports/validation-report.html`, which provides a user-friendly visualization of the validation issues.

The HTML report includes:

- Summary statistics
- Filtering options by severity and rule type
- Grouping by node type
- Interactive visualizations
- Actionable recommendations for fixing issues

## Interpreting Validation Results

### Severity Levels

The validation system defines three severity levels:

1. **High**: Critical issues that should be fixed immediately
   - Examples: Missing required properties, invalid relationships, duplicate nodes

2. **Medium**: Important issues that should be addressed soon
   - Examples: Orphaned nodes, missing test coverage, data format issues

3. **Low**: Minor issues that should be considered
   - Examples: Naming convention violations, incomplete UI navigation

### Common Issue Types

#### Missing Properties

Missing required properties can cause application errors and incomplete visualizations.

**Fix**: Add the missing properties to the identified nodes:

```cypher
MATCH (m:Module {name: 'Market Data Service'})
SET m.description = 'Provides real-time and historical market data'
```

#### Orphaned Nodes

Orphaned nodes (nodes without relationships) represent disconnected data.

**Fix**: Either connect these nodes to the graph or remove them if they are no longer needed:

```cypher
// Connect the node
MATCH (p:Product {name: 'NDF'})
MATCH (m:Module {name: 'Post-Trade Processing'})
CREATE (m)-[:CONTAINS]->(p)

// Or remove it if not needed
MATCH (p:Product {name: 'NDF'})
WHERE NOT (p)--()
DELETE p
```

#### Invalid Relationships

Relationships between incompatible node types can cause logic errors.

**Fix**: Replace the invalid relationship with the correct one:

```cypher
// Remove incorrect relationship
MATCH (a:UI_Area {name: 'Trade Blotter'})-[r:REQUIRES]->(b:Module {name: 'RFS Live Pricing'})
DELETE r

// Create correct relationship
MATCH (a:UI_Area {name: 'Trade Blotter'})
MATCH (b:Module {name: 'RFS Live Pricing'})
CREATE (a)-[:DISPLAYS_IN]->(b)
```

#### Circular Dependencies

Circular dependencies can cause infinite loops and logical problems.

**Fix**: Break the circular dependency by removing one of the relationships:

```cypher
MATCH (m1:Module {name: 'Order Management'})-[r:REQUIRES]->(m2:Module {name: 'Market Data Service'})
WHERE EXISTS((m2)-[:REQUIRES*]->({name: 'Order Management'}))
DELETE r
```

## Running Validation During Development

### Pre-commit Validation

Set up a pre-commit hook to validate data before committing changes:

```bash
#!/bin/bash
# .git/hooks/pre-commit

cd /path/to/360t-kg-api
npm run validate-data

if [ $? -ne 0 ]; then
  echo "Validation failed. Please fix the issues before committing."
  exit 1
fi
```

### Continuous Integration

Integrate validation into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Validate Knowledge Graph

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Set up Neo4j
      run: docker run -d -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5.0
    - name: Install dependencies
      run: npm ci
    - name: Load test data
      run: npm run load-test-data
    - name: Validate data
      run: npm run validate-data
```

## Custom Validation Rules

### Creating Custom Rules

To add a custom validation rule:

1. Open `360t-kg-api/scripts/validateData.js`
2. Add your custom rule function:

```javascript
async function validateCustomRule(session) {
  console.log('Running custom validation rule...');
  
  try {
    const result = await session.run(`
      // Your Cypher query here
      MATCH (n:CustomNode)
      WHERE n.customProperty IS NULL
      RETURN n.name AS name
    `);
    
    return result.records.map(record => ({
      ruleId: 'custom-rule',
      severity: 'medium',
      name: record.get('name'),
      message: `Custom validation issue with node: ${record.get('name')}`
    }));
  } catch (error) {
    console.error('Error in custom validation rule:', error);
    return [{
      ruleId: 'custom-rule',
      severity: 'high',
      message: `Error executing custom rule: ${error.message}`
    }];
  }
}

// Add your rule to the rules array
const rules = [
  // Existing rules...
  { id: 'custom-rule', name: 'Custom Rule', fn: validateCustomRule }
];
```

### Rule Configuration

Configure which rules to run in the `.env` file:

```
# Run all rules
VALIDATION_RULES=all

# Run specific rules
VALIDATION_RULES=required-properties,orphaned-nodes,custom-rule

# Exclude specific rules
VALIDATION_RULES=all,-naming-conventions,-data-format
```

## Best Practices

### Data Validation Frequency

- **During development**: Run validation before committing changes
- **In CI/CD pipeline**: Validate data on every pull request
- **Production**: Schedule regular validation (daily or weekly)

### Fixing Validation Issues

1. **Prioritize by severity**: Fix high-severity issues first
2. **Group similar issues**: Fix similar issues together
3. **Automate fixes when possible**: Create scripts for common fixes
4. **Document exceptions**: If some issues are acceptable, document why

### Extending Validation

- Review validation results regularly to identify new rule patterns
- Add custom rules for domain-specific validations
- Consider statistical validation for detecting outliers or anomalies

## Support

For technical support and questions about data validation:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Validation Rule Suggestions**: Email validation-rules@360t.com 