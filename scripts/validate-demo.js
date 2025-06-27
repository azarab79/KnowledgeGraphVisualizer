#!/usr/bin/env node

/**
 * Demo Validation Script
 * Tests all existing functionality to ensure nothing is broken
 */

const axios = require('axios');
const chalk = require('chalk');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const UI_BASE = process.env.UI_BASE || 'http://localhost:3000';

class DemoValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async test(name, testFn) {
    try {
      console.log(chalk.blue(`Testing: ${name}...`));
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS' });
      console.log(chalk.green(`✅ ${name}`));
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      console.log(chalk.red(`❌ ${name}: ${error.message}`));
    }
  }

  async validateAPI() {
    console.log(chalk.yellow('\n🔍 Validating API Endpoints...'));

    await this.test('API Health Check', async () => {
      const response = await axios.get(`${API_BASE}/health`);
      if (response.status !== 200) throw new Error('Health check failed');
    });

    await this.test('Graph Data Endpoint', async () => {
      const response = await axios.get(`${API_BASE}/api/graph`);
      if (response.status !== 200) throw new Error('Graph endpoint failed');
      if (!response.data.nodes || !response.data.edges) {
        throw new Error('Graph data structure invalid');
      }
    });

    await this.test('Search Endpoint', async () => {
      const response = await axios.get(`${API_BASE}/api/search?q=test`);
      if (response.status !== 200) throw new Error('Search endpoint failed');
    });

    await this.test('Node Details Endpoint', async () => {
      // First get a node ID from graph data
      const graphResponse = await axios.get(`${API_BASE}/api/graph`);
      if (graphResponse.data.nodes.length > 0) {
        const nodeId = graphResponse.data.nodes[0].id;
        const response = await axios.get(`${API_BASE}/api/nodes/${nodeId}`);
        if (response.status !== 200) throw new Error('Node details endpoint failed');
      }
    });
  }

  async validateUI() {
    console.log(chalk.yellow('\n🎨 Validating UI Accessibility...'));

    await this.test('UI Server Running', async () => {
      const response = await axios.get(UI_BASE);
      if (response.status !== 200) throw new Error('UI server not responding');
    });

    await this.test('Static Assets Loading', async () => {
      // Check if main JS/CSS files are accessible
      const response = await axios.get(`${UI_BASE}/static/js/main.js`).catch(() => {
        // Try alternative paths
        return axios.get(`${UI_BASE}/assets/index.js`);
      });
      if (response.status !== 200) throw new Error('Static assets not loading');
    });
  }

  async validateDatabase() {
    console.log(chalk.yellow('\n🗄️ Validating Database Connection...'));

    await this.test('Neo4j Connection', async () => {
      const response = await axios.get(`${API_BASE}/api/graph`);
      if (response.status !== 200) throw new Error('Cannot connect to Neo4j');
      if (response.data.nodes.length === 0) {
        console.log(chalk.yellow('⚠️ Warning: No nodes found in database'));
      }
    });
  }

  async validateCriticalFeatures() {
    console.log(chalk.yellow('\n⭐ Validating Critical Features...'));

    await this.test('Graph Visualization Data', async () => {
      const response = await axios.get(`${API_BASE}/api/graph`);
      const data = response.data;
      
      if (!Array.isArray(data.nodes)) throw new Error('Nodes not an array');
      if (!Array.isArray(data.edges)) throw new Error('Edges not an array');
      
      // Validate node structure
      if (data.nodes.length > 0) {
        const node = data.nodes[0];
        if (!node.id || !node.label) {
          throw new Error('Node structure invalid');
        }
      }
      
      // Validate edge structure
      if (data.edges.length > 0) {
        const edge = data.edges[0];
        if (!edge.source || !edge.target) {
          throw new Error('Edge structure invalid');
        }
      }
    });

    await this.test('Search Functionality', async () => {
      const response = await axios.get(`${API_BASE}/api/search?q=node`);
      if (!Array.isArray(response.data)) {
        throw new Error('Search results not an array');
      }
    });
  }

  async validateEnvironment() {
    console.log(chalk.yellow('\n🌍 Validating Environment...'));

    await this.test('Environment Variables', async () => {
      const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
      const missing = requiredEnvVars.filter(env => !process.env[env]);
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
      }
    });

    await this.test('Feature Flags', async () => {
      // Ensure chat feature is disabled for demo safety
      if (process.env.ENABLE_CHAT_FEATURE === 'true') {
        console.log(chalk.yellow('⚠️ Warning: ENABLE_CHAT_FEATURE is true - consider disabling for demo'));
      }
    });
  }

  printSummary() {
    console.log(chalk.yellow('\n📊 Validation Summary'));
    console.log('='.repeat(50));
    
    if (this.results.failed === 0) {
      console.log(chalk.green(`🎉 All ${this.results.passed} tests passed!`));
      console.log(chalk.green('✅ Your application is ready for the demo!'));
    } else {
      console.log(chalk.red(`❌ ${this.results.failed} tests failed`));
      console.log(chalk.green(`✅ ${this.results.passed} tests passed`));
      console.log(chalk.yellow('\n🚨 CRITICAL: Fix failed tests before demo!'));
    }

    console.log('\nDetailed Results:');
    this.results.tests.forEach(test => {
      const status = test.status === 'PASS' 
        ? chalk.green('PASS') 
        : chalk.red('FAIL');
      console.log(`  ${status} ${test.name}`);
      if (test.error) {
        console.log(`       ${chalk.red(test.error)}`);
      }
    });

    return this.results.failed === 0;
  }

  async run() {
    console.log(chalk.blue('🛡️ Demo Validation Starting...\n'));
    
    try {
      await this.validateEnvironment();
      await this.validateDatabase();
      await this.validateAPI();
      await this.validateUI();
      await this.validateCriticalFeatures();
    } catch (error) {
      console.log(chalk.red(`\n💥 Validation failed with error: ${error.message}`));
    }

    return this.printSummary();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DemoValidator();
  validator.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = DemoValidator; 