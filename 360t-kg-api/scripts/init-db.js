const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
require('dotenv').config();

const {
    NEO4J_URI = 'neo4j://localhost:7695',
    NEO4J_USER = 'neo4j',
    NEO4J_PASSWORD
} = process.env;

if (!NEO4J_PASSWORD) {
    console.error('Error: NEO4J_PASSWORD environment variable is required');
    process.exit(1);
}

const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

async function executeQueries(session, queries) {
    for (const query of queries) {
        if (query.trim()) {
            try {
                await session.run(query);
            } catch (error) {
                console.error(`Error executing query: ${query}`);
                throw error;
            }
        }
    }
}

async function dropAllConstraints(session) {
    const constraints = await session.run('SHOW CONSTRAINTS');
    for (const record of constraints.records) {
        const name = record.get('name');
        if (name) {
            await session.run(`DROP CONSTRAINT ${name}`);
        }
    }
}

async function dropAllIndexes(session) {
    const indexes = await session.run('SHOW INDEXES');
    for (const record of indexes.records) {
        const name = record.get('name');
        if (name) {
            await session.run(`DROP INDEX ${name}`);
        }
    }
}

async function initializeDatabase() {
    const session = driver.session();
    try {
        // Drop all constraints and indexes first
        console.log('Dropping existing constraints and indexes...');
        await dropAllConstraints(session);
        await dropAllIndexes(session);
        console.log('Existing constraints and indexes dropped');

        // Clear existing data
        console.log('Clearing existing data...');
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('Existing data cleared');

        // Read and execute constraints
        console.log('Applying constraints...');
        const constraintsQuery = fs.readFileSync(
            path.join(__dirname, '..', 'schema', 'constraints.cypher'),
            'utf8'
        );
        const constraintQueries = constraintsQuery.split(';').map(q => q.trim()).filter(q => q);
        await executeQueries(session, constraintQueries);
        console.log('Constraints applied successfully');

        // Load sample data
        console.log('Loading sample data...');
        const sampleDataQuery = fs.readFileSync(
            path.join(__dirname, '..', 'schema', 'sample_data.cypher'),
            'utf8'
        );
        const sampleDataQueries = sampleDataQuery.split(';').map(q => q.trim()).filter(q => q);
        await executeQueries(session, sampleDataQueries);
        console.log('Sample data loaded successfully');

        // Load additional data
        console.log('Loading additional data...');
        await session.run(`
            MERGE (mds:Module {name: 'Market Data Service'})
            ON CREATE SET mds.type = 'service', mds.version = '1.0'
            
            MERGE (fx:Module {name: 'FX Spot'})
            ON CREATE SET fx.type = 'trading', fx.version = '2.1'
            
            MERGE (bfs:Module {name: 'Basic FX Service'})
            ON CREATE SET bfs.type = 'service', bfs.version = '1.2'
            
            MERGE (ps:Module {name: 'Provider Service'})
            ON CREATE SET ps.type = 'service', ps.version = '1.0'
            
            MERGE (mb:Module {name: 'Market Book Service'})
            ON CREATE SET mb.type = 'service', mb.version = '1.1'
        `);
        await session.run(`
            MERGE (pd:Product {name: 'Product Default'})
            ON CREATE SET pd.product_type = 'Default'
            
            MERGE (lpp:Product {name: 'Live Pricing Panel'})
            ON CREATE SET lpp.product_type = 'Panel'
        `);
        await session.run(`
            MERGE (menu:UI_Area {name: 'Menu Navigation Today'})
            MERGE (basic:UI_Area {name: 'Basic Form'})
        `);
        await session.run(`
            MERGE (ci1:ConfigurationItem {name: 'Provider Select'})
            MERGE (ci2:ConfigurationItem {name: 'Provider Profile'})
        `);
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
            MATCH (w1:Workflow {name: 'Standard RFS Request'})
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
        console.log('Additional data loaded successfully');

        // Verify data
        console.log('\nVerifying database initialization...');
        
        const nodeCount = await session.run(
            'MATCH (n) RETURN count(n) as count'
        );
        console.log(`Total nodes: ${nodeCount.records[0].get('count')}`);

        const relationshipCount = await session.run(
            'MATCH ()-[r]->() RETURN count(r) as count'
        );
        console.log(`Total relationships: ${relationshipCount.records[0].get('count')}`);

        // Detailed relationship verification
        console.log('\nVerifying relationships in detail...');
        const relationshipDetails = await session.run(`
            MATCH (a)-[r]->(b)
            RETURN type(r) as type,
                   labels(a)[0] as sourceType,
                   a.name as sourceName,
                   labels(b)[0] as targetType,
                   b.name as targetName
            ORDER BY type(r), sourceName
        `);
        
        console.log('\nDetailed relationship listing:');
        relationshipDetails.records.forEach(record => {
            console.log(`${record.get('sourceType')}('${record.get('sourceName')}') -[${record.get('type')}]-> ${record.get('targetType')}('${record.get('targetName')}')`);
        });

        const nodeTypes = await session.run(
            'MATCH (n) RETURN distinct labels(n) as type, count(*) as count'
        );
        console.log('\nNode distribution:');
        nodeTypes.records.forEach(record => {
            console.log(`${record.get('type')}: ${record.get('count')}`);
        });

        const relationshipTypes = await session.run(
            'MATCH ()-[r]->() RETURN type(r) as type, count(*) as count'
        );
        console.log('\nRelationship distribution:');
        relationshipTypes.records.forEach(record => {
            console.log(`${record.get('type')}: ${record.get('count')}`);
        });

    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    } finally {
        await session.close();
        await driver.close();
    }
}

initializeDatabase()
    .then(() => {
        console.log('\nDatabase initialization completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }); 