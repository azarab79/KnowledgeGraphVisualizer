# Development Guide

This guide summarizes development practices for the 360T Knowledge Graph.

## Environment Setup

- Requires Node.js 16+, npm 8+, Neo4j 5.x, Git.
- Clone repo, run `npm install`.
- Configure `.env` with database, API, and JWT settings.
- Recommended tools: VSCode, Postman.

## Project Structure

- `src/`: Config, controllers, middleware, models, routes, services, utils.
- `tests/`: Unit and integration tests.
- `docs/`: Documentation.
- `scripts/`: Utility scripts.
- Config files: `.env`, ESLint, Prettier, Jest.

## Coding Standards

- Use ES6+ features, async/await.
- Follow consistent naming and structure.
- Use parameters in Cypher queries.
- Document code with JSDoc.
- Handle errors with custom error classes and middleware.
- Use Winston for logging.

## API Design

- RESTful endpoints with controllers and services.
- Middleware for auth and error handling.
- Follow modular structure.

## Testing

- Write unit and integration tests.
- Use fixtures for test data.
- Automate tests with Jest.

## Deployment

- Use environment-specific configs.
- Run tests before deploy.
- Use `npm ci --production` for production installs.

## Git Workflow

- Use feature branches.
- Write clear commit messages.
- Include tests and docs in PRs.
- Review for security and performance.

## Support

- Technical Support: [dev-support@360t.com](mailto:dev-support@360t.com)
- Documentation: [dev-docs@360t.com](mailto:dev-docs@360t.com)
- Bug Reports: [bugs@360t.com](mailto:bugs@360t.com)
