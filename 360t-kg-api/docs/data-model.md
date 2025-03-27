# 360T Knowledge Graph - Data Model Guide

This guide provides a detailed overview of the data model used in the 360T Knowledge Graph.

## Node Types

The 360T Knowledge Graph uses the following node types to represent different components of the system:

### Module

Represents a core functional module in the 360T system.

**Properties:**
- `name`: Unique identifier for the module
- `description`: Detailed description of the module's functionality
- `version`: Current version of the module
- `owner`: Team or individual responsible for the module
- `status`: Current status (e.g., "active", "deprecated")

**Example Cypher:**
```cypher
CREATE (m:Module {
  name: "RFS Live Pricing",
  description: "Provides real-time pricing for Request for Stream workflows",
  version: "2.1.0",
  owner: "Pricing Team",
  status: "active"
})
```

### Product

Represents a product that can be traded on the 360T platform.

**Properties:**
- `name`: Unique identifier for the product
- `description`: Detailed description of the product
- `assetClass`: The asset class the product belongs to
- `isActive`: Boolean indicating if the product is currently active

**Example Cypher:**
```cypher
CREATE (p:Product {
  name: "FX Spot",
  description: "Foreign Exchange Spot trading",
  assetClass: "FX",
  isActive: true
})
```

### Workflow

Represents a business workflow or process.

**Properties:**
- `name`: Unique identifier for the workflow
- `description`: Detailed description of the workflow
- `steps`: Array or string representation of workflow steps
- `avgDuration`: Average duration of the workflow in seconds

**Example Cypher:**
```cypher
CREATE (w:Workflow {
  name: "RFS Trading Workflow",
  description: "End-to-end workflow for RFS trading",
  steps: "Request,Quote,Accept,Execute",
  avgDuration: 45.5
})
```

### UI_Area

Represents a user interface area or screen.

**Properties:**
- `name`: Unique identifier for the UI area
- `description`: Detailed description of the UI area
- `path`: URL path or identifier for the UI
- `accessLevel`: Required access level to view this UI

**Example Cypher:**
```cypher
CREATE (ui:UI_Area {
  name: "Trade Blotter",
  description: "Shows all recent trades and their status",
  path: "/trade-blotter",
  accessLevel: "Trader"
})
```

### ConfigurationItem

Represents a configurable item within the system.

**Properties:**
- `name`: Unique identifier for the configuration item
- `description`: Detailed description of the configuration item
- `defaultValue`: Default value of the configuration
- `allowedValues`: Array or string representation of allowed values
- `isRequired`: Boolean indicating if configuration is required

**Example Cypher:**
```cypher
CREATE (ci:ConfigurationItem {
  name: "MaxRFSTimeout",
  description: "Maximum timeout for RFS quotes in seconds",
  defaultValue: "30",
  allowedValues: "5,10,15,30,60",
  isRequired: true
})
```

### TestCase

Represents a test case for validating functionality.

**Properties:**
- `name`: Unique identifier for the test case
- `description`: Detailed description of the test case
- `testType`: Type of test (e.g., "unit", "integration")
- `status`: Current status (e.g., "passed", "failed")
- `lastRun`: Timestamp of last test run

**Example Cypher:**
```cypher
CREATE (tc:TestCase {
  name: "TC_RFS_001",
  description: "Verify RFS quote request submission",
  testType: "integration",
  status: "passed",
  lastRun: "2023-10-15T14:30:00Z"
})
```

## Relationship Types

The 360T Knowledge Graph uses the following relationship types to represent connections between nodes:

### CONTAINS

Represents a containment relationship, typically indicating that one component contains another.

**Example Cypher:**
```cypher
MATCH (m:Module {name: "RFS Live Pricing"}), (p:Product {name: "FX Spot"})
CREATE (m)-[:CONTAINS]->(p)
```

### DISPLAYS

Represents a relationship where a module displays a UI area.

**Example Cypher:**
```cypher
MATCH (m:Module {name: "RFS Live Pricing"}), (ui:UI_Area {name: "Trade Blotter"})
CREATE (m)-[:DISPLAYS]->(ui)
```

### USES

Represents a usage relationship between components.

**Example Cypher:**
```cypher
MATCH (w:Workflow {name: "RFS Trading Workflow"}), (m:Module {name: "RFS Live Pricing"})
CREATE (w)-[:USES]->(m)
```

### CONFIGURES_IN

Represents a relationship between a configuration item and its parent module.

**Example Cypher:**
```cypher
MATCH (ci:ConfigurationItem {name: "MaxRFSTimeout"}), (m:Module {name: "RFS Live Pricing"})
CREATE (ci)-[:CONFIGURES_IN]->(m)
```

### REQUIRES

Represents a dependency relationship, indicating that one component requires another.

**Example Cypher:**
```cypher
MATCH (m1:Module {name: "Order Management"}), (m2:Module {name: "Market Data Service"})
CREATE (m1)-[:REQUIRES]->(m2)
```

### VALIDATES

Represents a validation relationship between a test case and a component.

**Example Cypher:**
```cypher
MATCH (tc:TestCase {name: "TC_RFS_001"}), (m:Module {name: "RFS Live Pricing"})
CREATE (tc)-[:VALIDATES]->(m)
```

