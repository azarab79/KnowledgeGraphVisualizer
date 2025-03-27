# Quick Start Guide - 360T Knowledge Graph

This guide will help you get started with the 360T Knowledge Graph system in under 15 minutes.

## 1. Quick Installation (5 minutes)

### Install Neo4j
1. Download Neo4j Desktop from [Neo4j Download Page](https://neo4j.com/download/)
2. Install and launch Neo4j Desktop
3. Create a new database:
   ```
   Name: 360T-KG
   Password: your-secure-password
   Version: 4.4 or higher
   ```

### Install API
```bash
git clone https://github.com/your-repo/360t-kg-api.git
cd 360t-kg-api
npm install
cp .env.example .env
```

Edit `.env`:
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password
```

## 2. Start the System (2 minutes)

1. Start Neo4j:
   - Open Neo4j Desktop
   - Click 'Start' on your database

2. Start API:
   ```bash
   npm run dev
   ```

3. Verify:
   ```bash
   curl http://localhost:3002/api/health
   # Should return: {"status":"ok"}
   ```

## 3. First Steps (5 minutes)

### Access Neo4j Browser
1. Open http://localhost:7478
2. Login with your Neo4j credentials
3. Try a simple query:
   ```cypher
   MATCH (n) RETURN n LIMIT 5;
   ```

### Common Operations

1. View all modules:
   ```cypher
   MATCH (m:Module)
   RETURN m;
   ```

2. View module relationships:
   ```cypher
   MATCH (m:Module {name: 'RFS Live Pricing'})
   OPTIONAL MATCH (m)-[r]->(n)
   RETURN m, r, n;
   ```

3. Find test coverage:
   ```cypher
   MATCH (t:TestCase)-[r:VALIDATES]->(n)
   RETURN t, r, n;
   ```

## 4. Essential Visualizations (3 minutes)

### Basic Graph View
```cypher
// View complete graph structure
MATCH (n)
OPTIONAL MATCH (n)-[r]->(m)
RETURN n, r, m;
```

### Module Dependencies
```cypher
// View module with components
MATCH (m:Module {name: 'RFS Live Pricing'})
OPTIONAL MATCH (m)-[r1]->(n1)
RETURN m, r1, n1;
```

### UI Navigation Flow
```cypher
// Show UI navigation paths
MATCH path = (ui1:UI_Area)-[:NAVIGATES_TO*]->(ui2:UI_Area)
RETURN path;
```

## 5. Quick Tips

### Visualization
- Double-click nodes to expand relationships
- Shift + double-click to collapse
- Mouse wheel to zoom
- Click and drag to move nodes

### Performance
- Use LIMIT for large queries
- Add indexes for frequently searched properties
- Clear the view between visualizations

### Common Issues
- If Neo4j won't connect, check if it's running
- For slow queries, use PROFILE to analyze
- If browser is unresponsive, refresh and use smaller queries

## Next Steps

1. Review the [Data Model Guide](./data-model.md) for detailed structure
2. Check [API Reference](./api-reference.md) for available endpoints
3. Explore [Query Guide](./query-guide.md) for advanced queries
4. See [Visualization Guide](./visualization.md) for custom styling

## Quick Support

- Technical Issues: [support@360t.com](mailto:support@360t.com)
- Documentation: [docs@360t.com](mailto:docs@360t.com)
- Emergency: +1-XXX-XXX-XXXX 