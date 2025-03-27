# 360T Knowledge Graph Schema Documentation

## Node Labels

### Module
Represents a software module or component in the 360T platform.
- **Properties**:
  - `name` (string, required, unique): Module identifier
  - `version` (string, required): Module version
  - `description` (string): Module description
  - `status` (string): Development status ['active', 'deprecated', 'planned']

### Product
Represents a product or service within the 360T ecosystem.
- **Properties**:
  - `name` (string, required, unique): Product name
  - `product_type` (string, required): Type of product ['core', 'addon', 'service']
  - `description` (string): Product description
  - `version` (string): Current version

### Workflow
Represents a business process or workflow.
- **Properties**:
  - `name` (string, required, unique): Workflow identifier
  - `description` (string): Workflow description
  - `owner` (string): Team responsible for the workflow
  - `status` (string): Current status ['active', 'inactive', 'draft']

### ConfigurationItem
Represents configuration settings for products.
- **Properties**:
  - `name` (string, required): Configuration key
  - `group` (string, required): Configuration group
  - `default_value` (string): Default setting
  - `description` (string): Configuration description
  - `data_type` (string): Type of data ['string', 'number', 'boolean', 'json']

### TestCase
Represents test cases for products and workflows.
- **Properties**:
  - `test_case_id` (string, required, unique): Test case identifier
  - `name` (string, required): Test case name
  - `description` (string): Test description
  - `status` (string): Test status ['active', 'deprecated', 'draft']

### UI_Area
Represents areas or components in the user interface.
- **Properties**:
  - `name` (string, required): UI component name
  - `path` (string, required, unique): URL path or component path
  - `description` (string): Component description
  - `type` (string): Component type ['page', 'widget', 'modal']

## Relationships

### DEPENDS_ON (Module → Module)
Indicates module dependencies.
- **Properties**:
  - `type` (string): Dependency type ['runtime', 'compile-time', 'test']
  - `version` (string): Required version
  - `optional` (boolean): Whether dependency is optional

### IMPLEMENTS (Module → Product)
Shows which modules implement product functionality.
- **Properties**:
  - `version` (string): Implementation version
  - `role` (string): Implementation role ['core', 'extension', 'utility']

### INTEGRATES_WITH (Product → Product)
Describes product integrations.
- **Properties**:
  - `integration_type` (string): Type of integration ['api', 'database', 'message-queue']
  - `direction` (string): Integration direction ['unidirectional', 'bidirectional']
  - `description` (string): Integration details

### USES (Workflow → Product)
Shows product usage in workflows.
- **Properties**:
  - `access_type` (string): Usage type ['read', 'write', 'both']
  - `required` (boolean): Whether product is required for workflow

### TRIGGERS (Workflow → Workflow)
Indicates workflow dependencies and triggers.
- **Properties**:
  - `trigger_type` (string): Type of trigger ['automatic', 'manual', 'scheduled']
  - `condition` (string): Trigger condition
  - `priority` (number): Execution priority

### CONFIGURES (ConfigurationItem → Product)
Links configuration items to products.
- **Properties**:
  - `environment` (string): Target environment ['development', 'staging', 'production']
  - `is_required` (boolean): Whether configuration is required
  - `validation` (string): Validation rules

### VALIDATES (TestCase → Product)
Links test cases to products.
- **Properties**:
  - `test_type` (string): Type of test ['unit', 'integration', 'e2e']
  - `priority` (string): Test priority ['low', 'medium', 'high']
  - `automation_status` (string): Automation status ['automated', 'manual', 'planned']

### DEPENDS_ON (TestCase → TestCase)
Shows test case dependencies.
- **Properties**:
  - `dependency_type` (string): Type of dependency ['setup', 'teardown', 'data']
  - `description` (string): Dependency details

### DISPLAYS (UI_Area → Product)
Shows which UI components display product information.
- **Properties**:
  - `view_type` (string): Type of view ['read-only', 'editable', 'interactive']
  - `access_level` (string): Required access level ['user', 'admin', 'superuser']
  - `features` (array): List of features displayed

### NAVIGATES_TO (UI_Area → UI_Area)
Describes navigation between UI components.
- **Properties**:
  - `navigation_type` (string): Type of navigation ['link', 'button', 'menu']
  - `requires_auth` (boolean): Whether authentication is required
  - `parameters` (array): Required navigation parameters 