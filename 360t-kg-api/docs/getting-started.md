# Getting Started with 360T Knowledge Graph

This guide will help you set up and start using the 360T Knowledge Graph system.

## System Requirements

### Software Requirements
- Node.js (v14 or higher)
- Neo4j Database (v4.4 or higher)
- npm (v6 or higher)
- Git (for version control)

### Hardware Requirements
- Minimum 4GB RAM
- 10GB available disk space
- Modern multi-core processor

### Network Requirements
- Internet connection for package installation
- Available ports:
  - 3002 (API server)
  - 7695 (Neo4j Bolt)
  - 7478 (Neo4j Browser)

## Installation Guide

### 1. Install Neo4j

1. Download Neo4j Desktop from [Neo4j Download Page](https://neo4j.com/download/)
2. Install Neo4j Desktop following the platform-specific instructions
3. Create a new database:
   ```
   a. Open Neo4j Desktop
   b. Click '+ New' → 'Create a Local Graph'
   c. Name: 360T-KG
   d. Password: your-secure-password
   e. Version: 4.4 or higher
   f. Click 'Create'
   ```
4. Configure the database:
   ```
   a. Click on the database
   b. Click 'Settings'
   c. Update the following settings:
      dbms.connector.bolt.listen_address=:7695
      dbms.connector.http.listen_address=:7478
   d. Click 'Apply'
   ```

### 2. Clone and Set Up the API

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/360t-kg-api.git
   cd 360t-kg-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Update .env file with your settings:
   ```
   PORT=3002
   NEO4J_URI=neo4j://localhost:7695
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-secure-password
   ```

### 3. Initialize the Database

1. Apply database schema:
   ```bash
   npm run apply-schema
   ```

2. Load sample data:
   ```bash
   npm run load-data
   ```

3. Verify the data:
   ```bash
   npm run verify-data
   ```

## First-Time Setup

### 1. Start the Services

1. Start Neo4j:
   ```
   a. Open Neo4j Desktop
   b. Select your database
   c. Click 'Start'
   ```

2. Start the API server:
   ```bash
   npm run dev
   ```

### 2. Verify Installation

1. Check API health:
   ```bash
   curl http://localhost:3002/api/health
   ```
   Expected response: `{"status":"ok","timestamp":"..."}`

2. Access Neo4j Browser:
   - Open http://localhost:7478 in your web browser
   - Connect using:
     ```
     URL: neo4j://localhost:7695
     Username: neo4j
     Password: your-secure-password
     ```

3. Test a simple query in Neo4j Browser:
   ```cypher
   MATCH (n) RETURN n LIMIT 5;
   ```

### 3. Access Documentation

1. API Documentation:
   - Open http://localhost:3002/api-docs in your web browser
   - Browse available endpoints and try them out

2. View Graph Structure:
   ```cypher
   // In Neo4j Browser
   MATCH (n)
   OPTIONAL MATCH (n)-[r]->(m)
   RETURN n, r, m;
   ```

## Common First-Time Issues

### Port Conflicts
If ports are already in use:
1. Change the port in .env file for the API
2. Update Neo4j settings for database ports
3. Restart all services

### Connection Issues
If unable to connect to Neo4j:
1. Verify Neo4j is running
2. Check connection settings in .env file
3. Ensure firewall allows connections
4. Try connecting directly via Neo4j Browser

### Data Loading Issues
If data loading fails:
1. Check Neo4j connection
2. Verify Neo4j user has write permissions
3. Clear database and retry:
   ```bash
   // In Neo4j Browser
   MATCH (n) DETACH DELETE n;
   // Then run
   npm run load-data
   ```

## Next Steps

After successful installation:

1. Review the [Data Model Guide](./data-model.md) to understand the graph structure
2. Explore the [Query Guide](./query-guide.md) for common operations
3. Check the [API Reference](./api-reference.md) for available endpoints
4. Learn about [Visualization](./visualization.md) options

## Support

If you encounter any issues:
1. Check the [Troubleshooting Guide](./troubleshooting.md)
2. Review error logs in `logs/` directory
3. Contact support at [support@360t.com](mailto:support@360t.com) 