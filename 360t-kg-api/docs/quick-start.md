# Quick Start Guide - 360T Knowledge Graph

This guide summarizes how to get up and running quickly.

## Setup

- Install Neo4j Desktop, create a database (4.4+).
- Clone API repo, run `npm install`.
- Configure `.env` with Neo4j URI and credentials.
- Start Neo4j and API server (`npm run dev`).
- Verify with `curl http://localhost:3002/api/health`.

## Initial Exploration

- Access Neo4j Browser at `http://localhost:7478`.
- Run sample queries:
  - `MATCH (n) RETURN n LIMIT 5;`
  - `MATCH (m:Module) RETURN m;`
  - `MATCH (m:Module)-[r]->(n) RETURN m, r, n;`
  - `MATCH (t:TestCase)-[r:VALIDATES]->(n) RETURN t, r, n;`

## Visualizations

- View full graph, module dependencies, UI flows with Cypher queries.
- Use LIMIT for large datasets.

## Tips

- Double-click nodes to expand.
- Use zoom and drag to navigate.
- Add indexes for performance.
- Use PROFILE to analyze slow queries.

## Next Steps

- Review [Data Model](./data-model.md)
- Check [API Reference](./api-reference.md)
- Explore [Query Guide](./query-guide.md)
- See [Visualization Guide](./visualization.md)

## Support

- Technical: [support@360t.com](mailto:support@360t.com)
- Docs: [docs@360t.com](mailto:docs@360t.com)
