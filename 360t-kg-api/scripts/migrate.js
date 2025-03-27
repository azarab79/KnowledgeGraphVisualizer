const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
require('dotenv').config();
const logger = require('../utils/logger');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7695',
    neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD
    )
);

async function getMigrations() {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js') && f !== 'Migration.js')
        .sort();

    return files.map(file => {
        const Migration = require(path.join(migrationsDir, file));
        return new Migration(driver);
    });
}

async function getCurrentVersion() {
    const session = driver.session();
    try {
        const result = await session.run(
            `MATCH (m:_Migration)
             RETURN m.version AS version
             ORDER BY m.version DESC
             LIMIT 1`
        );
        return result.records[0]?.get('version') || 0;
    } finally {
        await session.close();
    }
}

async function migrate(direction = 'up') {
    try {
        const migrations = await getMigrations();
        const currentVersion = await getCurrentVersion();

        logger.info(`Current database version: ${currentVersion}`);
        logger.info(`Found ${migrations.length} migration(s)`);

        if (direction === 'up') {
            // Run migrations that are newer than current version
            const pendingMigrations = migrations.filter(m => m.version > currentVersion);
            logger.info(`Running ${pendingMigrations.length} pending migration(s)`);

            for (const migration of pendingMigrations) {
                logger.info(`Migrating to version ${migration.version}: ${migration.description}`);
                await migration.execute('up');
                logger.info(`Successfully migrated to version ${migration.version}`);
            }
        } else {
            // Run single rollback if specified
            const currentMigration = migrations.find(m => m.version === currentVersion);
            if (currentMigration) {
                logger.info(`Rolling back version ${currentMigration.version}: ${currentMigration.description}`);
                await currentMigration.execute('down');
                logger.info(`Successfully rolled back version ${currentMigration.version}`);
            }
        }

        logger.info('Migration completed successfully');
    } catch (error) {
        logger.error('Migration failed:', error);
        throw error;
    } finally {
        await driver.close();
    }
}

// Run migrations
const direction = process.argv[2] === 'down' ? 'down' : 'up';
migrate(direction)
    .then(() => process.exit(0))
    .catch(() => process.exit(1)); 