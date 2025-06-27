#!/usr/bin/env node

/**
 * GDS Smoke Test Script
 * 
 * Task 6: Add smoke-test script to CI that asserts both pipeline & (optional) legacy procedures are callable
 * 
 * This script verifies that the required GDS procedures for Hidden Links functionality are available
 * and can be called without errors. It's designed to be run in CI/CD pipelines to catch environment
 * setup issues early.
 */

const neo4j = require('neo4j-driver');
const { exit } = require('process');

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

// Test configuration
const TEST_GRAPH_NAME = 'smokeTestGraph';

class GDSSmokeTest {
    constructor() {
        this.driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
        this.session = null;
        this.results = {
            connection: false,
            gdsVersion: null,
            modernPipeline: false,
            legacyProcedures: false,
            commonProcedures: false,
            testExecution: false,
            errors: []
        };
    }

    async run() {
        console.log('🔍 Starting GDS Smoke Test for Hidden Links...\n');
        
        try {
            await this.testConnection();
            await this.detectGDSVersion();
            await this.testProcedureAvailability();
            await this.testBasicExecution();
            
            this.printResults();
            
            if (this.isHealthy()) {
                console.log('✅ All tests passed! Hidden Links should work correctly.');
                process.exit(0);
            } else {
                console.log('❌ Some tests failed. Hidden Links may not work properly.');
                process.exit(1);
            }
        } catch (error) {
            console.error('💥 Smoke test failed with error:', error.message);
            this.results.errors.push(error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async testConnection() {
        console.log('📡 Testing Neo4j connection...');
        try {
            this.session = this.driver.session({ database: NEO4J_DATABASE });
            const result = await this.session.run('RETURN 1 as test');
            
            if (result.records.length === 1) {
                this.results.connection = true;
                console.log('✅ Neo4j connection successful');
            } else {
                throw new Error('Unexpected result from connection test');
            }
        } catch (error) {
            this.results.errors.push(`Connection failed: ${error.message}`);
            throw error;
        }
    }

    async detectGDSVersion() {
        console.log('🔍 Detecting GDS version...');
        try {
            const result = await this.session.run(
                "CALL gds.debug.sysInfo() YIELD key, value WHERE key = 'gdsVersion' RETURN value LIMIT 1"
            );
            
            if (result.records.length > 0) {
                this.results.gdsVersion = result.records[0].get('value');
                console.log(`✅ GDS Version: ${this.results.gdsVersion}`);
            } else {
                console.log('⚠️  Could not detect GDS version - may not be installed');
            }
        } catch (error) {
            console.log('⚠️  GDS version detection failed - GDS may not be installed');
            this.results.errors.push(`GDS version detection: ${error.message}`);
        }
    }

    async testProcedureAvailability() {
        console.log('🔍 Testing procedure availability...');
        
        try {
            // Get all GDS procedures
            const result = await this.session.run(
                `CALL dbms.procedures() YIELD name WHERE name STARTS WITH 'gds' RETURN name`
            );
            
            const availableProcedures = result.records.map(record => record.get('name'));
            console.log(`📋 Found ${availableProcedures.length} GDS procedures`);

            // Test modern pipeline procedures
            const modernPipelineProcs = [
                'gds.beta.pipeline.linkPrediction.create',
                'gds.beta.pipeline.linkPrediction.addNodeProperty', 
                'gds.beta.pipeline.linkPrediction.addFeature',
                'gds.beta.pipeline.linkPrediction.addLogisticRegression',
                'gds.beta.pipeline.linkPrediction.train',
                'gds.beta.pipeline.linkPrediction.predict.stream',
                'gds.beta.model.list',
                'gds.beta.model.drop',
                'gds.beta.pipeline.drop'
            ];

            const hasModernPipeline = modernPipelineProcs.every(proc => 
                availableProcedures.includes(proc)
            );

            if (hasModernPipeline) {
                this.results.modernPipeline = true;
                console.log('✅ Modern pipeline procedures available');
            } else {
                const missing = modernPipelineProcs.filter(proc => !availableProcedures.includes(proc));
                console.log(`⚠️  Modern pipeline incomplete. Missing: ${missing.join(', ')}`);
            }

            // Test legacy procedures
            const legacyTrainProcs = ['gds.linkprediction.train', 'gds.alpha.linkprediction.train'];
            const legacyPredictProcs = ['gds.linkprediction.predict.stream', 'gds.alpha.linkprediction.predict.stream'];
            
            const hasLegacyTrain = legacyTrainProcs.some(proc => availableProcedures.includes(proc));
            const hasLegacyPredict = legacyPredictProcs.some(proc => availableProcedures.includes(proc));
            
            if (hasLegacyTrain && hasLegacyPredict) {
                this.results.legacyProcedures = true;
                console.log('✅ Legacy link prediction procedures available');
            } else {
                console.log('⚠️  Legacy link prediction procedures not available');
            }

            // Test common procedures
            const commonProcs = [
                'gds.node2vec.write',
                'gds.graph.project',
                'gds.graph.drop'
            ];

            const hasCommonProcs = commonProcs.every(proc => 
                availableProcedures.includes(proc)
            );

            if (hasCommonProcs) {
                this.results.commonProcedures = true;
                console.log('✅ Common GDS procedures available');
            } else {
                const missing = commonProcs.filter(proc => !availableProcedures.includes(proc));
                console.log(`❌ Missing common procedures: ${missing.join(', ')}`);
                this.results.errors.push(`Missing common procedures: ${missing.join(', ')}`);
            }

        } catch (error) {
            this.results.errors.push(`Procedure availability test: ${error.message}`);
            throw error;
        }
    }

    async testBasicExecution() {
        console.log('🧪 Testing basic procedure execution...');
        
        try {
            // Create a minimal test graph
            await this.session.run(`
                CREATE (a:TestNode {id: 1, name: 'Node A'})
                CREATE (b:TestNode {id: 2, name: 'Node B'})  
                CREATE (c:TestNode {id: 3, name: 'Node C'})
                CREATE (a)-[:TEST_REL]->(b)
                CREATE (b)-[:TEST_REL]->(c)
            `);

            // Clean up any existing test graph
            await this.session.run(`CALL gds.graph.drop($graphName, false)`, { graphName: TEST_GRAPH_NAME }).catch(() => {});

            // Test graph projection
            await this.session.run(`
                CALL gds.graph.project($graphName, 'TestNode', 'TEST_REL')
            `, { graphName: TEST_GRAPH_NAME });

            console.log('✅ Graph projection successful');

            // Test Node2Vec (if available)
            if (this.results.commonProcedures) {
                try {
                    await this.session.run(`
                        CALL gds.node2vec.write($graphName, { 
                            writeProperty: 'smokeTestEmbedding',
                            embeddingDimension: 8,
                            iterations: 1
                        })
                    `, { graphName: TEST_GRAPH_NAME });
                    console.log('✅ Node2Vec execution successful');
                } catch (node2vecError) {
                    console.log('⚠️  Node2Vec test failed:', node2vecError.message);
                }
            }

            // Test modern pipeline creation (if available)
            if (this.results.modernPipeline) {
                try {
                    const testPipelineName = 'smokeTestPipeline';
                    
                    await this.session.run(`CALL gds.beta.pipeline.drop($pipelineName, false)`, { pipelineName: testPipelineName }).catch(() => {});
                    
                    await this.session.run(`CALL gds.beta.pipeline.linkPrediction.create($pipelineName)`, { pipelineName: testPipelineName });
                    
                    console.log('✅ Modern pipeline creation successful');
                    
                    // Clean up
                    await this.session.run(`CALL gds.beta.pipeline.drop($pipelineName, false)`, { pipelineName: testPipelineName }).catch(() => {});
                } catch (pipelineError) {
                    console.log('⚠️  Modern pipeline test failed:', pipelineError.message);
                }
            }

            this.results.testExecution = true;

        } catch (error) {
            this.results.errors.push(`Basic execution test: ${error.message}`);
            throw error;
        } finally {
            // Clean up test data
            await this.session.run(`CALL gds.graph.drop($graphName, false)`, { graphName: TEST_GRAPH_NAME }).catch(() => {});
            await this.session.run(`MATCH (n:TestNode) DETACH DELETE n`).catch(() => {});
        }
    }

    isHealthy() {
        return this.results.connection && 
               this.results.commonProcedures && 
               (this.results.modernPipeline || this.results.legacyProcedures) &&
               this.results.testExecution;
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        console.log(`🔌 Connection: ${this.results.connection ? '✅' : '❌'}`);
        console.log(`📦 GDS Version: ${this.results.gdsVersion || 'Unknown'}`);
        console.log(`🚀 Modern Pipeline: ${this.results.modernPipeline ? '✅' : '❌'}`);
        console.log(`🔙 Legacy Procedures: ${this.results.legacyProcedures ? '✅' : '❌'}`);
        console.log(`🛠️  Common Procedures: ${this.results.commonProcedures ? '✅' : '❌'}`);
        console.log(`🧪 Execution Test: ${this.results.testExecution ? '✅' : '❌'}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        console.log('\n💡 Recommendations:');
        if (!this.results.connection) {
            console.log('   - Check Neo4j connection settings');
        }
        if (!this.results.commonProcedures) {
            console.log('   - Install Graph Data Science plugin');
        }
        if (!this.results.modernPipeline && !this.results.legacyProcedures) {
            console.log('   - Hidden Links will not work - no link prediction procedures available');
        } else if (!this.results.modernPipeline) {
            console.log('   - Consider upgrading to GDS 2.0+ for better performance');
        }
    }

    async cleanup() {
        if (this.session) {
            await this.session.close();
        }
        if (this.driver) {
            await this.driver.close();
        }
    }
}

// Run the smoke test
if (require.main === module) {
    const smokeTest = new GDSSmokeTest();
    smokeTest.run().catch(error => {
        console.error('Smoke test failed:', error);
        process.exit(1);
    });
}

module.exports = GDSSmokeTest; 