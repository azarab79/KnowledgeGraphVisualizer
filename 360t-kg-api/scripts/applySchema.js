const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function applySchema() {
    const driver = neo4j.driver(
        process.env.NEO4J_URI || 'neo4j://localhost:7695',
        neo4j.auth.basic(
            process.env.NEO4J_USER || 'neo4j',
            process.env.NEO4J_PASSWORD
        )
    );

    try {
        // Read the constraints file
        const constraintsFile = path.join(__dirname, '..', 'schema', 'constraints.cypher');
        const constraintsContent = fs.readFileSync(constraintsFile, 'utf-8');
        
        // Split the file into individual statements
        const statements = constraintsContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        const session = driver.session();
        
        console.log('Applying schema constraints and indexes...');
        
        // Execute each statement
        for (const statement of statements) {
            try {
                await session.run(statement);
                console.log('Successfully executed:', statement.split('\n')[0] + '...');
            } catch (error) {
                console.error('Error executing statement:', statement);
                console.error('Error details:', error.message);
            }
        }

        console.log('\nSchema application completed.');
        
        // Verify constraints and indexes
        const activeConstraints = await session.run('SHOW CONSTRAINTS');
        const activeIndexes = await session.run('SHOW INDEXES');
        
        console.log('\nActive Constraints:');
        activeConstraints.records.forEach(record => {
            console.log('-', record.get('name'));
        });
        
        console.log('\nActive Indexes:');
        activeIndexes.records.forEach(record => {
            console.log('-', record.get('name'));
        });

        await session.close();
    } catch (error) {
        console.error('Failed to apply schema:', error);
    } finally {
        await driver.close();
    }
}

// Run the script
applySchema(); 