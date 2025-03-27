# Troubleshooting Guide

This guide provides solutions for common issues encountered while using the 360T Knowledge Graph system.

## Database Connection Issues

### 1. Neo4j Connection Failed

**Symptoms:**
- API returns connection errors
- Unable to access Neo4j Browser
- `Error: Connection refused`

**Solutions:**

1. Check Neo4j Service Status:
```bash
# Check service status
sudo systemctl status neo4j

# Restart service if needed
sudo systemctl restart neo4j

# Check logs
sudo journalctl -u neo4j -n 100
```

2. Verify Connection Settings:
```javascript
// Check .env file
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

// Test connection manually
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session();
```

3. Network Configuration:
```bash
# Check if ports are open
netstat -tulpn | grep LISTEN

# Test connection
telnet localhost 7687
```

### 2. Authentication Failed

**Symptoms:**
- `Neo.ClientError.Security.Unauthorized`
- Unable to log in to Neo4j Browser
- API authentication errors

**Solutions:**

1. Reset Neo4j Password:
```bash
# Stop Neo4j
sudo systemctl stop neo4j

# Reset password
neo4j-admin set-initial-password new-password

# Start Neo4j
sudo systemctl start neo4j
```

2. Update Configuration:
```bash
# Update .env file
nano .env
# Update NEO4J_PASSWORD=new-password

# Restart API server
npm restart
```

## API Issues

### 1. API Server Won't Start

**Symptoms:**
- `EADDRINUSE` error
- Server fails to start
- Port conflicts

**Solutions:**

1. Check Port Usage:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

2. Change Port:
```javascript
// In config/default.json
{
  "port": 3001  // Change to available port
}
```

3. Check Dependencies:
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Check for errors
npm audit
```

### 2. API Performance Issues

**Symptoms:**
- Slow response times
- Timeouts
- High memory usage

**Solutions:**

1. Enable Debug Logging:
```javascript
// Set environment variable
LOG_LEVEL=debug

// Check logs
tail -f logs/app.log
```

2. Monitor Resources:
```bash
# Check CPU and memory
top -p $(pgrep -d',' node)

# Check disk usage
df -h
```

3. Optimize Queries:
```cypher
// Use PROFILE to analyze queries
PROFILE MATCH (n)-[r]->(m) RETURN n, r, m;

// Add indexes
CREATE INDEX module_name FOR (n:Module) ON (n.name);
```

## Data Issues

### 1. Data Inconsistency

**Symptoms:**
- Missing relationships
- Duplicate nodes
- Incorrect properties

**Solutions:**

1. Check Data Integrity:
```cypher
// Find duplicate nodes
MATCH (n:Module)
WITH n.name as name, collect(n) as nodes
WHERE size(nodes) > 1
RETURN name, nodes;

// Find orphaned nodes
MATCH (n)
WHERE NOT (n)--()
RETURN n;
```

2. Fix Relationships:
```cypher
// Create missing relationships
MATCH (m:Module {name: 'ModuleName'})
MATCH (w:Workflow {name: 'WorkflowName'})
WHERE NOT (m)-[:CONTAINS]->(w)
CREATE (m)-[:CONTAINS]->(w);

// Remove duplicate relationships
MATCH (n)-[r]->(m)
WITH n, m, type(r) as type, collect(r) as rels
WHERE size(rels) > 1
UNWIND tail(rels) as rel
DELETE rel;
```

3. Data Cleanup:
```cypher
// Remove invalid properties
MATCH (n)
WHERE n.invalidProperty IS NOT NULL
REMOVE n.invalidProperty;

// Fix property types
MATCH (n:Module)
WHERE NOT toString(n.version) STARTS WITH 'v'
SET n.version = 'v' + n.version;
```

### 2. Data Loading Failures

**Symptoms:**
- Import errors
- Missing data
- Constraint violations

**Solutions:**

1. Check Constraints:
```cypher
// List constraints
SHOW CONSTRAINTS;

