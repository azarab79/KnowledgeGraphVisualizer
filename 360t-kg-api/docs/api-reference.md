# API Reference Guide

This guide provides a detailed reference for the 360T Knowledge Graph API.

## Authentication

Authentication is handled via JWT (JSON Web Tokens). A valid token must be included in the `Authorization` header for all requests.

`Authorization: Bearer <your_jwt_token>`

## Graph API (`/api/graph`)

Provides endpoints for querying and manipulating the knowledge graph data.

### `GET /api/graph/initial`

Fetches the initial graph structure to be displayed in the UI.

-   **Description**: Retrieves a default set of nodes and relationships to populate the initial graph visualization. It excludes certain node labels like 'Document' and relationship types like 'MENTIONS' to keep the initial view clean.
-   **Query Parameters**: None.
-   **Response**: A JSON object containing `nodes` and `edges` formatted for a graph visualization library (e.g., vis.js).

### `GET /api/graph/search`

Searches for nodes in the graph based on a query term.

-   **Description**: Performs a case-insensitive search across multiple properties of nodes, such as `name`, `test_case_id`, `id`, and `text`.
-   **Query Parameters**:
    -   `term` (string, required): The search term.
-   **Response**: A JSON object containing an array of `nodes` that match the search term.

### `GET /api/graph/expand`

Expands a given node to retrieve its connected nodes and relationships.

-   **Description**: Given a node ID, this endpoint returns the node itself along with all its immediate neighbors and the relationships connecting them.
-   **Query Parameters**:
    -   `nodeId` (integer, required): The internal ID of the node to expand.
-   **Response**: A JSON object containing `nodes` and `edges` connected to the specified node.

### `POST /api/graph/filter`

Retrieves a filtered view of the graph based on specified node labels and relationship types.

-   **Description**: Allows for querying the graph with specific criteria. The request body can specify which node labels and relationship types to include in the result.
-   **Request Body**:
    ```json
    {
      "nodeLabels": ["Label1", "Label2"],
      "relationshipTypes": ["TYPE_A", "TYPE_B"]
    }
    ```
-   **Response**: A JSON object containing the filtered `nodes` and `edges`.

## Chat API (`/api/chat`)

Handles real-time conversational interactions with the knowledge graph.

### `POST /api/chat/message`

Sends a user's message to the chat pipeline and receives a response.

-   **Description**: This is the primary endpoint for the chat feature. It takes a user message and the conversation history, processes it through a Python-based QA pipeline that interacts with the knowledge graph and an LLM, and returns the assistant's answer.
-   **Request Body**:
    ```json
    {
      "message": "What is the status of the new UI module?",
      "history": [
        {"role": "user", "content": "Tell me about the project."},
        {"role": "assistant", "content": "It's a knowledge graph project."}
      ]
    }
    ```
-   **Response**: A JSON object containing the `response` message from the assistant and the `updatedHistory`.

### `GET /api/chat/history`

Retrieves the current conversation history.

-   **Description**: Fetches the chat history. In the current implementation, it returns a default initial message.
-   **Query Parameters**: None.
-   **Response**: A JSON object with a `history` array.

### `DELETE /api/chat/history`

Clears the current conversation history.

-   **Description**: Resets the conversation. In the current implementation, this is a stateless action that returns a confirmation message.
-   **Query Parameters**: None.
-   **Response**: A confirmation message.

## Analysis API (`/api/analysis`)

Provides endpoints for performing advanced analysis on the knowledge graph.

### `GET /api/analysis/impact`

Performs an impact analysis starting from a given node.

-   **Description**: Identifies and returns all nodes and relationships that are downstream from a specified node, showing what is potentially affected by a change to that node. It traces outgoing paths up to 3 levels deep.
-   **Query Parameters**:
    -   `nodeId` (integer, required): The internal ID of the node to start the analysis from.
-   **Response**: A JSON object containing `nodes` and `edges` representing the impact graph.

### `GET /api/analysis/test-coverage`

Finds all test cases that validate a specific component.

-   **Description**: Given a component's node ID, this endpoint traces back through `VALIDATES` and other relationship types to find all `TestCase` nodes that provide test coverage for it.
-   **Query Parameters**:
    -   `nodeId` (integer, required): The internal ID of the component node to check for test coverage.
-   **Response**: A JSON object containing `nodes` and `edges` showing the test cases and their relationship to the component.

### `GET /api/analysis/dependencies`

Performs a dependency analysis for a given node.

-   **Description**: Identifies and returns all nodes and relationships that a specified node depends on. It traces incoming `USES`, `REQUIRES`, `CONTAINS`, and `VALIDATES` relationships.
-   **Query Parameters**:
    -   `nodeId` (integer, required): The internal ID of the node to analyze.
-   **Response**: A JSON object containing `nodes` and `edges` representing the dependency graph.

## Settings API (`/api/settings`)

The `/api/settings` endpoint allows for server-side persistence of user-specific UI configurations.

-   `GET /api/settings`: Lists all settings configurations (admin).
-   `POST /api/settings`: Creates a new settings configuration.
-   `GET /api/settings/:id`: Retrieves a specific settings configuration.
-   `PUT /api/settings/:id`: Updates a specific settings configuration.
-   `DELETE /api/settings/:id`: Deletes a specific settings configuration.

## Support

-   Technical Support: [api-support@360t.com](mailto:api-support@360t.com)
-   Documentation: [api-docs@360t.com](mailto:api-docs@360t.com)
-   API Status: [status.360t.com](https://status.360t.com)
