// Relationship types and their properties

// Module relationships
MATCH (m1:Module)-[r:DEPENDS_ON]->(m2:Module)
WHERE r.type IN ['runtime', 'compile-time', 'test'] 
AND r.version IS NOT NULL
RETURN r;

MATCH (m:Module)-[r:IMPLEMENTS]->(p:Product)
WHERE r.version IS NOT NULL
RETURN r;

// Product relationships
MATCH (p1:Product)-[r:INTEGRATES_WITH]->(p2:Product)
WHERE r.integration_type IN ['api', 'database', 'message-queue']
AND r.direction IN ['unidirectional', 'bidirectional']
RETURN r;

// Workflow relationships
MATCH (w:Workflow)-[r:USES]->(p:Product)
WHERE r.access_type IN ['read', 'write', 'both']
RETURN r;

MATCH (w1:Workflow)-[r:TRIGGERS]->(w2:Workflow)
WHERE r.trigger_type IN ['automatic', 'manual', 'scheduled']
AND r.condition IS NOT NULL
RETURN r;

// Configuration relationships
MATCH (c:ConfigurationItem)-[r:CONFIGURES]->(p:Product)
WHERE r.environment IN ['development', 'staging', 'production']
AND r.is_required IS NOT NULL
RETURN r;

// Test case relationships
MATCH (t:TestCase)-[r:VALIDATES]->(p:Product)
WHERE r.test_type IN ['unit', 'integration', 'e2e']
AND r.priority IN ['low', 'medium', 'high']
RETURN r;

MATCH (t1:TestCase)-[r:DEPENDS_ON]->(t2:TestCase)
WHERE r.dependency_type IN ['setup', 'teardown', 'data']
RETURN r;

// UI relationships
MATCH (u:UI_Area)-[r:DISPLAYS]->(p:Product)
WHERE r.view_type IN ['read-only', 'editable', 'interactive']
AND r.access_level IN ['user', 'admin', 'superuser']
RETURN r;

MATCH (u1:UI_Area)-[r:NAVIGATES_TO]->(u2:UI_Area)
WHERE r.navigation_type IN ['link', 'button', 'menu']
AND r.requires_auth IS NOT NULL
RETURN r; 