// Drop problematic constraint
DROP CONSTRAINT constraint_name;
```

2. Validate Data:
```javascript
// Add validation middleware
const validateModule = (req, res, next) => {
  const { name, version } = req.body;
  if (!name || !version) {
    return next(new ValidationError('Name and version required'));
  }
  next();
};
```

3. Transaction Management:
```javascript
// Use transactions for data loading
const session = driver.session();
try {
  await session.executeWrite(async tx => {
    await tx.run('MATCH (n) DETACH DELETE n');
    await tx.run('LOAD CSV ... ');
  });
} finally {
  await session.close();
}
```

## Security Issues

### 1. Authentication Problems

**Symptoms:**
- Token validation errors
- Unauthorized access
- Session issues

**Solutions:**

1. Check JWT Configuration:
```javascript
// Verify JWT settings
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
```

2. Session Management:
```javascript
// Clear expired sessions
CALL dbms.security.clearAuthCache();

// Review active sessions
CALL dbms.listConnections();
```

3. Update Security Settings:
```conf
# neo4j.conf
dbms.security.auth_enabled=true
dbms.security.authentication_providers=native
```

### 2. Access Control Issues

**Symptoms:**
- Permission denied errors
- Unauthorized operations
- Role conflicts

**Solutions:**

1. Review User Roles:
```cypher
// Check user roles
SHOW USER neo4j PRIVILEGES;

// Grant missing privileges
GRANT ROLE editor TO username;
```

2. Update Middleware:
```javascript
// Add role-based access control
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient privileges'));
    }
    next();
  };
};
```

## Performance Issues

### 1. Query Performance

**Symptoms:**
- Slow query execution
- High memory usage
- Timeouts

**Solutions:**

1. Query Optimization:
```cypher
// Use EXPLAIN/PROFILE
PROFILE MATCH path = (m:Module)-[*]->(n)
RETURN path;

// Add indexes
CREATE INDEX module_name FOR (n:Module) ON (n.name);
```

2. Query Patterns:
```cypher
// Instead of
MATCH (n)-[*]->(m)

// Use
MATCH (n)-[*1..3]->(m)
```

3. Caching:
```javascript
// Implement caching
const cache = require('memory-cache');

const getCachedData = async (key, fetchFn) => {
  const cached = cache.get(key);
  if (cached) return cached;
  
  const data = await fetchFn();
  cache.put(key, data, 300000); // 5 minutes
  return data;
};
```

### 2. Memory Issues

**Symptoms:**
- Out of memory errors
- High memory usage
- System slowdown

**Solutions:**

1. Monitor Memory:
```bash
# Check memory usage
free -m

# Monitor Node.js process
node --max-old-space-size=4096 server.js
```

2. Memory Optimization:
```javascript
// Implement pagination
const getModules = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = `
    MATCH (m:Module)
    RETURN m
    SKIP $skip
    LIMIT $limit
  `;
  return await session.run(query, { skip, limit });
};
```

## Additional Troubleshooting Scenarios

### 1. Data Import/Export Issues

**Symptoms:**
- CSV import failures
- Export timeouts
- Data format errors
- Missing relationships after import

**Solutions:**

1. CSV Import Issues:
```cypher
// Check CSV data format
LOAD CSV WITH HEADERS FROM 'file:///data.csv' AS row
RETURN row LIMIT 5;

// Handle null values
LOAD CSV WITH HEADERS FROM 'file:///data.csv' AS row
WHERE row.name IS NOT NULL
CREATE (n:Module {
  name: row.name,
  version: COALESCE(row.version, 'unknown')
});
```

2. Export Issues:
```bash
# For large exports, use neo4j-admin
neo4j-admin dump --database=neo4j --to=/backup/export.dump

# For CSV exports, use APOC
CALL apoc.export.csv.query(
  "MATCH (n:Module) RETURN n",
  "/exports/modules.csv",
  {}
);
```

### 2. Graph Visualization Problems

**Symptoms:**
- Browser crashes with large datasets
- Unclear relationship visualization
- Performance issues with complex queries

**Solutions:**

1. Handle Large Datasets:
```cypher
// Instead of showing everything
MATCH (n)
RETURN n;

// Show specific patterns with limits
MATCH (m:Module)
OPTIONAL MATCH (m)-[r]->(n)
RETURN m, r, n
LIMIT 50;
```

2. Improve Visualization:
```cypher
// Use custom styling
:style
node {
  diameter: 65px;
  color: #A5ABB6;
  text-color-internal: #FFFFFF;
}
relationship {
  shaft-width: 1px;
  font-size: 8px;
}

