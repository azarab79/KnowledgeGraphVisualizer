# Development Guide

This guide provides detailed information for developers working on the 360T Knowledge Graph system.

## Development Environment Setup

### 1. Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Neo4j Enterprise Edition (v5.x)
- Git
- Visual Studio Code (recommended)
- Postman (for API testing)

### 2. Local Setup

```bash
# Clone repository
git clone https://github.com/360t/knowledge-graph-api.git
cd knowledge-graph-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Edit `.env` file:
```env
# Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# API Configuration
PORT=3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h

# Logging
LOG_LEVEL=debug
```

### 3. IDE Setup

#### Visual Studio Code Extensions
- Neo4j Cypher
- ESLint
- Prettier
- Jest
- REST Client

#### VSCode Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "jest.autoRun": "off"
}
```

## Project Structure

```
360t-kg-api/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── app.js           # Application entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test data
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── .env                 # Environment variables
├── .eslintrc           # ESLint configuration
├── .prettierrc         # Prettier configuration
├── jest.config.js      # Jest configuration
└── package.json        # Project metadata
```

## Code Style Guide

### 1. JavaScript/Node.js

```javascript
// Use ES6+ features
const express = require('express');
const app = express();

// Use async/await for promises
async function getUser(id) {
  try {
    const user = await User.findById(id);
    return user;
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

// Use meaningful variable names
const userConfiguration = {
  isActive: true,
  preferredLanguage: 'en',
};

// Use JSDoc for documentation
/**
 * Creates a new module in the knowledge graph
 * @param {Object} moduleData - Module information
 * @param {string} moduleData.name - Module name
 * @param {string} moduleData.version - Module version
 * @returns {Promise<Object>} Created module
 */
async function createModule(moduleData) {
  // Implementation
}
```

### 2. Cypher Queries

```javascript
// Use template literals for multi-line queries
const query = `
  MATCH (m:Module {name: $name})
  OPTIONAL MATCH (m)-[r]->(n)
  RETURN m, r, n
`;

// Use parameters for values
const params = {
  name: 'RFS Live Pricing',
  version: '4.17',
};

// Handle results properly
const result = await session.run(query, params);
const records = result.records.map(record => ({
  module: record.get('m').properties,
  relationship: record.get('r')?.type,
  target: record.get('n')?.properties,
}));
```

## API Development

### 1. Route Structure

```javascript
// src/routes/modules.js
const express = require('express');
const router = express.Router();
const ModuleController = require('../controllers/ModuleController');
const auth = require('../middleware/auth');

router.get('/', auth, ModuleController.list);
router.post('/', auth, ModuleController.create);
router.get('/:id', auth, ModuleController.get);
router.put('/:id', auth, ModuleController.update);
router.delete('/:id', auth, ModuleController.delete);

module.exports = router;
```

### 2. Controller Structure

```javascript
// src/controllers/ModuleController.js
class ModuleController {
  static async list(req, res, next) {
    try {
      const modules = await ModuleService.list();
      res.json({ modules });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const module = await ModuleService.create(req.body);
      res.status(201).json({ module });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ModuleController;
```

### 3. Service Structure

```javascript
// src/services/ModuleService.js
class ModuleService {
  static async list() {
    const session = neo4j.session();
    try {
      const result = await session.run(`
        MATCH (m:Module)
        RETURN m
      `);
      return result.records.map(record => record.get('m').properties);
    } finally {
      await session.close();
    }
  }

  static async create(data) {
    const session = neo4j.session();
    try {
      const result = await session.run(`
        CREATE (m:Module {
          name: $name,
          version: $version,
          description: $description
        })
        RETURN m
      `, data);
      return result.records[0].get('m').properties;
    } finally {
      await session.close();
    }
  }
}

module.exports = ModuleService;
```

## Testing

### 1. Unit Tests

```javascript
// tests/unit/services/ModuleService.test.js
describe('ModuleService', () => {
  beforeEach(() => {
    // Setup test database
  });

  afterEach(() => {
    // Clean up test database
  });

  it('should create a new module', async () => {
    const moduleData = {
      name: 'Test Module',
      version: '1.0',
      description: 'Test Description',
    };

    const result = await ModuleService.create(moduleData);
    expect(result).toMatchObject(moduleData);
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/modules.test.js
describe('Module API', () => {
  let token;

  beforeAll(async () => {
    // Get authentication token
    token = await getAuthToken();
  });

  it('should list all modules', async () => {
    const response = await request(app)
      .get('/api/modules')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.modules)).toBe(true);
  });
});
```

