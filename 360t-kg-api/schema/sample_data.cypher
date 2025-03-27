// Sample data for 360T Knowledge Graph

// Clear existing data
MATCH (n) DETACH DELETE n;

// Create all nodes first
CREATE (m1:Module {
    name: 'RFS Live Pricing',
    description: 'Handles Request-for-Stream pricing and execution workflow',
    version: '4.17',
    guide_page_ref: '/docs/rfs-pricing'
});

CREATE (p1:Product {
    name: 'FX Spot',
    description: 'Foreign Exchange Spot trading product',
    product_type: 'FX',
    guide_page_ref: '/docs/fx-spot'
});

CREATE (w1:Workflow {
    name: 'Standard RFS Request',
    description: 'Standard workflow for requesting and executing RFS quotes',
    steps: ['Select Product', 'Configure Trade Parameters', 'Send RFS', 'Receive Quotes', 'Execute Trade']
});

CREATE (ui1:UI_Area {
    name: 'Live Pricing Panel',
    description: 'Main panel for viewing and interacting with live prices',
    location: 'Main Trading Screen'
});

CREATE (ui2:UI_Area {
    name: 'Product Definition Window',
    description: 'Window for configuring product-specific parameters',
    location: 'Configuration Screen'
});

CREATE (c1:ConfigurationItem {
    name: 'Provider List Config',
    description: 'Configuration for available liquidity providers',
    default_value: 'All Providers',
    type: 'List'
});

CREATE (c2:ConfigurationItem {
    name: 'MiFID Checkbox Default',
    description: 'Default setting for MiFID consent checkbox',
    default_value: 'true',
    type: 'Boolean'
});

CREATE (t1:TestCase {
    test_case_id: 'TC-RFS-001',
    name: 'Basic RFS Flow',
    description: 'Verify basic RFS workflow with default settings',
    priority: 'High',
    automation_status: 'Automated'
});

CREATE (t2:TestCase {
    test_case_id: 'TC-RFS-002',
    name: 'Provider Selection',
    description: 'Verify provider selection affects available quotes',
    priority: 'Medium',
    automation_status: 'Manual'
});

// Create relationships in a single transaction
MATCH 
    (m1:Module {name: 'RFS Live Pricing'}),
    (w1:Workflow {name: 'Standard RFS Request'}),
    (p1:Product {name: 'FX Spot'}),
    (ui1:UI_Area {name: 'Live Pricing Panel'}),
    (ui2:UI_Area {name: 'Product Definition Window'}),
    (c1:ConfigurationItem {name: 'Provider List Config'}),
    (c2:ConfigurationItem {name: 'MiFID Checkbox Default'}),
    (t1:TestCase {test_case_id: 'TC-RFS-001'}),
    (t2:TestCase {test_case_id: 'TC-RFS-002'})
CREATE
    (m1)-[:CONTAINS]->(w1),
    (m1)-[:DISPLAYS]->(ui1),
    (w1)-[:USES]->(p1),
    (p1)-[:CONFIGURES_IN]->(ui2),
    (w1)-[:USES]->(c1),
    (p1)-[:REQUIRES]->(c2),
    (t1)-[:VALIDATES]->(w1),
    (t2)-[:VALIDATES]->(c1),
    (ui1)-[:NAVIGATES_TO]->(ui2); 