// Group related nodes
MATCH (m:Module)-[r]->(n)
RETURN m, collect(r), collect(n);
```

### 3. API Integration Issues

**Symptoms:**
- CORS errors
- Rate limiting problems
- Webhook failures
- Authentication token issues

**Solutions:**

1. CORS Configuration:
```javascript
// Update API CORS settings
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

2. Rate Limiting:
```javascript
// Implement custom rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', apiLimiter);
```

### 4. Data Consistency Issues

**Symptoms:**
- Inconsistent relationship directions
- Missing required properties
- Invalid data types
- Duplicate relationships

**Solutions:**

1. Check Data Consistency:
```cypher
// Find nodes with missing required properties
MATCH (n:Module)
WHERE NOT EXISTS(n.name) OR NOT EXISTS(n.version)
RETURN n;

// Find invalid relationship directions
MATCH (n)-[r:VALIDATES]->(m)
WHERE NOT n:TestCase
RETURN n, r, m;
```

2. Fix Data Issues:
```cypher
// Fix relationship directions
MATCH (n)-[r:VALIDATES]->(m)
WHERE NOT n:TestCase
WITH n, r, m
CREATE (m)<-[r2:VALIDATES]-(n)
DELETE r;

// Set default values for missing properties
MATCH (n:Module)
WHERE NOT EXISTS(n.version)
SET n.version = 'unknown';
```

### 5. Performance Degradation Over Time

**Symptoms:**
- Gradually increasing query times
- Growing memory usage
- Slower API responses
- Database size issues

**Solutions:**

1. Database Maintenance:
```cypher
// Analyze database statistics
CALL db.stats.retrieve();

// Clear query cache
CALL db.clearQueryCaches();

// Force index recomputation
CALL db.index.fulltext.awaitEventuallyConsistency(30);
```

2. Performance Monitoring:
```javascript
// Add performance monitoring
const responseTime = require('response-time');

app.use(responseTime((req, res, time) => {
  logger.info('API Response Time', {
    method: req.method,
    url: req.url,
    time: time
  });
}));
```

### 6. Backup and Recovery Problems

**Symptoms:**
- Failed backups
- Corrupt backup files
- Incomplete restoration
- Long backup times

**Solutions:**

1. Backup Issues:
```bash
# Check backup consistency
neo4j-admin check --database=neo4j

# Verify backup
neo4j-admin verify --database=neo4j --backup-dir=/backup

# Optimize backup size
neo4j-admin dump --database=neo4j --to=/backup/backup.dump --compress=true
```

2. Recovery Procedures:
```bash
# Safe restore procedure
systemctl stop neo4j
neo4j-admin load --from=/backup/backup.dump --database=neo4j --force
systemctl start neo4j

# Verify after restore
MATCH (n)
RETURN count(n) as nodeCount;
```

### 7. Environment-Specific Issues

**Symptoms:**
- Different behavior in production
- Configuration mismatches
- Environment variable problems
- Path resolution issues

**Solutions:**

1. Environment Configuration:
```javascript
// Use environment-specific config
const config = require('config');
const dbConfig = config.get('database');

// Validate environment variables
const requiredEnvVars = [
  'NEO4J_URI',
  'NEO4J_USER',
  'NEO4J_PASSWORD',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

2. Path Resolution:
```javascript
// Use path resolution
const path = require('path');
const configPath = path.resolve(__dirname, '../config');
const logsPath = path.resolve(__dirname, '../logs');

// Check directory permissions
try {
  fs.accessSync(logsPath, fs.constants.W_OK);
} catch (err) {
  logger.error(`Cannot write to logs directory: ${err.message}`);
}
```

ValidationError
- Check input data
- Review validation rules
- Update error handling

MemoryError
- Monitor memory usage
- Implement pagination
- Review query optimization
```

## Best Practices

1. Regular Maintenance
   - Monitor system resources
   - Review error logs
   - Update documentation
   - Test backup/restore procedures

2. Performance Optimization
   - Use appropriate indexes
   - Implement caching
   - Monitor query performance
   - Regular performance reviews

3. Security Measures
   - Regular security audits
   - Update access controls
   - Monitor suspicious activity
   - Keep systems updated

4. Documentation
   - Keep troubleshooting guide updated
   - Document common issues
   - Maintain solution database
   - Share best practices 