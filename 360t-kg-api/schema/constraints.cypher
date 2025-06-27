// Node label existence constraints
CREATE CONSTRAINT module_name_exists IF NOT EXISTS FOR (m:Module) REQUIRE m.name IS NOT NULL;
CREATE CONSTRAINT product_name_exists IF NOT EXISTS FOR (p:Product) REQUIRE p.name IS NOT NULL;
CREATE CONSTRAINT workflow_name_exists IF NOT EXISTS FOR (w:Workflow) REQUIRE w.name IS NOT NULL;
CREATE CONSTRAINT config_item_name_exists IF NOT EXISTS FOR (c:ConfigurationItem) REQUIRE c.name IS NOT NULL;
CREATE CONSTRAINT test_case_name_exists IF NOT EXISTS FOR (t:TestCase) REQUIRE t.name IS NOT NULL;
CREATE CONSTRAINT ui_area_name_exists IF NOT EXISTS FOR (u:UI_Area) REQUIRE u.name IS NOT NULL;

// Node uniqueness constraints
CREATE CONSTRAINT module_name_unique IF NOT EXISTS FOR (m:Module) REQUIRE m.name IS UNIQUE;
CREATE CONSTRAINT product_name_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT workflow_name_unique IF NOT EXISTS FOR (w:Workflow) REQUIRE w.name IS UNIQUE;
CREATE CONSTRAINT config_item_name_unique IF NOT EXISTS FOR (c:ConfigurationItem) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT testcase_id_unique IF NOT EXISTS FOR (t:TestCase) REQUIRE t.test_case_id IS UNIQUE;
CREATE CONSTRAINT ui_area_name_unique IF NOT EXISTS FOR (u:UI_Area) REQUIRE u.name IS UNIQUE;

// Add the full-text index for the chat assistant
CREATE FULLTEXT INDEX keyword IF NOT EXISTS FOR (n:Document) ON EACH [n.text, n.name, n.id];

// Property existence constraints
CREATE CONSTRAINT module_version_exists IF NOT EXISTS FOR (m:Module) REQUIRE m.version IS NOT NULL;
CREATE CONSTRAINT product_type_exists IF NOT EXISTS FOR (p:Product) REQUIRE p.product_type IS NOT NULL;
CREATE CONSTRAINT testcase_id_exists IF NOT EXISTS FOR (t:TestCase) REQUIRE t.test_case_id IS NOT NULL;
CREATE CONSTRAINT testcase_name_exists IF NOT EXISTS FOR (t:TestCase) REQUIRE t.name IS NOT NULL;

// Indexes for better query performance
CREATE INDEX module_name_idx IF NOT EXISTS FOR (m:Module) ON (m.name);
CREATE INDEX product_name_idx IF NOT EXISTS FOR (p:Product) ON (p.name);
CREATE INDEX workflow_name_idx IF NOT EXISTS FOR (w:Workflow) ON (w.name);
CREATE INDEX config_item_name_idx IF NOT EXISTS FOR (c:ConfigurationItem) ON (c.name);
CREATE INDEX testcase_id_idx IF NOT EXISTS FOR (t:TestCase) ON (t.test_case_id);
CREATE INDEX ui_area_name_idx IF NOT EXISTS FOR (u:UI_Area) ON (u.name); 