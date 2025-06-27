# Getting Started with 360T Knowledge Graph

This guide summarizes initial setup steps.

## Requirements

- Node.js 14+, npm 6+, Neo4j 4.4+
- 4GB+ RAM, 10GB+ disk
- Open ports: 3002 (API), 7695 (Bolt), 7478 (Browser)

## Installation

1. **Install Neo4j** (Desktop or Server), configure Bolt and HTTP ports.
2. **Clone API repo** and run `npm install`.
3. **Configure `.env`** with Neo4j URI, credentials, and API port.
4. **Initialize database**:
   - `npm run apply-schema`
   - `npm run  -data`
   - `npm run verify-data`
5. **Start services**:
   - Start Neo4j
   - Run API server: `npm run dev`

## Verification

- API health: `curl http://localhost:3002/api/health`
- Access Neo4j Browser at `http://localhost:7478`
- Run sample Cypher queries

## Troubleshooting

- Check ports and firewall.
- Verify Neo4j is running and credentials are correct.
- Review logs for errors.
- See **Troubleshooting Guide** for more help.

## Next Steps

- Review [Data Model](./data-model.md)
- Explore [Query Guide](./query-guide.md)
- Check [API Reference](./api-reference.md)
- Learn about [Visualization](./visualization.md)

## Support

- Email: [support@360t.com](mailto:support@360t.com)
