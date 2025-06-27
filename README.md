# 360T Knowledge Graph Visualizer

A comprehensive tool for exploring and analyzing relationships between 360T platform components using a graph database, with an interactive UI and a conversational AI for natural language queries.

## Project Structure

The project is a monorepo containing the backend API, the frontend UI, and a proxy server.

```
.
├── 360t-kg-api/         # Backend Node.js/Express API
│   ├── docs/            # Detailed backend documentation
│   └── server.js        # Express server entry point
│
├── 360t-kg-ui/          # Frontend React Application
│   ├── docs/            # Detailed frontend documentation
│   └── src/             # Main application source code
│
└── proxy-server/        # Optional proxy for development
```

For more details, refer to the specific documentation for each part of the application:
-   [**Backend API Documentation**](./360t-kg-api/docs/README.md)
-   [**Frontend UI Documentation**](./360t-kg-ui/docs/README.md) *(Coming Soon)*

## Prerequisites

-   Node.js (v14 or higher)
-   Neo4j Database (Desktop or AuraDB)
-   Python 3.x (for the chat QA pipeline)

## Setup Instructions

1.  **Neo4j Database Setup**
    -   Install Neo4j Desktop or set up an AuraDB instance.
    -   Create a new database.
    -   Note down the connection URI, username, and password.

2.  **Backend Setup**
    ```bash
    cd 360t-kg-api
    npm install
    cp .env.example .env # Edit .env with your Neo4j and other API keys
    npm run dev
    ```

3.  **Frontend Setup**
    ```bash
    cd 360t-kg-ui
    npm install
    npm run dev
    ```
    
## Documentation

This project contains detailed documentation for both the frontend and backend.

-   ### [Backend Documentation](./360t-kg-api/docs/)
    -   **[API Reference](./360t-kg-api/docs/api-reference.md)**: Detailed information on all API endpoints.
    -   **[Getting Started](./360t-kg-api/docs/getting-started.md)**: A guide to setting up and running the backend.
    -   **[Data Model](./360t-kg-api/docs/data-model.md)**: An overview of the Neo4j graph schema.

-   ### [Frontend Documentation](./360t-kg-ui/docs/)
    -   **[Architecture Overview](./360t-kg-ui/docs/architecture.md)**: A high-level look at the frontend's structure and technologies.
    -   **[Components Overview](./360t-kg-ui/docs/components-overview.md)**: A guide to the key React components.

## Key Features

-   **Interactive Graph Visualization**: Explore nodes and relationships visually.
-   **Conversational AI Chat**: Ask natural language questions about the graph.
-   **Hidden Links Prediction**: Discover potential relationships using Neo4j GDS Node2Vec + Link Prediction pipeline (toggle in Analysis view).
-   **Advanced Analysis**: Perform impact, dependency, and test coverage analysis.
-   **Search and Filtering**: Quickly find nodes and filter the graph view.
-   **Persistent UI Settings**: Customize and save your UI configuration.

## Environment Variables (Hidden Links)

The hidden-links feature respects two optional variables:

```env
# Comma-separated list of node labels to include (default '*')
GDS_GRAPH_NODES=Module,Product,Workflow

# Relationship types to include (default '*')
GDS_GRAPH_RELATIONSHIPS=USES,CONTAINS
```

If unset, the entire graph is projected.

## Observability

A Prometheus-compatible metrics endpoint is now available on the backend:

```
GET /metrics
```

It exposes a `hidden_links_latency_ms` histogram capturing execution time of the GDS pipeline so you can monitor performance trends.

## Development

-   Backend API runs on port 3001.
-   Frontend development server runs on port 5173.
-   The chat functionality relies on a Python script (`real_llm_kg_script.py`) which is called by the backend.

## Enhanced Markdown Formatting 📝

The knowledge graph chat responses now feature rich Markdown formatting for better readability and user experience:

### Key Features

- **Structured Responses**: Clean sections with headers (## and ###)
- **Visual Elements**: Emojis, bullet points, and formatting for better scanning
- **Technical Content**: Code blocks for field names, configuration examples
- **Important Notes**: Blockquotes for warnings and key information  
- **Interactive Elements**: Suggested follow-up questions
- **Source Attribution**: Metadata footer showing document sources

### Example Response Structure

```markdown
## Topic Overview

**Key concept** description with important terms in bold.

### Features

- **Feature 1**: Description with `technical_terms` highlighted
- **Feature 2**: More details
  - Nested bullet points ✅
  - Status indicators ❌

### Important Notes

> ⚠️ **Warning**: Critical information in callout boxes

### Example Code

```yaml
configuration:
  type: hybrid
  value: 2.5
```

### 💡 Related Questions

- How do I configure this feature?
- What are the alternatives?

---
*📊 Response based on **X documents** from the knowledge graph.*
```

### Testing Markdown Formatting

Run the test script to see the formatting in action:

```bash
python test_markdown_formatting.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License. 