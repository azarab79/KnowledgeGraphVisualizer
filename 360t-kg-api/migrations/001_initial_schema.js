const Migration = require('./Migration');

class InitialSchemaMigration extends Migration {
    constructor(driver) {
        super(driver);
        this.version = 1;
        this.description = 'Initial schema setup';
    }

    async up(tx) {
        // Create constraints
        await tx.run(`
            CREATE CONSTRAINT module_name_unique IF NOT EXISTS 
            FOR (m:Module) REQUIRE m.name IS UNIQUE
        `);

        await tx.run(`
            CREATE CONSTRAINT product_name_unique IF NOT EXISTS 
            FOR (p:Product) REQUIRE p.name IS UNIQUE
        `);

        await tx.run(`
            CREATE CONSTRAINT workflow_name_unique IF NOT EXISTS 
            FOR (w:Workflow) REQUIRE w.name IS UNIQUE
        `);

        await tx.run(`
            CREATE CONSTRAINT config_item_name_unique IF NOT EXISTS 
            FOR (c:ConfigurationItem) REQUIRE (c.name, c.group) IS UNIQUE
        `);

        await tx.run(`
            CREATE CONSTRAINT test_case_id_unique IF NOT EXISTS 
            FOR (t:TestCase) REQUIRE t.test_case_id IS UNIQUE
        `);

        await tx.run(`
            CREATE CONSTRAINT ui_area_path_unique IF NOT EXISTS 
            FOR (u:UI_Area) REQUIRE u.path IS UNIQUE
        `);

        // Create indexes
        await tx.run(`
            CREATE INDEX module_version IF NOT EXISTS
            FOR (m:Module) ON (m.version)
        `);

        await tx.run(`
            CREATE INDEX product_type IF NOT EXISTS
            FOR (p:Product) ON (p.product_type)
        `);
    }

    async down(tx) {
        // Drop constraints
        await tx.run('DROP CONSTRAINT module_name_unique IF EXISTS');
        await tx.run('DROP CONSTRAINT product_name_unique IF EXISTS');
        await tx.run('DROP CONSTRAINT workflow_name_unique IF EXISTS');
        await tx.run('DROP CONSTRAINT config_item_name_unique IF EXISTS');
        await tx.run('DROP CONSTRAINT test_case_id_unique IF EXISTS');
        await tx.run('DROP CONSTRAINT ui_area_path_unique IF EXISTS');

        // Drop indexes
        await tx.run('DROP INDEX module_version IF EXISTS');
        await tx.run('DROP INDEX product_type IF EXISTS');
    }
}

module.exports = InitialSchemaMigration; 