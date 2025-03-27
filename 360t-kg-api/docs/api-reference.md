# API Reference Guide

This guide provides detailed information about the 360T Knowledge Graph API endpoints, authentication, and usage examples.

## Authentication

The API uses JWT (JSON Web Token) authentication.

### Getting an Access Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

Use this token in subsequent requests in the Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints

### Modules

#### List All Modules

```http
GET /api/modules
```

Response:
```json
{
  "modules": [
    {
      "id": "m1",
      "name": "RFS Live Pricing",
      "version": "4.17",
      "description": "Real-time pricing module for RFS"
    }
  ]
}
```

#### Get Module by ID

```http
GET /api/modules/{moduleId}
```

Response:
```json
{
  "id": "m1",
  "name": "RFS Live Pricing",
  "version": "4.17",
  "description": "Real-time pricing module for RFS",
  "components": {
    "workflows": [...],
    "ui_areas": [...],
    "configuration_items": [...]
  }
}
```

#### Create Module

```http
POST /api/modules
Content-Type: application/json

{
  "name": "New Module",
  "version": "1.0",
  "description": "Description of the new module"
}
```

#### Update Module

```http
PUT /api/modules/{moduleId}
Content-Type: application/json

{
  "name": "Updated Module Name",
  "version": "1.1",
  "description": "Updated description"
}
```

#### Delete Module

```http
DELETE /api/modules/{moduleId}
```

### Products

#### List All Products

```http
GET /api/products
```

Response:
```json
{
  "products": [
    {
      "id": "p1",
      "name": "FX Spot",
      "description": "Foreign Exchange Spot Trading"
    }
  ]
}
```

#### Get Product by ID

```http
GET /api/products/{productId}
```

#### Create Product

```http
POST /api/products
Content-Type: application/json

{
  "name": "New Product",
  "description": "Description of the new product"
}
```

#### Update Product

```http
PUT /api/products/{productId}
Content-Type: application/json

{
  "name": "Updated Product Name",
  "description": "Updated description"
}
```

#### Delete Product

```http
DELETE /api/products/{productId}
```

### Workflows

#### List All Workflows

```http
GET /api/workflows
```

#### Get Workflow by ID

```http
GET /api/workflows/{workflowId}
```

#### Create Workflow

```http
POST /api/workflows
Content-Type: application/json

{
  "name": "New Workflow",
  "description": "Description of the workflow",
  "steps": [
    {
      "order": 1,
      "name": "Step 1",
      "description": "First step"
    }
  ]
}
```

#### Update Workflow

```http
PUT /api/workflows/{workflowId}
Content-Type: application/json

{
  "name": "Updated Workflow",
  "description": "Updated description",
  "steps": [...]
}
```

#### Delete Workflow

```http
DELETE /api/workflows/{workflowId}
```

### UI Areas

#### List All UI Areas

```http
GET /api/ui-areas
```

#### Get UI Area by ID

```http
GET /api/ui-areas/{uiAreaId}
```

#### Create UI Area

```http
POST /api/ui-areas
Content-Type: application/json

{
  "name": "New UI Area",
  "description": "Description of the UI area"
}
```

#### Update UI Area

```http
PUT /api/ui-areas/{uiAreaId}
Content-Type: application/json

{
  "name": "Updated UI Area",
  "description": "Updated description"
}
```

#### Delete UI Area

```http
DELETE /api/ui-areas/{uiAreaId}
```

### Configuration Items

#### List All Configuration Items

```http
GET /api/config-items
```

#### Get Configuration Item by ID

```http
GET /api/config-items/{configItemId}
```

#### Create Configuration Item

```http
POST /api/config-items
Content-Type: application/json

{
  "name": "New Config Item",
  "description": "Description of the config item",
  "type": "checkbox",
  "default_value": "true"
}
```

#### Update Configuration Item

```http
PUT /api/config-items/{configItemId}
Content-Type: application/json

{
  "name": "Updated Config Item",
  "description": "Updated description",
  "type": "checkbox",
  "default_value": "false"
}
```

#### Delete Configuration Item

```http
DELETE /api/config-items/{configItemId}
```

### Test Cases

#### List All Test Cases

```http
GET /api/test-cases
```

#### Get Test Case by ID

```http
GET /api/test-cases/{testCaseId}
```

#### Create Test Case

```http
POST /api/test-cases
Content-Type: application/json

{
  "name": "TC-001",
  "description": "Test case description",
  "priority": "High",
  "type": "Automated"
}
```

#### Update Test Case

```http
PUT /api/test-cases/{testCaseId}
Content-Type: application/json

{
  "name": "TC-001",
  "description": "Updated description",
  "priority": "Medium",
  "type": "Manual"
}
```

#### Delete Test Case

```http
DELETE /api/test-cases/{testCaseId}
```

### Relationships

#### Create Relationship

```http
POST /api/relationships
Content-Type: application/json

{
  "source_id": "node1_id",
  "source_type": "Module",
  "target_id": "node2_id",
  "target_type": "Workflow",
  "relationship_type": "CONTAINS"
}
```

#### Delete Relationship

```http
DELETE /api/relationships/{relationshipId}
```

### Graph Queries

#### Get Module Dependencies

```http
GET /api/graph/module-dependencies/{moduleId}
```

#### Get Test Coverage

```http
GET /api/graph/test-coverage/{moduleId}
```

#### Get UI Navigation Flow

```http
GET /api/graph/ui-navigation
```

#### Get Configuration Impact

```http
GET /api/graph/config-impact/{configItemId}
```

## Error Handling

The API uses standard HTTP status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

Error Response Format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

## Rate Limiting

The API implements rate limiting:

- 1000 requests per hour per API key
- 100 requests per minute per IP address

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1623456789
```

## Pagination

List endpoints support pagination:

```http
GET /api/modules?page=2&per_page=10
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "per_page": 10,
    "current_page": 2,
    "last_page": 10,
    "from": 11,
    "to": 20
  }
}
```

## Filtering and Sorting

List endpoints support filtering and sorting:

```http
GET /api/modules?filter[name]=RFS&sort=-created_at
```

## API Versioning

The API is versioned through the URL:

```http
GET /api/v1/modules
```

## Best Practices

1. **Authentication:**
   - Store tokens securely
   - Refresh tokens before expiration
   - Use environment variables for credentials

2. **Error Handling:**
   - Implement proper error handling
   - Log API errors for debugging
   - Display user-friendly error messages

3. **Rate Limiting:**
   - Implement exponential backoff
   - Cache responses when possible
   - Monitor rate limit headers

4. **Performance:**
   - Use pagination for large datasets
   - Minimize API calls
   - Implement caching where appropriate

## Support

For API support:
- Technical Support: [api-support@360t.com](mailto:api-support@360t.com)
- Documentation Updates: [api-docs@360t.com](mailto:api-docs@360t.com)
- API Status: [status.360t.com](https://status.360t.com) 