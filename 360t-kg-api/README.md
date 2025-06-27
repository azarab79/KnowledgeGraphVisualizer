# 360T Knowledge Graph API

A REST API for interacting with the 360T Knowledge Graph built on Neo4j and Graph Data Science (GDS).

## Features

- **Graph Analytics**: Centrality analysis, community detection (Louvain clustering)
- **Hidden Links**: Link prediction using Node2Vec embeddings and machine learning pipelines
- **Chat Integration**: Knowledge graph integration with conversational AI
- **Health Monitoring**: Built-in health checks and metrics

## Prerequisites

### Neo4j & Graph Data Science (GDS) Requirements

#### For Hidden Links Functionality

The Hidden Links endpoint (`/api/analysis/hidden-links`) requires specific GDS procedures to function properly. The system supports both modern pipeline-based and legacy approaches:

**Modern Pipeline Approach (Recommended)**
- **GDS Version**: 2.0+ 
- **Required Procedures**:
  - `gds.beta.pipeline.linkPrediction.create`
  - `gds.beta.pipeline.linkPrediction.addNodeProperty`
  - `gds.beta.pipeline.linkPrediction.addFeature`
  - `gds.beta.pipeline.linkPrediction.addLogisticRegression`
  - `gds.beta.pipeline.linkPrediction.train`
  - `gds.beta.pipeline.linkPrediction.predict.stream`
  - `gds.beta.model.list` (for model freshness checking)
  - `gds.beta.model.drop`
  - `gds.beta.pipeline.drop`

**Legacy Fallback Approach**
- **GDS Version**: 1.x or 2.x (if legacy procedures are available)
- **Required Procedures**:
  - `gds.linkprediction.train` OR `gds.alpha.linkprediction.train`
  - `gds.linkprediction.predict.stream` OR `gds.alpha.linkprediction.predict.stream`

**Common Requirements (Both Approaches)**
- `gds.node2vec.write` - For generating node embeddings
- `gds.graph.project` - For graph projection
- `gds.graph.drop` - For graph cleanup
- `dbms.procedures()` - For procedure detection

#### Version Detection & Compatibility

The system automatically:
1. Detects available GDS procedures using `dbms.procedures()`
2. Attempts modern pipeline approach first (if available)
3. Falls back to legacy procedures if modern approach fails
4. Provides clear error messages if no suitable procedures are found

#### Installation & Setup

1. **Neo4j Enterprise** with **Graph Data Science plugin** installed
2. Ensure the GDS plugin version is compatible with your Neo4j version
3. Verify procedures are available by running: `CALL dbms.procedures() YIELD name WHERE name STARTS WITH 'gds'`

### Environment Variables

```env
# Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# GDS Graph Projection (Optional - defaults to '*')
GDS_GRAPH_NODES=*
GDS_GRAPH_RELATIONSHIPS=*
```

## API Endpoints

### Analysis

- `GET /api/analysis/centrality` - Node centrality metrics
- `GET /api/analysis/clusters` - Community detection (Louvain)
- `GET /api/analysis/hidden-links` - Link prediction analysis

### Health

- `GET /api/health` - System health check
- `GET /api/metrics` - Performance metrics

## Installation

```bash
npm install
npm start
```

## Testing

```bash
npm test
npm run test:watch
```

## Troubleshooting

### Hidden Links Issues

If the Hidden Links endpoint is failing:

1. **Check GDS Installation**: `CALL gds.version()`
2. **Verify Procedures**: `CALL dbms.procedures() YIELD name WHERE name CONTAINS 'linkprediction'`
3. **Check Logs**: Look for `[Hidden Links]` prefixed messages in console output
4. **Graph Size**: Ensure your graph has sufficient nodes/relationships for meaningful predictions

### Common Error Messages

- `"No suitable link prediction procedures available"` - GDS plugin not installed or incompatible version
- `"Modern pipeline failed and no legacy procedures available"` - Neither modern nor legacy approaches work
- `"already exists"` errors - Catalog cleanup issues (should be automatically handled)

## Architecture

Built with:
- **Node.js** + **Express**
- **Neo4j** + **Graph Data Science**
- **Jest** for testing
- **Prometheus** metrics integration

## Project Structure

- `360t-kg-api/` - Backend API (Node.js/Express)
  - `server.js` - Main server file
  - `package.json` - Dependencies and scripts
  - `.env` - Environment configuration
  - `schema/` - Database schema and sample data
  - `scripts/` - Database initialization and migration scripts
  - `migrations/` - Database migrations
  - `tests/` - API tests

- `360t-kg-ui/` - Frontend React application

## Prerequisites

- Node.js (v14 or higher)
- Neo4j Database
- npm or yarn

## Setup

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd 360t-kg-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file with your configuration:
   ```
   NEO4J_URI=neo4j://localhost:7695
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_password
   PORT=3002
   ```

4. Initialize the database:
   ```bash
   npm run init-db
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd 360t-kg-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

- Backend API will be available at `http://localhost:3002`
- Frontend development server will run on `http://localhost:5173`
- API documentation available at `http://localhost:3002/api-docs`
- Neo4j database runs on port 7695

## Development

- Backend API runs on port 3002 to avoid conflicts with other services
- Frontend development server uses Vite's default port (5173)
- Neo4j database uses port 7695 for Bolt protocol

## Features

- Interactive graph visualization
- Search functionality
- Real-time updates
- API documentation with Swagger/OpenAPI

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License. 