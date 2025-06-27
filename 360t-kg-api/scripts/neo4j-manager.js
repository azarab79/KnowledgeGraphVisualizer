#!/usr/bin/env node

/**
 * Neo4j Manager Script
 * 
 * Task 7: Replace `pkill` dev restart with graceful Neo4j shutdown / startup script
 * 
 * This script provides graceful Neo4j management commands to avoid hard-kill restarts
 * that can leave Neo4j in partial procedure registration state.
 */

const neo4j = require('neo4j-driver');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

class Neo4jManager {
    constructor() {
        this.driver = null;
        this.neo4jProcess = null;
    }

    async checkConnection() {
        console.log('🔍 Checking Neo4j connection...');
        try {
            this.driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
            const session = this.driver.session({ database: NEO4J_DATABASE });
            
            await session.run('RETURN 1 as test');
            await session.close();
            
            console.log('✅ Neo4j is connected and responsive');
            return true;
        } catch (error) {
            console.log('❌ Neo4j connection failed:', error.message);
            return false;
        } finally {
            if (this.driver) {
                await this.driver.close();
                this.driver = null;
            }
        }
    }

    async gracefulShutdown() {
        console.log('🛑 Initiating graceful Neo4j shutdown...');
        
        try {
            // First, try to connect and perform graceful database shutdown
            this.driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
            const session = this.driver.session({ database: NEO4J_DATABASE });
            
            console.log('📊 Checking active transactions...');
            try {
                const result = await session.run('SHOW TRANSACTIONS');
                const activeTransactions = result.records.length;
                
                if (activeTransactions > 0) {
                    console.log(`⚠️  Found ${activeTransactions} active transactions`);
                    console.log('⏳ Waiting for transactions to complete (max 30s)...');
                    
                    // Wait for transactions to complete
                    await this.waitForTransactionsToComplete(session, 30000);
                }
            } catch (transactionError) {
                console.log('⚠️  Could not check transactions (Neo4j version may not support SHOW TRANSACTIONS)');
            }

            // Clean up any GDS catalog objects that might prevent clean restart
            console.log('🧹 Cleaning up GDS catalog objects...');
            try {
                await this.cleanupGDSCatalog(session);
            } catch (gdsError) {
                console.log('⚠️  GDS cleanup failed (GDS may not be installed):', gdsError.message);
            }

            await session.close();
            await this.driver.close();
            this.driver = null;
            
            console.log('✅ Database-level shutdown complete');
            
        } catch (connectionError) {
            console.log('⚠️  Could not connect for graceful shutdown:', connectionError.message);
            console.log('🔄 Proceeding with process-level shutdown...');
        }

        // Now perform process-level shutdown
        await this.shutdownNeo4jProcess();
    }

