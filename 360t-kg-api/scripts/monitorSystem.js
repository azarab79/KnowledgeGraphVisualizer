// Script to monitor Neo4j database and API system health
const neo4j = require('neo4j-driver');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Neo4j connection
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// API connection
const apiUrl = process.env.API_URL || 'http://localhost:3000';

// Output directory for monitoring reports
const outputDir = path.join(__dirname, '../reports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Log file
const logFile = path.join(outputDir, 'system-monitoring.log');

// Write to log file
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  // Console output
  if (level === 'ERROR') {
    console.error(logEntry);
  } else {
    console.log(logEntry);
  }
  
  // Append to log file
  fs.appendFileSync(logFile, logEntry);
}

// Monitor Neo4j database
async function monitorDatabase() {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  
  try {
    log('Starting Neo4j database monitoring...');
    
    // Check database connectivity
    const connectionResult = await session.run('RETURN 1 as result');
    if (connectionResult.records[0].get('result').toNumber() === 1) {
      log('Neo4j database connection successful');
    }
    
    // Query database statistics
    const dbStats = await session.run(`
      CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Transactions")
      YIELD attributes
      WITH attributes.NumberOfOpenTransactions.value AS openTransactions,
           attributes.PeakNumberOfConcurrentTransactions.value AS peakTransactions,
           attributes.NumberOfOpenedTransactions.value AS totalTransactions
      RETURN openTransactions, peakTransactions, totalTransactions
    `);
    
    const stats = dbStats.records[0];
    log(`Open Transactions: ${stats.get('openTransactions')}`);
    log(`Peak Concurrent Transactions: ${stats.get('peakTransactions')}`);
    log(`Total Transactions: ${stats.get('totalTransactions')}`);
    
    // Query node counts
    const nodeCounts = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] AS nodeType, count(n) AS count
      ORDER BY count DESC
    `);
    
    log('Node Counts:');
    nodeCounts.records.forEach(record => {
      log(`  ${record.get('nodeType')}: ${record.get('count').toNumber()}`);
    });
    
    // Check for slow queries
    const slowQueries = await session.run(`
      CALL dbms.listQueries()
      YIELD queryId, username, metaData, query, parameters, planner, runtime, indexes, startTime, protocol, clientAddress, requestUri, status, resourceInformation, activeLockCount, elapsedTimeMillis
      WHERE elapsedTimeMillis > 1000
      RETURN queryId, query, elapsedTimeMillis
      ORDER BY elapsedTimeMillis DESC
    `);
    
    if (slowQueries.records.length > 0) {
      log(`Found ${slowQueries.records.length} slow queries:`, 'WARNING');
      slowQueries.records.forEach(record => {
        log(`  Query ID: ${record.get('queryId')}, Time: ${record.get('elapsedTimeMillis')}ms`, 'WARNING');
      });
    } else {
      log('No slow queries detected');
    }
    
    // Check system resources
    const dbResource = await session.run(`
      CALL dbms.queryJmx("java.lang:type=Memory")
      YIELD attributes
      RETURN 
        attributes.HeapMemoryUsage.value.used AS heapUsed,
        attributes.HeapMemoryUsage.value.committed AS heapCommitted,
        attributes.HeapMemoryUsage.value.max AS heapMax
    `);
    
    const memory = dbResource.records[0];
    const heapUsed = memory.get('heapUsed');
    const heapCommitted = memory.get('heapCommitted');
    const heapMax = memory.get('heapMax');
    const heapUsagePercent = (heapUsed / heapMax) * 100;
    
    log(`Memory Usage: ${Math.round(heapUsed / (1024 * 1024))}MB / ${Math.round(heapMax / (1024 * 1024))}MB (${Math.round(heapUsagePercent)}%)`);
    
    if (heapUsagePercent > 80) {
      log(`High memory usage detected: ${Math.round(heapUsagePercent)}%`, 'WARNING');
    }
    
    // Generate database health report
    const dbHealth = {
      timestamp: new Date().toISOString(),
      connection: 'OK',
      transactions: {
        open: stats.get('openTransactions'),
        peak: stats.get('peakTransactions'),
        total: stats.get('totalTransactions')
      },
      nodeCounts: nodeCounts.records.map(record => ({
        type: record.get('nodeType'),
        count: record.get('count').toNumber()
      })),
      slowQueries: slowQueries.records.map(record => ({
        id: record.get('queryId'),
        time: record.get('elapsedTimeMillis'),
        query: record.get('query')
      })),
      memory: {
        used: Math.round(heapUsed / (1024 * 1024)),
        committed: Math.round(heapCommitted / (1024 * 1024)),
        max: Math.round(heapMax / (1024 * 1024)),
        usagePercent: Math.round(heapUsagePercent)
      }
    };
    
    return dbHealth;
  } catch (error) {
    log(`Database monitoring error: ${error.message}`, 'ERROR');
    return {
      timestamp: new Date().toISOString(),
      connection: 'ERROR',
      error: error.message
    };
  } finally {
    await session.close();
    await driver.close();
  }
}

// Monitor API
async function monitorApi() {
  try {
    log('Starting API monitoring...');
    
    // Check API health endpoint
    const healthResponse = await axios.get(`${apiUrl}/health`);
    log(`API health check: ${healthResponse.status} ${healthResponse.statusText}`);
    
    // Check response time
    const startTime = Date.now();
    await axios.get(`${apiUrl}/api/modules`);
    const responseTime = Date.now() - startTime;
    log(`API response time: ${responseTime}ms`);
    
    if (responseTime > 500) {
      log(`Slow API response detected: ${responseTime}ms`, 'WARNING');
    }
    
    // Generate API health report
    const apiHealth = {
      timestamp: new Date().toISOString(),
      status: healthResponse.status,
      responseTime: responseTime,
      health: healthResponse.data
    };
    
    return apiHealth;
  } catch (error) {
    log(`API monitoring error: ${error.message}`, 'ERROR');
    return {
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      error: error.message
    };
  }
}

// Monitor system resources
function monitorSystem() {
  try {
    log('Starting system monitoring...');
    
    // CPU usage
    const cpuCount = os.cpus().length;
    const loadAvg = os.loadavg();
    const cpuLoad = loadAvg[0] / cpuCount;
    
    log(`CPU Count: ${cpuCount}`);
    log(`Load Average (1/5/15 min): ${loadAvg.join('/')}`);
    log(`CPU Load: ${Math.round(cpuLoad * 100)}%`);
    
    if (cpuLoad > 0.8) {
      log(`High CPU load detected: ${Math.round(cpuLoad * 100)}%`, 'WARNING');
    }
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    
    log(`Memory: ${Math.round(usedMem / (1024 * 1024 * 1024))}GB / ${Math.round(totalMem / (1024 * 1024 * 1024))}GB (${Math.round(memUsagePercent)}%)`);
    
    if (memUsagePercent > 90) {
      log(`High memory usage detected: ${Math.round(memUsagePercent)}%`, 'WARNING');
    }
    
    // Disk space
    // Note: This would typically require a more complex implementation or external library
    // For simplicity, we'll just use a placeholder
    log('Disk space monitoring would be implemented here');
    
    // Generate system health report
    const systemHealth = {
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: os.uptime(),
      cpu: {
        count: cpuCount,
        loadAvg: loadAvg,
        load: Math.round(cpuLoad * 100)
      },
      memory: {
        total: Math.round(totalMem / (1024 * 1024 * 1024)),
        free: Math.round(freeMem / (1024 * 1024 * 1024)),
        used: Math.round(usedMem / (1024 * 1024 * 1024)),
        percent: Math.round(memUsagePercent)
      }
    };
    
    return systemHealth;
  } catch (error) {
    log(`System monitoring error: ${error.message}`, 'ERROR');
    return {
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      error: error.message
    };
  }
}

// Run all monitoring checks
async function runMonitoring() {
  try {
    log('Starting comprehensive system monitoring...');
    
    // Run all monitors
    const dbHealth = await monitorDatabase();
    const apiHealth = await monitorApi();
    const systemHealth = monitorSystem();
    
    // Generate comprehensive health report
    const healthReport = {
      timestamp: new Date().toISOString(),
      database: dbHealth,
      api: apiHealth,
      system: systemHealth,
      status: 
        dbHealth.connection === 'OK' && 
        apiHealth.status === 200 && 
        systemHealth.cpu.load < 80 && 
        systemHealth.memory.percent < 90 
          ? 'HEALTHY' 
          : 'WARNING'
    };
    
    // Save health report
    const reportPath = path.join(outputDir, 'health-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(healthReport, null, 2));
    log(`Health report saved to ${reportPath}`);
    
    return healthReport;
  } catch (error) {
    log(`Monitoring failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  runMonitoring()
    .then(report => {
      log(`Monitoring completed with status: ${report.status}`);
      
      // Exit with error code if status is not HEALTHY
      if (report.status !== 'HEALTHY') {
        process.exit(1);
      }
    })
    .catch(error => {
      log(`Monitoring failed: ${error.message}`, 'ERROR');
      process.exit(1);
    });
}

module.exports = { runMonitoring }; 