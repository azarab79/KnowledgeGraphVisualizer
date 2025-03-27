const neo4j = require('neo4j-driver');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Neo4j connection configuration
const uri = process.env.NEO4J_URI || 'neo4j://localhost:7695';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// Create a Neo4j driver instance with encryption configuration
const driver = neo4j.driver(
  uri, 
  neo4j.auth.basic(user, password),
  {
    encrypted: 'ENCRYPTION_OFF',
    trust: 'TRUST_ALL_CERTIFICATES'
  }
);

async function loadAdditionalData() {
  const session = driver.session();
  
  try {
    console.log('Starting to load additional data into the knowledge graph...');
    
    // Add new modules
    await session.run(`
      CREATE (m1:Module {
        name: 'Market Data Service',
        description: 'Provides real-time market data and historical price information',
        version: '3.2.1',
        owner: 'Data Team',
        status: 'active'
      })
      CREATE (m2:Module {
        name: 'Risk Analytics Engine',
        description: 'Performs risk calculations and stress testing',
        version: '2.5.0',
        owner: 'Risk Management',
        status: 'active'
      })
      CREATE (m3:Module {
        name: 'Compliance Reporter',
        description: 'Generates compliance reports and audit trails',
        version: '1.8.3',
        owner: 'Compliance Team',
        status: 'active'
      })
      RETURN 'Added new modules'
    `);
    console.log('Added new modules');
    
    // Add new products
    await session.run(`
      CREATE (p1:Product {
        name: 'FX Options Analytics',
        description: 'Advanced analytics for FX options pricing and risk',
        product_type: 'Analytics',
        isActive: true
      })
      CREATE (p2:Product {
        name: 'Swap Execution Platform',
        description: 'Trading platform for interest rate and currency swaps',
        product_type: 'Trading',
        isActive: true
      })
      CREATE (p3:Product {
        name: 'Regulatory Reporting Tool',
        description: 'Tool for generating regulatory reports',
        product_type: 'Compliance',
        isActive: true
      })
      RETURN 'Added new products'
    `);
    console.log('Added new products');
    
    // Add workflows
    await session.run(`
      CREATE (w1:Workflow {
        name: 'Option Pricing',
        description: 'End-to-end workflow for pricing options',
        steps: 5,
        avgExecutionTime: 3.2
      })
      CREATE (w2:Workflow {
        name: 'Regulatory Reporting',
        description: 'Process for generating and submitting regulatory reports',
        steps: 8,
        avgExecutionTime: 12.5
      })
      RETURN 'Added workflows'
    `);
    console.log('Added workflows');
    
    // Add UI areas
    await session.run(`
      CREATE (ui1:UI_Area {
        name: 'Trading Dashboard',
        description: 'Main dashboard for traders',
        path: '/trading',
        components: 12
      })
      CREATE (ui2:UI_Area {
        name: 'Risk Monitor',
        description: 'Real-time risk monitoring interface',
        path: '/risk',
        components: 8
      })
      CREATE (ui3:UI_Area {
        name: 'Compliance Dashboard',
        description: 'Dashboard for compliance monitoring',
        path: '/compliance',
        components: 10
      })
      RETURN 'Added UI areas'
    `);
    console.log('Added UI areas');
    
    // Add configuration items
    await session.run(`
      CREATE (c1:ConfigurationItem {
        name: 'Market Data Sources',
        description: 'Configuration for market data providers',
        type: 'system',
        lastUpdated: datetime()
      })
      CREATE (c2:ConfigurationItem {
        name: 'Risk Parameters',
        description: 'Parameters for risk calculations',
        type: 'business',
        lastUpdated: datetime()
      })
      CREATE (c3:ConfigurationItem {
        name: 'Compliance Rules',
        description: 'Rules for regulatory compliance',
        type: 'business',
        lastUpdated: datetime()
      })
      RETURN 'Added configuration items'
    `);
    console.log('Added configuration items');
    
    // Add test cases
    await session.run(`
      CREATE (t1:TestCase {
        name: 'Market Data Integration Test',
        description: 'Tests integration with market data providers',
        status: 'passed',
        lastRun: datetime()
      })
      CREATE (t2:TestCase {
        name: 'Risk Calculation Test',
        description: 'Tests risk calculation algorithms',
        status: 'passed',
        lastRun: datetime()
      })
      CREATE (t3:TestCase {
        name: 'Compliance Report Test',
        description: 'Tests generation of compliance reports',
        status: 'failed',
        lastRun: datetime()
      })
      RETURN 'Added test cases'
    `);
    console.log('Added test cases');
    
    // Establish Module relationships
    await session.run(`
      MATCH (m1:Module {name: 'Market Data Service'})
      MATCH (m2:Module {name: 'Risk Analytics Engine'})
      MATCH (m3:Module {name: 'Compliance Reporter'})
      
      MATCH (p1:Product {name: 'FX Options Analytics'})
      MATCH (p2:Product {name: 'Swap Execution Platform'})
      MATCH (p3:Product {name: 'Regulatory Reporting Tool'})
      
      CREATE (m1)-[:CONTAINS]->(p1)
      CREATE (m1)-[:CONTAINS]->(p2)
      CREATE (m2)-[:CONTAINS]->(p1)
      CREATE (m3)-[:CONTAINS]->(p3)
      
      CREATE (m2)-[:REQUIRES]->(m1)
      CREATE (m3)-[:REQUIRES]->(m1)
      
      RETURN 'Established Module relationships'
    `);
    console.log('Established Module relationships');
    
    // Establish Workflow relationships
    await session.run(`
      MATCH (w1:Workflow {name: 'Option Pricing'})
      MATCH (w2:Workflow {name: 'Regulatory Reporting'})
      
      MATCH (m1:Module {name: 'Market Data Service'})
      MATCH (m2:Module {name: 'Risk Analytics Engine'})
      MATCH (m3:Module {name: 'Compliance Reporter'})
      
      CREATE (w1)-[:USES]->(m1)
      CREATE (w1)-[:USES]->(m2)
      CREATE (w2)-[:USES]->(m1)
      CREATE (w2)-[:USES]->(m3)
      
      RETURN 'Established Workflow relationships'
    `);
    console.log('Established Workflow relationships');
    
    // Establish UI Area relationships
    await session.run(`
      MATCH (ui1:UI_Area {name: 'Trading Dashboard'})
      MATCH (ui2:UI_Area {name: 'Risk Monitor'})
      MATCH (ui3:UI_Area {name: 'Compliance Dashboard'})
      
      CREATE (ui1)-[:NAVIGATES_TO]->(ui2)
      CREATE (ui2)-[:NAVIGATES_TO]->(ui3)
      
      MATCH (m1:Module {name: 'Market Data Service'})
      MATCH (m2:Module {name: 'Risk Analytics Engine'})
      MATCH (m3:Module {name: 'Compliance Reporter'})
      
      CREATE (ui1)-[:DISPLAYS]->(m1)
      CREATE (ui2)-[:DISPLAYS]->(m2)
      CREATE (ui3)-[:DISPLAYS]->(m3)
      
      RETURN 'Established UI Area relationships'
    `);
    console.log('Established UI Area relationships');
    
    // Establish Configuration Item relationships
    await session.run(`
      MATCH (c1:ConfigurationItem {name: 'Market Data Sources'})
      MATCH (c2:ConfigurationItem {name: 'Risk Parameters'})
      MATCH (c3:ConfigurationItem {name: 'Compliance Rules'})
      
      MATCH (m1:Module {name: 'Market Data Service'})
      MATCH (m2:Module {name: 'Risk Analytics Engine'})
      MATCH (m3:Module {name: 'Compliance Reporter'})
      
      CREATE (c1)-[:CONFIGURES_IN]->(m1)
      CREATE (c2)-[:CONFIGURES_IN]->(m2)
      CREATE (c3)-[:CONFIGURES_IN]->(m3)
      
      RETURN 'Established Configuration Item relationships'
    `);
    console.log('Established Configuration Item relationships');
    
    // Establish Test Case relationships
    await session.run(`
      MATCH (t1:TestCase {name: 'Market Data Integration Test'})
      MATCH (t2:TestCase {name: 'Risk Calculation Test'})
      MATCH (t3:TestCase {name: 'Compliance Report Test'})
      
      MATCH (m1:Module {name: 'Market Data Service'})
      MATCH (m2:Module {name: 'Risk Analytics Engine'})
      MATCH (m3:Module {name: 'Compliance Reporter'})
      
      CREATE (t1)-[:VALIDATES]->(m1)
      CREATE (t2)-[:VALIDATES]->(m2)
      CREATE (t3)-[:VALIDATES]->(m3)
      
      RETURN 'Established Test Case relationships'
    `);
    console.log('Established Test Case relationships');
    
    console.log('Successfully loaded all additional data into the knowledge graph');
    
  } catch (error) {
    console.error('Error loading additional data:', error);
    throw new Error(`Failed to load additional data: ${error}`);
  } finally {
    await session.close();
  }
}

// Execute the data loading
loadAdditionalData()
  .then(() => {
    console.log('Additional data loading completed successfully');
    driver.close();
  })
  .catch((error) => {
    console.error(error.message);
    driver.close();
    process.exit(1);
  });

module.exports = { loadAdditionalData }; 