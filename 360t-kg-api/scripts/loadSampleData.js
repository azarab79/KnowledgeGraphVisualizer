const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function loadSampleData() {
    const driver = neo4j.driver(
        process.env.NEO4J_URI || 'neo4j://localhost:7695',
        neo4j.auth.basic(
            process.env.NEO4J_USER || 'neo4j',
            process.env.NEO4J_PASSWORD
        )
    );

    try {
        const session = driver.session();
        
        try {
            // Clear existing data first
            console.log('Clearing existing data...');
            await session.run('MATCH (n) DETACH DELETE n');
            
            // Read the sample data file
            const sampleDataFile = path.join(__dirname, '..', 'schema', 'sample_data.cypher');
            let sampleData = fs.readFileSync(sampleDataFile, 'utf-8');
            
            // Remove comments and empty lines
            sampleData = sampleData
                .split('\n')
                .filter(line => !line.trim().startsWith('//') && line.trim().length > 0)
                .join('\n');
            
            // Split into statements, preserving multi-line statements
            const statements = [];
            let currentStatement = '';
            let inBrackets = 0;
            
            for (const char of sampleData) {
                currentStatement += char;
                
                if (char === '{') inBrackets++;
                if (char === '}') inBrackets--;
                
                if (char === ';' && inBrackets === 0) {
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                }
            }
            
            // Execute all statements in a single transaction
            const tx = session.beginTransaction();
            
            try {
                console.log('Loading sample data...');
                
                // Execute each statement in the transaction
                for (const statement of statements) {
                    try {
                        // Skip empty statements and the clear statement
                        if (!statement.trim() || statement.includes('DETACH DELETE n')) {
                            continue;
                        }
                        
                        await tx.run(statement);
                        console.log('Successfully executed:', statement.substring(0, 100) + '...');
                    } catch (error) {
                        console.error('Error executing statement:', statement.substring(0, 100) + '...');
                        console.error('Error details:', error.message);
                        // Rollback transaction on error
                        await tx.rollback();
                        throw error;
                    }
                }

                // Commit the transaction
                await tx.commit();
                console.log('Successfully committed all statements');

                // Verify data was loaded
                console.log('\nVerifying loaded data...');
                
                const nodeCount = await session.run(`
                    MATCH (n)
                    WITH labels(n)[0] as label, collect(n) as nodes
                    RETURN 
                        label,
                        size(nodes) as count,
                        [x IN nodes | x.name] as names
                    ORDER BY label
                `);

                console.log('\nNodes in database:');
                nodeCount.records.forEach(record => {
                    console.log(`${record.get('label')}: ${record.get('count')} nodes`);
                    console.log('Names:', record.get('names').join(', '));
                });

                const relCount = await session.run(`
                    MATCH ()-[r]->()
                    WITH type(r) as type, collect(r) as rels,
                         startNode(r) as source, endNode(r) as target
                    RETURN 
                        type,
                        size(rels) as count,
                        collect(source.name + ' -> ' + target.name) as examples
                    ORDER BY type
                `);

                console.log('\nRelationships in database:');
                relCount.records.forEach(record => {
                    console.log(`${record.get('type')}: ${record.get('count')} relationships`);
                    console.log('Examples:', record.get('examples').join(', '));
                });

            } catch (error) {
                console.error('Transaction failed:', error);
                if (tx) {
                    await tx.rollback();
                }
            }
        } finally {
            await session.close();
        }
    } catch (error) {
        console.error('Failed to load sample data:', error);
    } finally {
        await driver.close();
    }
}

// Run the script
loadSampleData(); 