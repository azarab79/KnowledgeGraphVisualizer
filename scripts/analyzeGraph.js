const neo4j = require('neo4j-driver');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function runAnalytics() {
    const session = driver.session();
    try {
        console.log('Starting knowledge graph analytics...');

        // Ensure reports directory exists
        const reportsDir = path.join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir);
        }

        // Analyze module statistics
        console.log('Analyzing module statistics...');
        const moduleResult = await session.run(`
            MATCH (m:Module)
            OPTIONAL MATCH (m)-[r]-()
            WITH m, count(r) as relationCount
            RETURN {
                name: m.name,
                relationshipCount: relationCount,
                type: m.type
            } as moduleStats
            ORDER BY moduleStats.relationshipCount DESC
        `);

        const moduleStats = moduleResult.records.map(record => {
            const stats = record.get('moduleStats');
            return {
                ...stats,
                relationshipCount: Number(stats.relationshipCount)
            };
        });

        fs.writeFileSync(
            path.join(reportsDir, 'module-statistics.json'),
            JSON.stringify(moduleStats, null, 2)
        );
        console.log('Module statistics saved to reports/module-statistics.json');

        // Analyze test coverage
        console.log('Analyzing test coverage...');
        const testResult = await session.run(`
            MATCH (t:TestCase)-[:TESTS]->(m:Module)
            WITH m.name as module, count(t) as testCount
            RETURN {
                module: module,
                testCount: testCount
            } as testStats
            ORDER BY testCount DESC
        `);

        const testStats = testResult.records.map(record => {
            const stats = record.get('testStats');
            return {
                ...stats,
                testCount: Number(stats.testCount)
            };
        });

        fs.writeFileSync(
            path.join(reportsDir, 'test-coverage.json'),
            JSON.stringify(testStats, null, 2)
        );
        console.log('Test coverage statistics saved to reports/test-coverage.json');

        // Analyze component dependencies
        console.log('Analyzing component dependencies...');
        const dependencyResult = await session.run(`
            MATCH (c1)-[r:DEPENDS_ON]->(c2)
            WITH c1.name as source, c2.name as target, count(r) as weight
            RETURN {
                source: source,
                target: target,
                weight: weight
            } as dependencyStats
            ORDER BY weight DESC
        `);

        const dependencyStats = dependencyResult.records.map(record => {
            const stats = record.get('dependencyStats');
            return {
                ...stats,
                weight: Number(stats.weight)
            };
        });

        fs.writeFileSync(
            path.join(reportsDir, 'dependency-analysis.json'),
            JSON.stringify(dependencyStats, null, 2)
        );
        console.log('Dependency analysis saved to reports/dependency-analysis.json');

        console.log('Analytics completed successfully.');
    } catch (error) {
        console.error('Error running analytics:', error);
        throw error;
    } finally {
        await session.close();
        await driver.close();
    }
}

// Execute the analytics
runAnalytics()
    .then(() => {
        console.log('Analytics completed.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to run analytics:', error);
        process.exit(1);
    }); 