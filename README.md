# 360T Knowledge Graph

A visualization tool for exploring relationships between 360T platform components using a graph database.

## Project Structure

```
.
├── 360t-kg-api/         # Backend API
│   ├── server.js        # Express server
│   ├── package.json     # Backend dependencies
│   └── .env            # Environment configuration
│
└── 360t-kg-ui/         # Frontend React application
    ├── src/
    │   ├── components/ # React components
    │   ├── services/   # API services
    │   └── styles/     # CSS styles
    └── package.json    # Frontend dependencies
```

## Prerequisites

- Node.js (v14 or higher)
- Neo4j Database (Desktop or AuraDB)
- npm or yarn package manager

## Setup Instructions

1. **Neo4j Database Setup**
   - Install Neo4j Desktop or set up an AuraDB instance
   - Create a new database or use an existing one
   - Note down the connection URI, username, and password

2. **Backend Setup**
   ```bash
   cd 360t-kg-api
   
   # Install dependencies
   npm install
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your Neo4j credentials
   
   # Start the development server
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd 360t-kg-ui
   
   # Install dependencies
   npm install
   
   # Start the development server
   npm run dev
   ```

## Usage

1. Access the web interface at `http://localhost:5173` (or the port shown in your terminal)
2. The graph visualization will load automatically
3. Use mouse controls to interact with the graph:
   - Click and drag to move nodes
   - Scroll to zoom
   - Click nodes to see details
   - Double-click nodes to expand relationships

## Development

- Backend API runs on port 3001
- Frontend development server runs on port 5173
- Neo4j database typically runs on port 7687 (Bolt protocol)

## Features

- Interactive graph visualization
- Node and relationship exploration
- Search functionality
- Filtering by node types
- Detailed node information display

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License. 