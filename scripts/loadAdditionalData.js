const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function loadAdditionalData() {
    const session = driver.session();
    try {
        console.log('Starting to load additional data into the knowledge graph...');

        // Add modules
        await session.run(`
            MERGE (mds:Module {name: 'Market Data Service', type: 'service', version: '1.0'})
            MERGE (fx:Module {name: 'FX Spot', type: 'trading', version: '2.1'})
            MERGE (rfs:Module {name: 'RFS Live Pricing', type: 'pricing', version: '1.5'})
            MERGE (bfs:Module {name: 'Basic FX Service', type: 'service', version: '1.2'})
            MERGE (ps:Module {name: 'Provider Service', type: 'service', version: '1.0'})
            MERGE (mb:Module {name: 'Market Book Service', type: 'service', version: '1.1'})
        `);
        console.log('Added new modules');

        // Add products
        await session.run(`
            MERGE (pd:Product {name: 'Product Default', product_type: 'Default'})
            MERGE (lpp:Product {name: 'Live Pricing Panel', product_type: 'Panel'})
        `);
        console.log('Added new products');

        // Add workflows
        await session.run(`
            MERGE (w1:Workflow {name: 'Standard RFS Req'})
        `);
        console.log('Added new workflows');

        // Add UI areas
        await session.run(`
            MERGE (menu:UI_Area {name: 'Menu Navigation Today'})
            MERGE (basic:UI_Area {name: 'Basic Form'})
        `);
        console.log('Added new UI areas');

        // Add configuration items
        await session.run(`
            MERGE (ci1:ConfigurationItem {name: 'Provider Select'})
            MERGE (ci2:ConfigurationItem {name: 'Provider Profile'})
        `);
        console.log('Added new configuration items');

        // Add test cases with test_case_id
        await session.run(`
            MERGE (tc1:TestCase {test_case_id: 'TC-MDS-001'})
            ON CREATE SET tc1.name = 'Market Data Setup',
                         tc1.description = 'Verify market data setup process',
                         tc1.priority = 'High',
                         tc1.automation_status = 'Automated'
        `);
        await session.run(`
            MERGE (tc2:TestCase {test_case_id: 'TC-PT-001'})
            ON CREATE SET tc2.name = 'Post Trade',
                         tc2.description = 'Verify post-trade workflow',
                         tc2.priority = 'Medium',
                         tc2.automation_status = 'Manual'
        `);
        console.log('Added test cases');

        // Create relationships one by one
        await session.run(`
            MATCH (pd:Product {name: 'Product Default'})
            MATCH (lpp:Product {name: 'Live Pricing Panel'})
            MERGE (pd)-[:NAVIGATES_TO]->(lpp)
        `);
        await session.run(`
            MATCH (pd:Product {name: 'Product Default'})
            MATCH (ci1:ConfigurationItem {name: 'Provider Select'})
            MERGE (pd)-[:CONFIGURES_IN]->(ci1)
        `);
        await session.run(`
            MATCH (lpp:Product {name: 'Live Pricing Panel'})
            MATCH (rfs:Module {name: 'RFS Live Pricing'})
            MERGE (lpp)-[:DISPLAYS]->(rfs)
        `);
        await session.run(`
            MATCH (mds:Module {name: 'Market Data Service'})
            MATCH (bfs:Module {name: 'Basic FX Service'})
            MERGE (mds)-[:REQUIRES]->(bfs)
        `);
        await session.run(`
            MATCH (fx:Module {name: 'FX Spot'})
            MATCH (ps:Module {name: 'Provider Service'})
            MERGE (fx)-[:USES]->(ps)
        `);
        await session.run(`
            MATCH (w1:Workflow {name: 'Standard RFS Req'})
            MATCH (basic:UI_Area {name: 'Basic Form'})
            MERGE (w1)-[:CONTAINS]->(basic)
        `);
        await session.run(`
            MATCH (tc1:TestCase {test_case_id: 'TC-MDS-001'})
            MATCH (mds:Module {name: 'Market Data Service'})
            MERGE (tc1)-[:VALIDATES]->(mds)
        `);
        await session.run(`
            MATCH (tc2:TestCase {test_case_id: 'TC-PT-001'})
            MATCH (fx:Module {name: 'FX Spot'})
            MERGE (tc2)-[:VALIDATES]->(fx)
        `);
        await session.run(`
            MATCH (ci2:ConfigurationItem {name: 'Provider Profile'})
            MATCH (ps:Module {name: 'Provider Service'})
            MERGE (ci2)-[:USES]->(ps)
        `);
        console.log('Created relationships');

        console.log('Additional data loaded successfully.');
    } catch (error) {
        console.error('Error loading additional data:', error);
        throw error;
    } finally {
        await session.close();
        await driver.close();
    }
}

// Execute the load operation
loadAdditionalData()
    .then(() => {
        console.log('Data loading completed.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to load additional data:', error);
        process.exit(1);
    }); 