# Troubleshooting Guide

This guide summarizes solutions for common issues with the 360T Knowledge Graph.

## Database Issues

- **Connection errors**: Check Neo4j service status, credentials, and network ports.
- **Authentication failures**: Reset Neo4j password, update `.env`, restart services.
- **Data inconsistency**: Look for duplicates, missing relationships, or invalid properties.
- **Data loading failures**: Review constraints, validate data formats, use transactions.

## API Issues

- **Server won't start**: Check for port conflicts, reinstall dependencies.
- **Slow API**: Enable debug logs, monitor resources, optimize queries.
- **Authentication errors**: Verify JWT settings and user roles.
- **CORS or integration problems**: Review API CORS config and rate limits.

## Performance Issues

- **Slow queries**: Use `PROFILE`, add indexes, limit result sizes.
- **Memory issues**: Monitor usage, paginate results, optimize queries.
- **Degradation over time**: Clear caches, maintain database, monitor system health.

## Security Issues

- **Unauthorized access**: Review user roles and privileges.
- **Token problems**: Check JWT configs and expiration.
- **Access control**: Enforce RBAC in middleware and database.

## Data Import/Export

- **Import failures**: Validate CSV formats, check constraints.
- **Export issues**: Use `neo4j-admin` or APOC procedures.

## Visualization Problems

- **Large datasets**: Use filters and limits.
- **Unclear graphs**: Customize styles, group nodes.
- **Browser crashes**: Reduce data volume.

## Environment Issues

- **Config mismatches**: Verify environment variables.
- **Path problems**: Use absolute paths, check permissions.

## Best Practices

- Monitor system health regularly.
- Review logs for errors.
- Optimize queries and indexes.
- Test backups and restores.
- Keep documentation updated.

## Support

- Technical: [support@360t.com](mailto:support@360t.com)
- Docs: [docs@360t.com](mailto:docs@360t.com)