### NAVIGATES_TO

Represents a navigation flow between UI areas.

**Example Cypher:**
```cypher
MATCH (ui1:UI_Area {name: "Trade Blotter"}), (ui2:UI_Area {name: "Trade Details"})
CREATE (ui1)-[:NAVIGATES_TO]->(ui2)
```

### CONNECTS_TO

Represents a connection between modules, indicating system integration points.

**Example Cypher:**
```cypher
MATCH (m1:Module {name: "RFS Live Pricing"}), (m2:Module {name: "Market Data Service"})
CREATE (m1)-[:CONNECTS_TO]->(m2)
```

## Recently Added Components

### New Modules

We've expanded the Knowledge Graph with these additional modules:

- **Market Data Service**: Provides real-time and historical market data
- **Order Management**: Handles order creation, routing, and lifecycle
- **Post-Trade Processing**: Manages confirmations, settlements, and reporting

### New Products

The following products have been added:

- **FX Forward**: Foreign exchange forward contracts
- **FX Swap**: Foreign exchange swap contracts
- **NDF**: Non-deliverable forwards

### New Relationships

Additional relationship patterns:

- **Module Dependencies**: `(Module)-[:REQUIRES]->(Module)`
- **Product Integration**: `(Product)-[:USED_IN]->(Module)`
- **System Integration**: `(Module)-[:CONNECTS_TO]->(Module)`

## Constraints and Indexes

The following constraints ensure data integrity in the graph:

### Unique Constraints

```cypher
CREATE CONSTRAINT module_name_unique FOR (m:Module) REQUIRE m.name IS UNIQUE;
CREATE CONSTRAINT product_name_unique FOR (p:Product) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT workflow_name_unique FOR (w:Workflow) REQUIRE w.name IS UNIQUE;
CREATE CONSTRAINT ui_area_name_unique FOR (ui:UI_Area) REQUIRE ui.name IS UNIQUE;
CREATE CONSTRAINT config_item_name_unique FOR (ci:ConfigurationItem) REQUIRE ci.name IS UNIQUE;
CREATE CONSTRAINT test_case_name_unique FOR (tc:TestCase) REQUIRE tc.name IS UNIQUE;
```

### Property Existence Constraints

```cypher
CREATE CONSTRAINT module_name_exists FOR (m:Module) REQUIRE m.name IS NOT NULL;
CREATE CONSTRAINT product_name_exists FOR (p:Product) REQUIRE p.name IS NOT NULL;
CREATE CONSTRAINT workflow_name_exists FOR (w:Workflow) REQUIRE w.name IS NOT NULL;
CREATE CONSTRAINT ui_area_name_exists FOR (ui:UI_Area) REQUIRE ui.name IS NOT NULL;
CREATE CONSTRAINT config_item_name_exists FOR (ci:ConfigurationItem) REQUIRE ci.name IS NOT NULL;
CREATE CONSTRAINT test_case_name_exists FOR (tc:TestCase) REQUIRE tc.name IS NOT NULL;
```

## Common Queries

### Finding Components Related to a Module

```cypher
MATCH (m:Module {name: "RFS Live Pricing"})-[r]->(n)
RETURN m, r, n;
```

### Finding Test Coverage for a Product

```cypher
MATCH (p:Product {name: "FX Spot"})<-[:CONTAINS]-(m:Module)<-[:VALIDATES]-(tc:TestCase)
RETURN p, m, tc;
```

### Finding Complete UI Navigation Flow

```cypher
MATCH path = (ui1:UI_Area)-[:NAVIGATES_TO*]->(ui2:UI_Area)
WHERE ui1.name = "Trade Blotter"
RETURN path;
```

### Finding Configuration Dependencies

```cypher
MATCH (ci:ConfigurationItem)-[:CONFIGURES_IN]->(m:Module)
WHERE m.name = "RFS Live Pricing"
RETURN ci, m;
```

### Finding Module Dependencies

```cypher
MATCH path = (m:Module)-[:REQUIRES*]->(dep:Module)
WHERE m.name = "Order Management"
RETURN path;
```

## Best Practices

### Node Creation

- Always provide a unique `name` property for each node
- Include descriptive `description` properties for better understanding
- Use consistent naming conventions for node properties

### Relationships

- Create relationships that accurately reflect the system architecture
- Avoid redundant relationships; the graph should be efficient
- Maintain consistent relationship naming conventions

### Properties

- Use consistent data types for properties (e.g., strings, numbers, booleans)
- Use ISO format for date/time properties
- Include version information where applicable

### Queries

- Start queries with specific nodes rather than full scans
- Use parameters in queries rather than string concatenation
- Use appropriate indexes for performance

## Data Maintenance

Regular maintenance ensures the Knowledge Graph remains accurate and performant:

### Regular Tasks

- Review and update node properties as system components evolve
- Validate relationship accuracy when system architecture changes
- Archive test cases and their results periodically

### Data Cleanup

- Remove orphaned nodes (nodes with no relationships)
- Ensure all required properties are present on nodes
- Fix inconsistent relationship patterns

## Support

For technical support and questions about the data model:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Data Model Changes**: Propose changes through the established change management process 