const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function clearDatabase() {
    const session = driver.session();
    try {
        console.log('Clearing all data from the knowledge graph...');
        
        // Drop all constraints and indexes
        await session.run('CALL apoc.schema.assert({}, {})');
        console.log('Constraints and indexes dropped.');
        
        // Delete all relationships
        await session.run('MATCH ()-[r]-() DELETE r');
        console.log('All relationships deleted.');
        
        // Delete all nodes
        await session.run('MATCH (n) DELETE n');
        console.log('All nodes deleted.');
        
        console.log('Database cleared successfully.');
    } catch (error) {
        console.error('Error clearing database:', error);
        throw error;
    } finally {
        await session.close();
        await driver.close();
    }
}

// Execute the clear operation
clearDatabase()
    .then(() => {
        console.log('Database clearing completed.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to clear database:', error);
        process.exit(1);
    }); 