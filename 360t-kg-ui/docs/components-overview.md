# Frontend Components Overview

This document provides a high-level overview of the main React components in the `360t-kg-ui` application.

## Core Components

### `GraphView.jsx`
-   **Purpose**: This is the central component of the application, responsible for rendering and managing the interactive knowledge graph visualization.
-   **Key Features**: Uses `vis.js` to draw the graph, handles user interactions like node clicking/dragging, and communicates with the `GraphCanvas.jsx` for the actual rendering.

### `ChatView.jsx`
-   **Purpose**: Provides the user interface for the conversational AI, allowing users to ask questions about the knowledge graph.
-   **Key Features**: Manages the conversation history, sends user messages to the backend Chat API, and displays the assistant's responses. Uses `MarkdownRenderer.jsx` to format responses.

### `DetailsPanel.jsx` / `NodeDetails.jsx`
-   **Purpose**: Displays detailed information about the currently selected node in the graph.
-   **Key Features**: Receives node data from `GraphView.jsx` and presents the node's properties, labels, and any other relevant metadata.

### `SearchBar.jsx`
-   **Purpose**: Allows users to search for specific nodes within the graph.
-   **Key Features**: Implements autocomplete functionality, calls the `/api/graph/search` endpoint, and provides a way to focus the graph view on a search result.

### `FilterPanel.jsx`
-   **Purpose**: Provides UI controls for filtering the graph based on node labels and relationship types.
-   **Key Features**: Allows users to select which categories of nodes and relationships are visible, and then calls the `/api/graph/filter` endpoint to update the view.

### `AnalysisPanel.jsx`
-   **Purpose**: Contains buttons and controls to trigger different graph analyses (e.g., impact, dependency).
-   **Key Features**: Interacts with the `/api/analysis/*` endpoints and displays the results of the analysis in the `GraphView`.

## Helper & UI Components

-   **`Header.jsx`**: The main application header, containing the title and logo.
-   **`Legend.jsx`**: Displays a legend explaining the color-coding and shapes of different nodes in the graph.
-   **`MarkdownRenderer.jsx`**: A component for rendering Markdown-formatted text, used primarily in the `ChatView`.
-   **`ColorPickerModal.jsx`**: A modal dialog for changing color settings, interacting with the `useSettings` hook.
-   **`DocumentReferences.jsx`**: Displays source documents related to a chat response.
-   **`Notification.jsx`**: Shows transient notifications for events like errors or successful actions.
-   **`Tooltip.jsx`**: A generic tooltip component. 