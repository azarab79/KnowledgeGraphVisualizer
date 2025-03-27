class Migration {
    constructor(driver) {
        this.driver = driver;
        this.version = null;
        this.description = null;
    }

    async up() {
        throw new Error('up() method must be implemented');
    }

    async down() {
        throw new Error('down() method must be implemented');
    }

    async execute(direction = 'up') {
        const session = this.driver.session();
        try {
            // Start transaction
            const tx = session.beginTransaction();
            
            try {
                // Execute migration
                if (direction === 'up') {
                    await this.up(tx);
                } else {
                    await this.down(tx);
                }

                // Update migration status
                await tx.run(
                    `MERGE (m:_Migration {version: $version})
                     SET m.description = $description,
                         m.direction = $direction,
                         m.executedAt = datetime()`,
                    {
                        version: this.version,
                        description: this.description,
                        direction: direction
                    }
                );

                // Commit transaction
                await tx.commit();
            } catch (error) {
                await tx.rollback();
                throw error;
            }
        } finally {
            await session.close();
        }
    }

    static async getCurrentVersion(driver) {
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
}

module.exports = Migration; 