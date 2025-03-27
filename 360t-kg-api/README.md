# 360T Knowledge Graph

A visualization tool for exploring relationships between 360T platform components using a graph database.

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