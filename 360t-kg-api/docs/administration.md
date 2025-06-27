# Administration Guide

This guide covers key aspects of administering the 360T Knowledge Graph system.

## System Overview

- **Neo4j Enterprise 5.x** (default ports 7474/7687)
- **API Server** (Node.js Express, port 3000)
- **JWT Authentication**

## Setup

Refer to the **Getting Started** guide for detailed installation and configuration steps.

## User Management

- Use Cypher to create users and assign roles.
- Enforce strong passwords.
- Regularly review and update user privileges.

## Backup & Recovery

- Use `neo4j-admin dump` for backups.
- Store backups securely and test recovery periodically.
- Restore with `neo4j-admin load` after stopping the service.

## Monitoring

- Check Neo4j status: `systemctl status neo4j`
- Monitor logs: `/var/log/neo4j/`
- Use Cypher procedures:
  - `CALL db.stats.retrieve()`
  - `CALL db.queryLog()`
  - `CALL db.indexes()`

## Security

- Bind Neo4j to localhost or secure interfaces.
- Enable SSL in `neo4j.conf`.
- Regularly audit active connections and queries.
- Use role-based access control.

## Logging & Auditing

- Configure log levels and rotation in `neo4j.conf`.
- Enable audit logging for security events.
- Analyze logs for errors and suspicious activity.

## Troubleshooting

- Check service status and logs for errors.
- Use Cypher `EXPLAIN` and `PROFILE` for query tuning.
- Verify disk space and permissions.
- Test network connectivity and firewall rules.

## Best Practices

- Automate daily backups.
- Monitor system health and set alerts.
- Enforce security policies.
- Schedule regular maintenance and audits.

## Support

- Admin Support: [admin-support@360t.com](mailto:admin-support@360t.com)
- Emergency: [emergency@360t.com](mailto:emergency@360t.com)
- Docs: [docs@360t.com](mailto:docs@360t.com)