    async waitForTransactionsToComplete(session, timeoutMs) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            try {
                const result = await session.run('SHOW TRANSACTIONS');
                if (result.records.length === 0) {
                    console.log('✅ All transactions completed');
                    return;
                }
                
                console.log(`⏳ ${result.records.length} transactions still active...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.log('⚠️  Error checking transactions:', error.message);
                break;
            }
        }
        
        console.log('⏰ Timeout reached, proceeding with shutdown');
    }

    async cleanupGDSCatalog(session) {
        console.log('🧹 Cleaning up GDS graphs, models, and pipelines...');
        
        try {
            // Get all graphs
            const graphsResult = await session.run('CALL gds.graph.list() YIELD graphName');
            for (const record of graphsResult.records) {
                const graphName = record.get('graphName');
                console.log(`  Dropping graph: ${graphName}`);
                await session.run('CALL gds.graph.drop($graphName, false)', { graphName }).catch(() => {});
            }
        } catch (e) {
            console.log('  ⚠️  Could not list/drop graphs');
        }

        try {
            // Get all models (if beta.model.list exists)
            const modelsResult = await session.run('CALL gds.beta.model.list() YIELD modelName');
            for (const record of modelsResult.records) {
                const modelName = record.get('modelName');
                console.log(`  Dropping model: ${modelName}`);
                await session.run('CALL gds.beta.model.drop($modelName, false)', { modelName }).catch(() => {});
            }
        } catch (e) {
            console.log('  ⚠️  Could not list/drop models (GDS version may not support this)');
        }

        try {
            // Get all pipelines (if beta.pipeline.list exists)
            const pipelinesResult = await session.run('CALL gds.beta.pipeline.list() YIELD pipelineName');
            for (const record of pipelinesResult.records) {
                const pipelineName = record.get('pipelineName');
                console.log(`  Dropping pipeline: ${pipelineName}`);
                await session.run('CALL gds.beta.pipeline.drop($pipelineName, false)', { pipelineName }).catch(() => {});
            }
        } catch (e) {
            console.log('  ⚠️  Could not list/drop pipelines (GDS version may not support this)');
        }

        console.log('✅ GDS catalog cleanup completed');
    }

    async shutdownNeo4jProcess() {
        console.log('🛑 Stopping Neo4j process...');
        
        return new Promise((resolve) => {
            // Try different Neo4j shutdown methods based on installation type
            const shutdownMethods = [
                'neo4j stop',                    // Standard Neo4j installation
                'brew services stop neo4j',     // Homebrew on macOS
                'systemctl stop neo4j',         // systemd Linux
                'service neo4j stop',           // SysV Linux
            ];

            let methodIndex = 0;
            
            const tryNextMethod = () => {
                if (methodIndex >= shutdownMethods.length) {
                    console.log('⚠️  All shutdown methods failed, trying process kill...');
                    this.killNeo4jProcesses();
                    resolve();
                    return;
                }

                const method = shutdownMethods[methodIndex++];
                console.log(`  Trying: ${method}`);
                
                exec(method, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`  ❌ Failed: ${error.message}`);
                        tryNextMethod();
                    } else {
                        console.log('✅ Neo4j stopped successfully');
                        resolve();
                    }
                });
            };

            tryNextMethod();
        });
    }

    killNeo4jProcesses() {
        console.log('⚠️  Using process kill as last resort...');
        
        // Find and kill Neo4j processes
        exec('pgrep -f neo4j', (error, stdout, stderr) => {
            if (stdout.trim()) {
                const pids = stdout.trim().split('\n');
                console.log(`  Found Neo4j processes: ${pids.join(', ')}`);
                
                pids.forEach(pid => {
                    exec(`kill -TERM ${pid}`, (killError) => {
                        if (killError) {
                            console.log(`  ⚠️  SIGTERM failed for PID ${pid}, trying SIGKILL...`);
                            exec(`kill -KILL ${pid}`, () => {});
                        } else {
                            console.log(`  ✅ Sent SIGTERM to PID ${pid}`);
                        }
                    });
                });
            } else {
                console.log('  ℹ️  No Neo4j processes found');
            }
        });
    }

    async startNeo4j() {
        console.log('🚀 Starting Neo4j...');
        
        return new Promise((resolve, reject) => {
            const startupMethods = [
                'neo4j start',                    // Standard Neo4j installation
                'brew services start neo4j',     // Homebrew on macOS
                'systemctl start neo4j',         // systemd Linux
                'service neo4j start',           // SysV Linux
            ];

            let methodIndex = 0;
            
            const tryNextMethod = () => {
                if (methodIndex >= startupMethods.length) {
                    reject(new Error('All startup methods failed'));
                    return;
                }

                const method = startupMethods[methodIndex++];
                console.log(`  Trying: ${method}`);
                
                exec(method, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`  ❌ Failed: ${error.message}`);
                        tryNextMethod();
                    } else {
                        console.log('✅ Neo4j startup initiated');
                        resolve();
                    }
                });
            };

            tryNextMethod();
        });
    }

    async waitForNeo4jReady(maxWaitMs = 60000) {
        console.log('⏳ Waiting for Neo4j to be ready...');
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            if (await this.checkConnection()) {
                console.log('✅ Neo4j is ready!');
                return true;
            }
            
            console.log('  ⏳ Still waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('❌ Timeout waiting for Neo4j to be ready');
        return false;
    }

    async restart() {
        console.log('🔄 Restarting Neo4j gracefully...\n');
        
        await this.gracefulShutdown();
        
        console.log('\n⏳ Waiting 3 seconds before restart...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await this.startNeo4j();
        
        const isReady = await this.waitForNeo4jReady();
        
        if (isReady) {
            console.log('\n🎉 Neo4j restart completed successfully!');
        } else {
            console.log('\n❌ Neo4j restart may have failed - check logs');
            process.exit(1);
        }
    }

    async status() {
        console.log('📊 Neo4j Status Check\n');
        
        const isConnected = await this.checkConnection();
        
        if (isConnected) {
            try {
                this.driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
                const session = this.driver.session({ database: NEO4J_DATABASE });
                
                // Get basic info
                const dbInfoResult = await session.run('CALL dbms.components() YIELD name, versions, edition');
                console.log('📦 Neo4j Components:');
                for (const record of dbInfoResult.records) {
                    const name = record.get('name');
                    const versions = record.get('versions');
                    const edition = record.get('edition');
                    console.log(`  ${name}: ${versions[0]} (${edition})`);
                }
                
                // Check GDS if available
                try {
                    const gdsResult = await session.run("CALL gds.debug.sysInfo() YIELD key, value WHERE key = 'gdsVersion' RETURN value LIMIT 1");
                    if (gdsResult.records.length > 0) {
                        console.log(`📊 GDS Version: ${gdsResult.records[0].get('value')}`);
                    }
                } catch (e) {
                    console.log('⚠️  GDS not available');
                }
                
                await session.close();
                await this.driver.close();
                
            } catch (error) {
                console.log('⚠️  Could not get detailed status:', error.message);
            }
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const manager = new Neo4jManager();
    
    try {
        switch (command) {
            case 'start':
                await manager.startNeo4j();
                await manager.waitForNeo4jReady();
                break;
                
            case 'stop':
                await manager.gracefulShutdown();
                break;
                
            case 'restart':
                await manager.restart();
                break;
                
            case 'status':
                await manager.status();
                break;
                
            case 'check':
                await manager.checkConnection();
                break;
                
            default:
                console.log(`
Neo4j Manager - Graceful Neo4j Management

Usage: node neo4j-manager.js <command>

Commands:
  start    - Start Neo4j
  stop     - Gracefully stop Neo4j  
  restart  - Gracefully restart Neo4j
  status   - Show Neo4j status and version info
  check    - Check if Neo4j is running and responsive

Environment Variables:
  NEO4J_URI      - Neo4j connection URI (default: bolt://localhost:7687)
  NEO4J_USER     - Neo4j username (default: neo4j)
  NEO4J_PASSWORD - Neo4j password (default: password)
  NEO4J_DATABASE - Neo4j database name (default: neo4j)
                `);
                break;
        }
    } catch (error) {
        console.error('❌ Command failed:', error.message);
        process.exit(1);
    }
}

// Run CLI if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = Neo4jManager; 