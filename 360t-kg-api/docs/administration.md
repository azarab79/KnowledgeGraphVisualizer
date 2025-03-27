# Administration Guide

This guide provides detailed information about administering and maintaining the 360T Knowledge Graph system.

## System Architecture

### Components
1. **Neo4j Database**
   - Version: Neo4j Enterprise 5.x
   - Port: 7474 (HTTP), 7687 (Bolt)
   - Configuration: `/etc/neo4j/neo4j.conf`

2. **API Server**
   - Node.js Express application
   - Port: 3000
   - Configuration: `config/default.json`

3. **Authentication Service**
   - JWT-based authentication
   - Token management
   - User sessions

## Installation and Setup

### 1. Neo4j Setup

```bash
# Install Neo4j
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
sudo apt-get install neo4j-enterprise

# Start Neo4j service
sudo systemctl start neo4j
sudo systemctl enable neo4j

# Verify installation
sudo systemctl status neo4j
```

### 2. API Server Setup

```bash
# Clone repository
git clone https://github.com/360t/knowledge-graph-api.git
cd knowledge-graph-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Start server
npm start
```

## User Management

### 1. Creating Users

```cypher
// Create new user
CREATE USER username
SET PASSWORD 'secure-password'
SET STATUS ACTIVE;

// Grant roles
GRANT ROLE reader TO username;
GRANT ROLE editor TO username;
```

### 2. Managing Roles

```cypher
// Available roles
SHOW ROLES;

// Create custom role
CREATE ROLE custom_role
    AS COPY OF reader
    GRANT MERGE ON GRAPH *
    GRANT CREATE ON GRAPH *;

// Review role privileges
SHOW ROLE custom_role PRIVILEGES;
```

### 3. Password Management

```cypher
// Change user password
ALTER USER username
SET PASSWORD 'new-password'
CHANGE NOT REQUIRED;

// Force password change
ALTER USER username
SET PASSWORD 'temporary-password'
CHANGE REQUIRED;
```

## Backup and Recovery

### 1. Backup Procedures

```bash
# Full backup
neo4j-admin dump --database=neo4j --to=/backup/full-backup-$(date +%Y%m%d).dump

# Incremental backup
neo4j-admin dump --database=neo4j --to=/backup/incremental-$(date +%Y%m%d).dump --incremental

# Automated backup script
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d)
neo4j-admin dump --database=neo4j --to=$BACKUP_DIR/backup-$DATE.dump
find $BACKUP_DIR -name "backup-*.dump" -mtime +30 -delete
```

### 2. Recovery Procedures

```bash
# Stop Neo4j service
sudo systemctl stop neo4j

# Restore from backup
neo4j-admin load --from=/backup/backup-file.dump --database=neo4j --force

# Start Neo4j service
sudo systemctl start neo4j

# Verify recovery
MATCH (n) RETURN count(n);
```

## Monitoring and Maintenance

### 1. System Monitoring

```bash
# Check Neo4j status
sudo systemctl status neo4j

# Monitor system resources
top -p $(pgrep -d',' neo4j)

# Check disk usage
df -h /var/lib/neo4j/data/

# Monitor log files
tail -f /var/log/neo4j/neo4j.log
```

### 2. Performance Monitoring

```cypher
// Check database statistics
CALL db.stats.retrieve();

// Monitor query performance
CALL db.queryLog();

// Check index usage
CALL db.indexes();

// Monitor cache hits
CALL db.stats.cache();
```

### 3. Regular Maintenance Tasks

```cypher
// Update statistics
CALL db.stats.collect();

// Optimize indexes
CALL db.indexes() YIELD name, type
CALL db.index.fulltext.awaitEventuallyConsistency(name);

// Clean up expired sessions
CALL dbms.security.clearAuthCache();
```

## Security

### 1. Network Security

```conf
# neo4j.conf
dbms.connector.bolt.listen_address=localhost:7687
dbms.connector.http.listen_address=localhost:7474
dbms.connector.https.listen_address=localhost:7473
```

### 2. SSL Configuration

```conf
# Enable SSL
dbms.ssl.policy.bolt.enabled=true
dbms.ssl.policy.bolt.base_directory=certificates/bolt
dbms.ssl.policy.bolt.private_key=private.key
dbms.ssl.policy.bolt.public_certificate=public.crt
```

### 3. Access Control

```cypher
// Review current connections
CALL dbms.listConnections();

// Kill specific connection
CALL dbms.killConnection('connection-id');

// Review active queries
CALL dbms.listQueries();

// Kill long-running query
CALL dbms.killQuery('query-id');
```

## Logging and Auditing

### 1. Log Configuration

```conf
# neo4j.conf
dbms.logs.debug.level=INFO
dbms.logs.query.enabled=true
dbms.logs.query.rotation.keep_number=7
dbms.logs.query.rotation.size=20m
```

### 2. Audit Logging

```conf
# Enable audit logging
dbms.security.audit_log.enabled=true
dbms.security.audit_log.rotation.keep_number=30
dbms.security.audit_log.rotation.size=20m
```

### 3. Log Analysis

```bash
# Search for errors
grep ERROR /var/log/neo4j/neo4j.log

# Monitor query performance
grep "ms: " /var/log/neo4j/query.log

# Analyze audit logs
grep "user=" /var/log/neo4j/security.log
```

## Troubleshooting

### 1. Common Issues

#### Database Won't Start
```bash
# Check logs
sudo journalctl -u neo4j -n 100

# Check permissions
sudo chown -R neo4j:neo4j /var/lib/neo4j/

# Check disk space
df -h
```

#### Slow Queries
```cypher
// Review query plan
EXPLAIN MATCH (n)-[r]->(m) RETURN n, r, m;

// Check indexes
CALL db.indexes();

// Monitor memory usage
CALL dbms.memory.usage();
```

#### Connection Issues
```bash
# Test network connectivity
telnet localhost 7687

# Check firewall rules
sudo ufw status

# Review connection logs
tail -f /var/log/neo4j/debug.log
```

### 2. Performance Optimization

```cypher
// Create indexes for frequent lookups
CREATE INDEX module_name FOR (n:Module) ON (n.name);
CREATE INDEX product_name FOR (n:Product) ON (n.name);

// Analyze query performance
PROFILE MATCH (n)-[r]->(m) RETURN n, r, m;

// Monitor cache performance
CALL db.stats.cache();
```

### 3. Recovery Procedures

```bash
# Database corruption recovery
neo4j-admin check --database=neo4j

# Consistency check
neo4j-admin check --database=neo4j --verbose

# Force recovery mode
echo 'dbms.recovery.fail_on_missing_files=false' >> /etc/neo4j/neo4j.conf
```

## Best Practices

### 1. Backup Strategy
- Perform daily full backups
- Keep incremental backups for 30 days
- Test recovery procedures regularly
- Store backups in multiple locations

### 2. Monitoring Strategy
- Set up automated monitoring
- Configure alerts for critical events
- Regular performance reviews
- Monitor disk space usage

### 3. Security Best Practices
- Regular security audits
- Strong password policies
- Network isolation
- Regular updates and patches

### 4. Maintenance Schedule
- Weekly index optimization
- Monthly consistency checks
- Quarterly performance reviews
- Annual security audits

## Support

For administration assistance:
- Technical Support: [admin-support@360t.com](mailto:admin-support@360t.com)
- Emergency Support: [emergency@360t.com](mailto:emergency@360t.com)
- Documentation Updates: [docs@360t.com](mailto:docs@360t.com) 