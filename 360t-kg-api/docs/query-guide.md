# 360T Knowledge Graph - Query Guide

This guide summarizes common Cypher queries for the 360T Knowledge Graph.

## Basic Patterns

- **Nodes**: `MATCH (n:Label) WHERE n.prop = value RETURN n`
- **Relationships**: `MATCH (a)-[r:TYPE]->(b) RETURN a, r, b`
- **Paths**: `MATCH path = (a)-[*1..3]->(b) RETURN path`
- Use filters, counts, and aggregations as needed.

## Analytics Queries

- **Module Analysis**: dependencies, complexity, components
- **Product Analysis**: usage, coverage
- **Test Coverage**: coverage ratios, untested components
- **UI Navigation**: flows, entry/exit points
- **Configuration Impact**: affected modules, shared configs
- **Integration**: connectivity, hubs

## Optimization Tips

- Use labels and indexes for fast lookups.
- Filter early in queries.
- Use parameters instead of string concatenation.
- Profile queries with `EXPLAIN` and `PROFILE`.
- Limit large result sets.

## Best Practices

- Write clear, maintainable queries.
- Use meaningful variable names.
- Comment complex queries.
- Reuse common query patterns.
- Avoid Cartesian products unless necessary.

## Resources

- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Cypher Query Language Reference](https://neo4j.com/docs/cypher-refcard/current/)

## Support

- Documentation: Contact docs team
- Technical Support: kg-support@360t.com
- Query Optimization: kg-performance@360t.com
