# Frontend Architecture

This document provides an overview of the `360t-kg-ui` frontend architecture.

## Core Technologies

-   **Framework**: React
-   **Bundler**: Vite
-   **Styling**: Standard CSS, with some components having their own CSS modules.
-   **State Management**: Primarily through React hooks (`useState`, `useContext`, `useEffect`). A custom hook `useSettings` is used for managing user-specific UI settings.
-   **API Communication**: The `axios` library is used for making requests to the backend API. Service functions are centralized in `src/services`.

## Directory Structure

-   `public/`: Contains static assets like the main `index.html` and images.
-   `src/`: Contains all the application source code.
    -   `assets/`: Static assets like logos and SVGs that are imported into components.
    -   `components/`: Reusable React components that make up the UI. This is the core of the application.
    -   `hooks/`: Custom React hooks, such as `useSettings.js`.
    -   `services/`: Modules responsible for communicating with the backend API (`api.js`, `chatApiService.js`, etc.).
    -   `styles/`: Global and component-specific stylesheets.
    -   `App.jsx`: The main application component that orchestrates the layout and routing.
    -   `main.jsx`: The entry point of the application where the React app is mounted to the DOM. 