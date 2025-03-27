// Script to expand the 360T Knowledge Graph with additional modules and components
const neo4j = require('neo4j-driver');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Neo4j connection configuration
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// Create a Neo4j driver instance
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function loadAdditionalData() {
  const session = driver.session();
  
  try {
    console.log('Starting to load additional data into the knowledge graph...');
    
    // 1. Create new Modules
    await session.run(`
      CREATE (mds:Module {
        name: 'Market Data Service',
        description: 'Provides real-time and historical market data',
        version: '3.2.1',
        owner: 'Market Data Team',
        status: 'active'
      })
      CREATE (om:Module {
        name: 'Order Management',
        description: 'Handles order creation, routing, and lifecycle',
        version: '2.7.0',
        owner: 'Trading Core Team',
        status: 'active'
      })
      CREATE (ptp:Module {
        name: 'Post-Trade Processing',
        description: 'Manages confirmations, settlements, and reporting',
        version: '1.9.5',
        owner: 'Post-Trade Team',
        status: 'active'
      })
    `);
    console.log('Added new modules');
    
    // 2. Create new Products
    await session.run(`
      CREATE (fxf:Product {
        name: 'FX Forward',
        description: 'Foreign exchange forward contracts',
        product_type: 'FX',
        isActive: true
      })
      CREATE (fxs:Product {
        name: 'FX Swap',
        description: 'Foreign exchange swap contracts',
        product_type: 'FX',
        isActive: true
      })
      CREATE (ndf:Product {
        name: 'NDF',
        description: 'Non-deliverable forwards',
        product_type: 'FX',
        isActive: true
      })
    `);
    console.log('Added new products');
    
    // 3. Create new Workflows
    await session.run(`
      CREATE (fxfw:Workflow {
        name: 'FX Forward Trading',
        description: 'End-to-end workflow for FX Forward trading',
        steps: 'Request,Quote,Accept,Execute,Confirm',
        avgDuration: 75.2
      })
      CREATE (ndfflow:Workflow {
        name: 'NDF Trading',
        description: 'End-to-end workflow for NDF trading',
        steps: 'Request,Quote,Accept,Execute,Confirm,Settle',
        avgDuration: 90.8
      })
    `);
    console.log('Added new workflows');
    
    // 4. Create new UI Areas
    await session.run(`
      CREATE (book:UI_Area {
        name: 'Order Book',
        description: 'Displays all active orders and their status',
        path: '/order-book',
        accessLevel: 'Trader'
      })
      CREATE (ptscreen:UI_Area {
        name: 'Post-Trade Overview',
        description: 'Shows all trades requiring post-trade actions',
        path: '/post-trade',
        accessLevel: 'Operations'
      })
      CREATE (mdpanel:UI_Area {
        name: 'Market Data Panel',
        description: 'Displays real-time market data and charts',
        path: '/market-data',
        accessLevel: 'All'
      })
    `);
    console.log('Added new UI areas');
    
    // 5. Create new Configuration Items
    await session.run(`
      CREATE (omconfig:ConfigurationItem {
        name: 'OrderRoutingRules',
        description: 'Rules for order routing based on product and size',
        defaultValue: 'Default',
        allowedValues: 'Default,Direct,STP,Manual',
        isRequired: true
      })
      CREATE (mdsrefresh:ConfigurationItem {
        name: 'MDSRefreshRate',
        description: 'Refresh rate for market data in milliseconds',
        defaultValue: '1000',
        allowedValues: '500,1000,2000,5000',
        isRequired: true
      })
    `);
    console.log('Added new configuration items');
    
    // 6. Create new Test Cases
    await session.run(`
      CREATE (tc1:TestCase {
        name: 'TC_OM_001',
        description: 'Verify order submission for FX Forward',
        testType: 'integration',
        status: 'passed',
        lastRun: '2023-10-20T10:15:00Z'
      })
      CREATE (tc2:TestCase {
        name: 'TC_MDS_001',
        description: 'Verify market data feed connection',
        testType: 'integration',
        status: 'passed',
        lastRun: '2023-10-21T09:30:00Z'
      })
      CREATE (tc3:TestCase {
        name: 'TC_PTP_001',
        description: 'Verify trade confirmation generation',
        testType: 'system',
        status: 'failed',
        lastRun: '2023-10-22T11:45:00Z'
      })
    `);
    console.log('Added new test cases');
    
    // 7. Establish relationships for Modules and Products
    await session.run(`
      MATCH (mds:Module {name: 'Market Data Service'})
      MATCH (om:Module {name: 'Order Management'})
      MATCH (ptp:Module {name: 'Post-Trade Processing'})
      MATCH (rfs:Module {name: 'RFS Live Pricing'})
      
      MATCH (fxf:Product {name: 'FX Forward'})
      MATCH (fxs:Product {name: 'FX Swap'})
      MATCH (ndf:Product {name: 'NDF'})
      
      // Module contains products
      CREATE (om)-[:CONTAINS]->(fxf)
      CREATE (om)-[:CONTAINS]->(fxs)
      CREATE (om)-[:CONTAINS]->(ndf)
      
      // Module dependencies
      CREATE (om)-[:REQUIRES]->(mds)
      CREATE (rfs)-[:REQUIRES]->(mds)
      CREATE (ptp)-[:REQUIRES]->(om)
      
      // Module connections
      CREATE (rfs)-[:CONNECTS_TO]->(mds)
      CREATE (rfs)-[:CONNECTS_TO]->(om)
      CREATE (om)-[:CONNECTS_TO]->(ptp)
    `);
    console.log('Established Module relationships');
    
    // 8. Establish relationships for UI Areas
    await session.run(`
      MATCH (mds:Module {name: 'Market Data Service'})
      MATCH (om:Module {name: 'Order Management'})
      MATCH (ptp:Module {name: 'Post-Trade Processing'})
      
      MATCH (book:UI_Area {name: 'Order Book'})
      MATCH (ptscreen:UI_Area {name: 'Post-Trade Overview'})
      MATCH (mdpanel:UI_Area {name: 'Market Data Panel'})
      MATCH (tb:UI_Area {name: 'Trade Blotter'})
      
      // Module displays UI areas
      CREATE (om)-[:DISPLAYS]->(book)
      CREATE (ptp)-[:DISPLAYS]->(ptscreen)
      CREATE (mds)-[:DISPLAYS]->(mdpanel)
      
      // UI navigation
      CREATE (tb)-[:NAVIGATES_TO]->(book)
      CREATE (book)-[:NAVIGATES_TO]->(ptscreen)
      CREATE (book)-[:NAVIGATES_TO]->(mdpanel)
    `);
    console.log('Established UI Area relationships');
    
    // 9. Establish relationships for Configuration Items
    await session.run(`
      MATCH (mds:Module {name: 'Market Data Service'})
      MATCH (om:Module {name: 'Order Management'})
      
      MATCH (omconfig:ConfigurationItem {name: 'OrderRoutingRules'})
      MATCH (mdsrefresh:ConfigurationItem {name: 'MDSRefreshRate'})
      
      // Connect configuration items to modules
      CREATE (omconfig)-[:CONFIGURES_IN]->(om)
      CREATE (mdsrefresh)-[:CONFIGURES_IN]->(mds)
    `);
    console.log('Established Configuration Item relationships');
    
    // 10. Establish relationships for Test Cases
    await session.run(`
      MATCH (mds:Module {name: 'Market Data Service'})
      MATCH (om:Module {name: 'Order Management'})
      MATCH (ptp:Module {name: 'Post-Trade Processing'})
      
      MATCH (tc1:TestCase {name: 'TC_OM_001'})
      MATCH (tc2:TestCase {name: 'TC_MDS_001'})
      MATCH (tc3:TestCase {name: 'TC_PTP_001'})
      
      // Connect test cases to modules
      CREATE (tc1)-[:VALIDATES]->(om)
      CREATE (tc2)-[:VALIDATES]->(mds)
      CREATE (tc3)-[:VALIDATES]->(ptp)
    `);
    console.log('Established Test Case relationships');
    
    // 11. Establish Workflow relationships
    await session.run(`
      MATCH (om:Module {name: 'Order Management'})
      MATCH (mds:Module {name: 'Market Data Service'})
      MATCH (ptp:Module {name: 'Post-Trade Processing'})
      
      MATCH (fxfw:Workflow {name: 'FX Forward Trading'})
      MATCH (ndfflow:Workflow {name: 'NDF Trading'})
      
      // Connect workflows to modules
      CREATE (fxfw)-[:USES]->(om)
      CREATE (fxfw)-[:USES]->(mds)
      CREATE (ndfflow)-[:USES]->(om)
      CREATE (ndfflow)-[:USES]->(mds)
      CREATE (ndfflow)-[:USES]->(ptp)
    `);
    console.log('Established Workflow relationships');
    
    console.log('Successfully loaded all additional data into the knowledge graph');
    
  } catch (error) {
    console.error('Error loading additional data:', error);
    throw new Error(`Failed to load additional data: ${error}`);
  } finally {
    await session.close();
  }
}

// Execute the data loading function
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