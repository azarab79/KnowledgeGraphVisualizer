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

// Output directory for reports
const outputDir = path.join(__dirname, '../reports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function runAnalytics() {
  try {
    console.log('Starting knowledge graph analytics...');
    const analytics = {};
    
    // 1. Module Statistics
    console.log('Analyzing module statistics...');
    const moduleStats = await session.run(`
      MATCH (m:Module)
      OPTIONAL MATCH (m)-[:CONTAINS]->(w:Workflow)
      OPTIONAL MATCH (m)-[:DISPLAYS]->(u:UI_Area)
      OPTIONAL MATCH (m)-[:DEPENDS_ON]->(d:Module)
      RETURN 
        m.name AS module,
        m.version AS version,
        count(DISTINCT w) AS workflowCount,
        count(DISTINCT u) AS uiAreaCount,
        count(DISTINCT d) AS dependencyCount
      ORDER BY workflowCount + uiAreaCount DESC
    `);
    
    analytics.moduleStatistics = moduleStats.records.map(record => ({
      module: record.get('module'),
      version: record.get('version'),
      workflowCount: record.get('workflowCount').toNumber(),
      uiAreaCount: record.get('uiAreaCount').toNumber(),
      dependencyCount: record.get('dependencyCount').toNumber()
    }));
    
    // Save module statistics to file
    fs.writeFileSync(
      path.join(outputDir, 'module-statistics.json'),
      JSON.stringify(analytics.moduleStatistics, null, 2)
    );
    console.log('Module statistics saved to reports/module-statistics.json');
    
    // 2. Test Coverage Analysis
    console.log('Analyzing test coverage...');
    const testCoverage = await session.run(`
      MATCH (m:Module)
      OPTIONAL MATCH (m)-[:CONTAINS]->(w:Workflow)
      OPTIONAL MATCH (w)<-[:VALIDATES]-(t:TestCase)
      WITH 
        m.name AS module,
        count(DISTINCT w) AS totalWorkflows,
        count(DISTINCT t) AS testCases
      RETURN 
        module,
        totalWorkflows,
        testCases,
        CASE 
          WHEN totalWorkflows = 0 THEN 0 
          ELSE toFloat(testCases) / totalWorkflows 
        END AS coverageRatio
      ORDER BY coverageRatio DESC
    `);
    
    analytics.testCoverage = testCoverage.records.map(record => ({
      module: record.get('module'),
      totalWorkflows: record.get('totalWorkflows').toNumber(),
      testCases: record.get('testCases').toNumber(),
      coverageRatio: record.get('coverageRatio'),
      coveragePercentage: `${Math.round(record.get('coverageRatio') * 100)}%`
    }));
    
    // Save test coverage to file
    fs.writeFileSync(
      path.join(outputDir, 'test-coverage.json'),
      JSON.stringify(analytics.testCoverage, null, 2)
    );
    console.log('Test coverage saved to reports/test-coverage.json');
    
    // 3. Product Usage Analysis
    console.log('Analyzing product usage...');
    const productUsage = await session.run(`
      MATCH (p:Product)
      OPTIONAL MATCH (w:Workflow)-[:USES]->(p)
      OPTIONAL MATCH (p)-[:REQUIRES]->(c:ConfigurationItem)
      OPTIONAL MATCH (p)-[:CONFIGURES_IN]->(u:UI_Area)
      RETURN 
        p.name AS product,
        count(DISTINCT w) AS workflowUsageCount,
        count(DISTINCT c) AS configItemCount,
        count(DISTINCT u) AS uiAreaCount,
        count(DISTINCT w) + count(DISTINCT c) + count(DISTINCT u) AS totalConnections
      ORDER BY totalConnections DESC
    `);
    
    analytics.productUsage = productUsage.records.map(record => ({
      product: record.get('product'),
      workflowUsageCount: record.get('workflowUsageCount').toNumber(),
      configItemCount: record.get('configItemCount').toNumber(),
      uiAreaCount: record.get('uiAreaCount').toNumber(),
      totalConnections: record.get('totalConnections').toNumber()
    }));
    
    // Save product usage to file
    fs.writeFileSync(
      path.join(outputDir, 'product-usage.json'),
      JSON.stringify(analytics.productUsage, null, 2)
    );
    console.log('Product usage saved to reports/product-usage.json');
    
    // 4. UI Navigation Flow Analysis
    console.log('Analyzing UI navigation flows...');
    const navigationFlows = await session.run(`
      MATCH path = (start:UI_Area)-[:NAVIGATES_TO*]->(end:UI_Area)
      WHERE NOT ()-[:NAVIGATES_TO]->(start)
      WITH 
        start.name AS entryPoint,
        [node IN nodes(path) | node.name] AS navigationPath,
        length(path) AS pathLength
      RETURN 
        entryPoint,
        navigationPath,
        pathLength
      ORDER BY pathLength DESC
      LIMIT 10
    `);
    
    analytics.navigationFlows = navigationFlows.records.map(record => ({
      entryPoint: record.get('entryPoint'),
      navigationPath: record.get('navigationPath'),
      pathLength: record.get('pathLength').toNumber()
    }));
    
    // Save navigation flows to file
    fs.writeFileSync(
      path.join(outputDir, 'navigation-flows.json'),
      JSON.stringify(analytics.navigationFlows, null, 2)
    );
    console.log('Navigation flows saved to reports/navigation-flows.json');
    
    // 5. Configuration Impact Analysis
    console.log('Analyzing configuration impact...');
    const configImpact = await session.run(`
      MATCH (c:ConfigurationItem)
      OPTIONAL MATCH (p:Product)-[:REQUIRES]->(c)
      OPTIONAL MATCH (t:TestCase)-[:VALIDATES]->(c)
      OPTIONAL MATCH (w:Workflow)-[:USES]->(p)
      WITH 
        c.name AS configItem,
        count(DISTINCT p) AS productCount,
        count(DISTINCT t) AS testCount,
        count(DISTINCT w) AS indirectWorkflowCount
      RETURN 
        configItem,
        productCount,
        testCount,
        indirectWorkflowCount,
        productCount * indirectWorkflowCount AS impactScore
      ORDER BY impactScore DESC
    `);
    
    analytics.configurationImpact = configImpact.records.map(record => ({
      configItem: record.get('configItem'),
      productCount: record.get('productCount').toNumber(),
      testCount: record.get('testCount').toNumber(),
      indirectWorkflowCount: record.get('indirectWorkflowCount').toNumber(),
      impactScore: record.get('impactScore').toNumber()
    }));
    
    // Save configuration impact to file
    fs.writeFileSync(
      path.join(outputDir, 'configuration-impact.json'),
      JSON.stringify(analytics.configurationImpact, null, 2)
    );
    console.log('Configuration impact saved to reports/configuration-impact.json');
    
    // 6. Module Dependency Network
    console.log('Analyzing module dependencies...');
    const moduleDependencies = await session.run(`
      MATCH (m:Module)
      OPTIONAL MATCH (m)-[:DEPENDS_ON]->(dep:Module)
      WITH m.name AS module, collect(dep.name) AS dependencies
      RETURN module, dependencies, size(dependencies) AS dependencyCount
      ORDER BY dependencyCount DESC
    `);
    
    analytics.moduleDependencies = moduleDependencies.records.map(record => ({
      module: record.get('module'),
      dependencies: record.get('dependencies'),
      dependencyCount: record.get('dependencyCount').toNumber()
    }));
    
    // Save module dependencies to file
    fs.writeFileSync(
      path.join(outputDir, 'module-dependencies.json'),
      JSON.stringify(analytics.moduleDependencies, null, 2)
    );
    console.log('Module dependencies saved to reports/module-dependencies.json');
    
    // 7. Test Type Distribution
    console.log('Analyzing test type distribution...');
    const testDistribution = await session.run(`
      MATCH (t:TestCase)
      RETURN 
        t.type AS testType,
        t.priority AS priority,
        count(*) AS count
      ORDER BY testType, priority
    `);
    
    analytics.testDistribution = testDistribution.records.map(record => ({
      testType: record.get('testType'),
      priority: record.get('priority'),
      count: record.get('count').toNumber()
    }));
    
    // Save test distribution to file
    fs.writeFileSync(
      path.join(outputDir, 'test-distribution.json'),
      JSON.stringify(analytics.testDistribution, null, 2)
    );
    console.log('Test distribution saved to reports/test-distribution.json');
    
    // 8. Component Relationships Summary
    console.log('Creating component relationships summary...');
    const relationshipSummary = await session.run(`
      MATCH (n)-[r]->(m)
      RETURN 
        labels(n)[0] AS sourceType,
        labels(m)[0] AS targetType,
        type(r) AS relationship,
        count(*) AS count
      ORDER BY count DESC
    `);
    
    analytics.relationshipSummary = relationshipSummary.records.map(record => ({
      sourceType: record.get('sourceType'),
      targetType: record.get('targetType'),
      relationship: record.get('relationship'),
      count: record.get('count').toNumber()
    }));
    
    // Save relationship summary to file
    fs.writeFileSync(
      path.join(outputDir, 'relationship-summary.json'),
      JSON.stringify(analytics.relationshipSummary, null, 2)
    );
    console.log('Relationship summary saved to reports/relationship-summary.json');
    
    // 9. Create a consolidated report with all analytics
    fs.writeFileSync(
      path.join(outputDir, 'consolidated-analytics.json'),
      JSON.stringify(analytics, null, 2)
    );
    console.log('Consolidated analytics saved to reports/consolidated-analytics.json');
    
    console.log('All analytics completed successfully');
    return 'SUCCESS: Knowledge graph analytics completed';
  } catch (error) {
    console.error('Error running analytics:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Execute if run directly
if (require.main === module) {
  runAnalytics()
    .then(result => {
      console.log(result);
      driver.close();
    })
    .catch(error => {
      console.error('Failed to run analytics:', error);
      driver.close();
      process.exit(1);
    });
}

module.exports = { runAnalytics }; 