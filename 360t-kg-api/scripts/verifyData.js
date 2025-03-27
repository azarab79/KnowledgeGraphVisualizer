const neo4j = require('neo4j-driver');
require('dotenv').config();

async function verifyData() {
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
            console.log('Verifying data structure...\n');

            // Check Module structure
            const moduleQuery = await session.run(`
                MATCH (m:Module)
                OPTIONAL MATCH (m)-[r]->(n)
                RETURN m.name as module,
                       m.description as description,
                       m.version as version,
                       collect(DISTINCT type(r) + ' -> ' + labels(n)[0]) as relationships
            `);

            console.log('Module Structure:');
            moduleQuery.records.forEach(record => {
                console.log(`Module: ${record.get('module')}`);
                console.log(`Description: ${record.get('description')}`);
                console.log(`Version: ${record.get('version')}`);
                console.log('Relationships:', record.get('relationships').join(', '));
                console.log();
            });

            // Check Product structure
            const productQuery = await session.run(`
                MATCH (p:Product)
                OPTIONAL MATCH (p)-[r]->(n)
                RETURN p.name as product,
                       p.description as description,
                       p.product_type as type,
                       collect(DISTINCT type(r) + ' -> ' + labels(n)[0] + ': ' + n.name) as relationships
            `);

            console.log('\nProduct Structure:');
            productQuery.records.forEach(record => {
                console.log(`Product: ${record.get('product')}`);
                console.log(`Description: ${record.get('description')}`);
                console.log(`Type: ${record.get('type')}`);
                console.log('Relationships:', record.get('relationships').join(', '));
                console.log();
            });

            // Check Workflow structure
            const workflowQuery = await session.run(`
                MATCH (w:Workflow)
                OPTIONAL MATCH (w)-[r]->(n)
                RETURN w.name as workflow,
                       w.description as description,
                       w.steps as steps,
                       collect(DISTINCT type(r) + ' -> ' + labels(n)[0] + ': ' + n.name) as relationships
            `);

            console.log('\nWorkflow Structure:');
            workflowQuery.records.forEach(record => {
                console.log(`Workflow: ${record.get('workflow')}`);
                console.log(`Description: ${record.get('description')}`);
                console.log('Steps:', record.get('steps'));
                console.log('Relationships:', record.get('relationships').join(', '));
                console.log();
            });

            // Check UI Area structure
            const uiQuery = await session.run(`
                MATCH (ui:UI_Area)
                OPTIONAL MATCH (ui)-[r]->(n)
                RETURN ui.name as ui_area,
                       ui.description as description,
                       ui.location as location,
                       collect(DISTINCT type(r) + ' -> ' + labels(n)[0] + ': ' + n.name) as outgoing_relationships,
                       [(other)-[r2]->(ui) | labels(other)[0] + ' -> ' + type(r2)] as incoming_relationships
            `);

            console.log('\nUI Area Structure:');
            uiQuery.records.forEach(record => {
                console.log(`UI Area: ${record.get('ui_area')}`);
                console.log(`Description: ${record.get('description')}`);
                console.log(`Location: ${record.get('location')}`);
                console.log('Outgoing Relationships:', record.get('outgoing_relationships').join(', '));
                console.log('Incoming Relationships:', record.get('incoming_relationships').join(', '));
                console.log();
            });

            // Check Test Case structure
            const testQuery = await session.run(`
                MATCH (t:TestCase)
                OPTIONAL MATCH (t)-[r]->(n)
                RETURN t.test_case_id as id,
                       t.name as name,
                       t.description as description,
                       t.priority as priority,
                       t.automation_status as status,
                       collect(DISTINCT type(r) + ' -> ' + labels(n)[0] + ': ' + n.name) as validates
            `);

            console.log('\nTest Case Structure:');
            testQuery.records.forEach(record => {
                console.log(`Test ID: ${record.get('id')}`);
                console.log(`Name: ${record.get('name')}`);
                console.log(`Description: ${record.get('description')}`);
                console.log(`Priority: ${record.get('priority')}`);
                console.log(`Automation Status: ${record.get('status')}`);
                console.log('Validates:', record.get('validates').join(', '));
                console.log();
            });

        } finally {
            await session.close();
        }
    } catch (error) {
        console.error('Failed to verify data:', error);
    } finally {
        await driver.close();
    }
}

// Run the verification
verifyData(); 