### 3. Test Data

```javascript
// tests/fixtures/modules.js
module.exports = {
  validModule: {
    name: 'Test Module',
    version: '1.0',
    description: 'Test Description',
  },
  invalidModule: {
    name: '',
    version: 'invalid',
  },
};
```

## Error Handling

### 1. Custom Error Classes

```javascript
// src/utils/errors.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

module.exports = {
  AppError,
  ValidationError,
};
```

### 2. Error Middleware

```javascript
// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
};

module.exports = errorHandler;
```

## Database Operations

### 1. Session Management

```javascript
// src/utils/neo4j.js
const neo4j = require('neo4j-driver');

class Neo4jService {
  static async executeQuery(cypher, params = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } finally {
      await session.close();
    }
  }

  static async executeTransaction(callback) {
    const session = this.driver.session();
    try {
      return await session.executeWrite(callback);
    } finally {
      await session.close();
    }
  }
}

module.exports = Neo4jService;
```

### 2. Query Building

```javascript
// src/utils/queryBuilder.js
class QueryBuilder {
  static buildMatchClause(labels, properties = {}) {
    const labelString = Array.isArray(labels) ? ':' + labels.join(':') : `:${labels}`;
    const propsString = this.buildPropertiesString(properties);
    return `MATCH (n${labelString} ${propsString})`;
  }

  static buildPropertiesString(properties) {
    if (Object.keys(properties).length === 0) return '';
    const props = Object.entries(properties)
      .map(([key, value]) => `${key}: $${key}`)
      .join(', ');
    return `{${props}}`;
  }
}

module.exports = QueryBuilder;
```

## Logging

### 1. Logger Configuration

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

module.exports = logger;
```

### 2. Usage

```javascript
// In your code
const logger = require('../utils/logger');

logger.info('Processing request', { path: req.path, method: req.method });
logger.error('Error occurred', { error: err.message, stack: err.stack });
```

## Documentation

### 1. API Documentation

```javascript
/**
 * @api {get} /api/modules List Modules
 * @apiName GetModules
 * @apiGroup Module
 * @apiVersion 1.0.0
 *
 * @apiHeader {String} Authorization Bearer token
 *
 * @apiSuccess {Object[]} modules List of modules
 * @apiSuccess {String} modules.name Module name
 * @apiSuccess {String} modules.version Module version
 *
 * @apiError (401) Unauthorized Invalid token
 * @apiError (500) InternalServerError Server error
 */
```

### 2. Code Documentation

```javascript
/**
 * Creates relationships between nodes in the knowledge graph
 * @param {Object} params Relationship parameters
 * @param {string} params.sourceId Source node ID
 * @param {string} params.targetId Target node ID
 * @param {string} params.type Relationship type
 * @param {Object} [params.properties] Relationship properties
 * @returns {Promise<Object>} Created relationship
 * @throws {ValidationError} If parameters are invalid
 * @throws {NotFoundError} If nodes not found
 */
```

## Deployment

### 1. Production Configuration

```javascript
// config/production.js
module.exports = {
  neo4j: {
    uri: process.env.NEO4J_URI,
    user: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
  },
  api: {
    port: process.env.PORT || 3000,
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  },
  logging: {
    level: 'info',
    file: '/var/log/360t-kg-api/app.log',
  },
};
```

### 2. Build Process

```bash
# Install production dependencies
npm ci --production

# Run tests
npm test

# Build documentation
npm run docs

# Start production server
NODE_ENV=production npm start
```

## Contributing

### 1. Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push changes
git push origin feature/new-feature

# Create pull request
# Review and merge
```

### 2. Code Review Guidelines

- Follow the style guide
- Write meaningful commit messages
- Include tests for new features
- Update documentation
- Review for security issues
- Check for performance impacts

## Support

For development assistance:
- Technical Support: [dev-support@360t.com](mailto:dev-support@360t.com)
- Documentation: [dev-docs@360t.com](mailto:dev-docs@360t.com)
- Bug Reports: [bugs@360t.com](mailto:bugs@360t.com) 