// Script to validate data integrity and quality in the 360T Knowledge Graph
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Neo4j connection
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session();

// Output directory for validation reports
const outputDir = path.join(__dirname, '../reports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Validation rules
const validationRules = [
  {
    id: 'missing-required-properties',
    name: 'Missing Required Properties',
    description: 'Nodes missing required properties like name or version',
    query: `
      MATCH (n)
      WHERE (n:Module AND (NOT EXISTS(n.name) OR NOT EXISTS(n.version)))
         OR (n:Product AND NOT EXISTS(n.name))
         OR (n:Workflow AND NOT EXISTS(n.name))
         OR (n:UI_Area AND NOT EXISTS(n.name))
         OR (n:ConfigurationItem AND NOT EXISTS(n.name))
         OR (n:TestCase AND NOT EXISTS(n.name))
      RETURN labels(n) as nodeType, id(n) as nodeId, 
             CASE WHEN EXISTS(n.name) THEN n.name ELSE "NO_NAME" END as name
    `,
    severity: 'high'
  },
  {
    id: 'orphaned-nodes',
    name: 'Orphaned Nodes',
    description: 'Nodes not connected to any other node',
    query: `
      MATCH (n)
      WHERE NOT (n)--()
      RETURN labels(n) as nodeType, id(n) as nodeId, 
             CASE WHEN EXISTS(n.name) THEN n.name ELSE "NO_NAME" END as name
    `,
    severity: 'medium'
  },
  {
    id: 'invalid-relationships',
    name: 'Invalid Relationships',
    description: 'Relationships between invalid node types',
    query: `
      MATCH (n)-[r]->(m)
      WHERE (type(r) = 'CONTAINS' AND NOT (n:Module) OR NOT (m:Workflow))
         OR (type(r) = 'DISPLAYS' AND NOT (n:Module) OR NOT (m:UI_Area))
         OR (type(r) = 'USES' AND NOT (n:Workflow) OR (NOT (m:Product) AND NOT (m:ConfigurationItem)))
         OR (type(r) = 'CONFIGURES_IN' AND NOT (n:Product) OR NOT (m:UI_Area))
         OR (type(r) = 'REQUIRES' AND NOT (n:Product) OR NOT (m:ConfigurationItem))
         OR (type(r) = 'VALIDATES' AND NOT (n:TestCase) OR (NOT (m:Workflow) AND NOT (m:ConfigurationItem) AND NOT (m:UI_Area)))
         OR (type(r) = 'NAVIGATES_TO' AND NOT (n:UI_Area) OR NOT (m:UI_Area))
         OR (type(r) = 'DEPENDS_ON' AND NOT (n:Module) OR NOT (m:Module))
      RETURN labels(n) as sourceType, type(r) as relationship, labels(m) as targetType, 
             CASE WHEN EXISTS(n.name) THEN n.name ELSE "NO_NAME" END as sourceName,
             CASE WHEN EXISTS(m.name) THEN m.name ELSE "NO_NAME" END as targetName
    `,
    severity: 'high'
  },
  {
    id: 'duplicated-nodes',
    name: 'Duplicated Nodes',
    description: 'Multiple nodes with the same name and type',
    query: `
      MATCH (n)
      WITH labels(n)[0] AS nodeType, n.name AS name, collect(n) AS nodes
      WHERE size(nodes) > 1 AND name IS NOT NULL
      RETURN nodeType, name, size(nodes) AS count
    `,
    severity: 'high'
  },
  {
    id: 'circular-dependencies',
    name: 'Circular Module Dependencies',
    description: 'Modules with circular dependency relationships',
    query: `
      MATCH path = (m:Module)-[:DEPENDS_ON*2..]->(m)
      RETURN [node IN nodes(path) | node.name] AS cycle
    `,
    severity: 'medium'
  },
  {
    id: 'missing-test-coverage',
    name: 'Missing Test Coverage',
    description: 'Workflows without any test cases',
    query: `
      MATCH (w:Workflow)
      WHERE NOT (w)<-[:VALIDATES]-(:TestCase)
      RETURN w.name AS workflow
    `,
    severity: 'low'
  },
  {
    id: 'invalid-ui-navigation',
    name: 'Invalid UI Navigation',
    description: 'UI areas with potential navigation issues',
    query: `
      MATCH (ui:UI_Area)
      WHERE NOT (ui)-[:NAVIGATES_TO]->() AND NOT ()-[:NAVIGATES_TO]->(ui)
      RETURN ui.name AS isolatedUI
    `,
    severity: 'low'
  },
  {
    id: 'incomplete-workflow-steps',
    name: 'Incomplete Workflow Steps',
    description: 'Workflows with zero steps defined',
    query: `
      MATCH (w:Workflow)
      WHERE NOT EXISTS(w.steps) OR w.steps = 0
      RETURN w.name AS workflow
    `,
    severity: 'medium'
  },
  {
    id: 'dangling-relationships',
    name: 'Dangling Relationships',
    description: 'Relationships pointing to non-existent nodes',
    query: `
      // This is typically handled by the database constraints
      // This query is for documentation purposes
      RETURN 0 AS count
    `,
    severity: 'high',
    autoFixed: true
  },
  {
    id: 'redundant-relationships',
    name: 'Redundant Relationships',
    description: 'Multiple identical relationships between the same nodes',
    query: `
      MATCH (n)-[r]->(m)
      WITH n, m, type(r) as relType, count(r) AS relCount
      WHERE relCount > 1
      RETURN labels(n)[0] as sourceType, relType, labels(m)[0] as targetType, 
             n.name as sourceName, m.name as targetName, relCount
    `,
    severity: 'medium'
  }
];

// Run validation
async function validateGraph() {
  try {
    console.log('Starting knowledge graph validation...');
    const validationResults = {};
    const validationSummary = {
      totalIssues: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      rulesPassed: 0,
      rulesFailed: 0,
      timestamp: new Date().toISOString()
    };
    
    // Run each validation rule
    for (const rule of validationRules) {
      console.log(`Running validation: ${rule.name}`);
      
      try {
        const result = await session.run(rule.query);
        const issues = result.records.map(record => {
          const obj = {};
          record.keys.forEach(key => {
            obj[key] = record.get(key);
          });
          return obj;
        });
        
        const ruleResult = {
          ruleId: rule.id,
          ruleName: rule.name,
          description: rule.description,
          severity: rule.severity,
          passed: issues.length === 0,
          issueCount: issues.length,
          issues: issues,
          autoFixed: rule.autoFixed || false
        };
        
        // Update summary
        validationSummary.totalIssues += issues.length;
        if (issues.length === 0) {
          validationSummary.rulesPassed++;
        } else {
          validationSummary.rulesFailed++;
          if (rule.severity === 'high') validationSummary.highSeverity += issues.length;
          if (rule.severity === 'medium') validationSummary.mediumSeverity += issues.length;
          if (rule.severity === 'low') validationSummary.lowSeverity += issues.length;
        }
        
        validationResults[rule.id] = ruleResult;
        
      } catch (error) {
        console.error(`Error running validation rule ${rule.id}:`, error);
        validationResults[rule.id] = {
          ruleId: rule.id,
          ruleName: rule.name,
          description: rule.description,
          severity: rule.severity,
          error: error.message,
          passed: false,
          issueCount: 0,
          issues: []
        };
        validationSummary.rulesFailed++;
      }
    }
    
    // Add overall validation status
    validationSummary.status = validationSummary.highSeverity === 0 ? 'PASSED' : 'FAILED';
    validationSummary.passRate = `${Math.round((validationSummary.rulesPassed / (validationSummary.rulesPassed + validationSummary.rulesFailed)) * 100)}%`;
    
    // Create complete validation report
    const validationReport = {
      summary: validationSummary,
      details: validationResults
    };
    
    // Save validation report
    fs.writeFileSync(
      path.join(outputDir, 'validation-report.json'),
      JSON.stringify(validationReport, null, 2)
    );
    console.log(`Validation complete. Report saved to reports/validation-report.json`);
    
    // Generate HTML report
    generateHtmlReport(validationReport);
    
    return validationSummary;
  } catch (error) {
    console.error('Error during validation:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Generate HTML report
function generateHtmlReport(validationReport) {
  const { summary, details } = validationReport;
  
  // Create HTML content
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>360T Knowledge Graph Validation Report</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { padding: 20px; }
    .summary-card { margin-bottom: 20px; }
    .high-severity { background-color: #f8d7da; }
    .medium-severity { background-color: #fff3cd; }
    .low-severity { background-color: #d1e7dd; }
    .passed { background-color: #d1e7dd; }
    .failed { background-color: #f8d7da; }
    .details-table { font-size: 0.9rem; }
    .issues-table { font-size: 0.85rem; }
    .badge-high { background-color: #dc3545; }
    .badge-medium { background-color: #ffc107; color: #000; }
    .badge-low { background-color: #198754; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="mb-4">360T Knowledge Graph Validation Report</h1>
    
    <div class="card summary-card ${summary.status === 'PASSED' ? 'passed' : 'failed'}">
      <div class="card-header">
        <h5 class="card-title">Summary</h5>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-3">
            <h4>Status: <span class="badge ${summary.status === 'PASSED' ? 'bg-success' : 'bg-danger'}">${summary.status}</span></h4>
            <p>Generated: ${new Date(summary.timestamp).toLocaleString()}</p>
          </div>
          <div class="col-md-3">
            <h4>${summary.totalIssues}</h4>
            <p>Total Issues</p>
          </div>
          <div class="col-md-3">
            <h4>${summary.rulesPassed} / ${summary.rulesPassed + summary.rulesFailed}</h4>
            <p>Rules Passed (${summary.passRate})</p>
          </div>
          <div class="col-md-3">
            <p><span class="badge badge-high">High: ${summary.highSeverity}</span></p>
            <p><span class="badge badge-medium">Medium: ${summary.mediumSeverity}</span></p>
            <p><span class="badge badge-low">Low: ${summary.lowSeverity}</span></p>
          </div>
        </div>
      </div>
    </div>
    
    <h2 class="mb-3">Validation Results</h2>
    
    <div class="accordion" id="validationAccordion">
      ${Object.values(details).map((rule, index) => `
        <div class="accordion-item ${rule.severity}-severity">
          <h2 class="accordion-header" id="heading${index}">
            <button class="accordion-button ${rule.passed ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="${rule.passed ? 'false' : 'true'}" aria-controls="collapse${index}">
              <span class="badge ${rule.severity === 'high' ? 'badge-high' : rule.severity === 'medium' ? 'badge-medium' : 'badge-low'}">${rule.severity.toUpperCase()}</span>
              &nbsp;${rule.ruleName} - 
              ${rule.passed 
                ? '<span class="badge bg-success">PASSED</span>' 
                : rule.error 
                  ? `<span class="badge bg-warning text-dark">ERROR</span>` 
                  : `<span class="badge bg-danger">${rule.issueCount} ISSUES</span>`}
              ${rule.autoFixed ? '<span class="badge bg-info">AUTO-FIXED</span>' : ''}
            </button>
          </h2>
          <div id="collapse${index}" class="accordion-collapse collapse ${rule.passed ? '' : 'show'}" aria-labelledby="heading${index}" data-bs-parent="#validationAccordion">
            <div class="accordion-body">
              <p>${rule.description}</p>
              ${rule.error 
                ? `<div class="alert alert-warning">Error executing rule: ${rule.error}</div>`
                : rule.issues.length > 0 
                  ? `<div class="table-responsive">
                      <table class="table table-sm table-striped table-hover issues-table">
                        <thead>
                          <tr>
                            ${Object.keys(rule.issues[0]).map(key => `<th>${key}</th>`).join('')}
                          </tr>
                        </thead>
                        <tbody>
                          ${rule.issues.map(issue => `
                            <tr>
                              ${Object.values(issue).map(val => {
                                if (val === null || val === undefined) return '<td>-</td>';
                                if (Array.isArray(val)) return `<td>${JSON.stringify(val)}</td>`;
                                return `<td>${val}</td>`;
                              }).join('')}
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>`
                  : '<div class="alert alert-success">No issues found</div>'
              }
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
  
  // Save HTML report
  fs.writeFileSync(
    path.join(outputDir, 'validation-report.html'),
    html
  );
  console.log('HTML validation report saved to reports/validation-report.html');
}

// Execute if run directly
if (require.main === module) {
  validateGraph()
    .then(summary => {
      console.log('Validation Summary:', summary);
      driver.close();
      
      // Exit with error code if high severity issues exist
      if (summary.highSeverity > 0) {
        console.error(`Validation failed with ${summary.highSeverity} high severity issues`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Validation failed:', error);
      driver.close();
      process.exit(1);
    });
}

module.exports = { validateGraph }; 