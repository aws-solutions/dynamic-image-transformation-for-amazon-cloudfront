# Management Lambda

A TypeScript-based AWS Lambda function that provides management API operations for the Dynamic Image Transformation solution. This lambda implements a layered architecture pattern with service and data access object layers for managing transformation policies, origins, and mappings.

### Entry Point ([./index.ts](./index.ts))

The Lambda handler uses the Middy middleware framework for request processing:

```typescript
export const handler = middy()
  .use(httpHeaderNormalizer()) // Normalize HTTP headers
  .use(cors()) // Enable CORS
  .use(httpSecurityHeaders()) // Add security headers
  .use(errorHandler()) // Custom error handling middleware
  .handler(httpRouterHandler(routes));
```

**Middleware Stack**:

- **Header Normalization**: Ensures consistent header casing
- **CORS**: Enables cross-origin requests for web clients
- **Security Headers**: Adds standard security headers (CSP, HSTS, etc.)
- **Error Handler**: Converts exceptions to proper API Gateway responses
- **Router**: Routes requests to appropriate handlers based on method and path

### Route Definitions ([./routes.ts](./routes.ts))

Defines all API endpoints with their HTTP methods, paths, and handler functions:

```typescript
export const routes: {
  method: Method;
  path: string;
  handler: LambdaHandler;
}[] = [
  // Transformation Policies
  { method: "GET", path: "/policies", handler: ... },
  { method: "POST", path: "/policies", handler: ... },
  { method: "GET", path: "/policies/{policyId}", handler: ... },
  // ... Origins and Mappings routes
];
```

**Service Initialization**:

- Creates DynamoDB DocumentClient with optimized configuration
- Initializes service instances (PolicyService, OriginService, MappingService)
- Each route handler accesses pre-initialized services

## Architecture

The implementation follows a layered architecture pattern:

```
┌─────────────────┐
│   API Gateway   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Lambda Handler  │  ← Entry point and request router
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Service Layer   │  ← Business logic & validation
└─────────┬───────┘
          │
┌─────────▼───────┐
│   DAO Layer     │  ← Data access & transformation
└─────────┬───────┘
          │
┌─────────▼───────┐
│   DynamoDB      │  ← Data persistence
└─────────────────┘
```

## APIs

All list endpoints support pagination via `nextToken` query parameter and return responses in the format:

```json
{
  "items": [...],
  "nextToken": "optional-token-for-next-page"
}
```

### Transformation Policies

Manage image transformation policies that define how images are processed.

- `GET /policies?nextToken={token}` - List all transformation policies (paginated)
- `POST /policies` - Create new transformation policy with JSON configuration
- `GET /policies/{policyId}` - Get specific transformation policy details
- `PUT /policies/{policyId}` - Update existing transformation policy
- `DELETE /policies/{policyId}` - Delete transformation policy

### Origins

Manage origin configurations that define source locations for images.

- `GET /origins?nextToken={token}` - List all configured origins (paginated)
- `POST /origins` - Create new origin
- `GET /origins/{originId}` - Get specific origin configuration
- `PUT /origins/{originId}` - Update existing origin configuration
- `DELETE /origins/{originId}` - Delete origin configuration

### Mappings

Manage path-based or host-header based routing to map requests to specific origins.

- `GET /mappings?nextToken={token}` - List all mappings (paginated)
- `POST /mappings` - Create new mapping
- `GET /mappings/{mappingId}` - Get specific mapping details
- `PUT /mappings/{mappingId}` - Update existing mapping
- `DELETE /mappings/{mappingId}` - Delete mapping

## Data Models

Data models support the domain objects Origins, Transformation Policies, Mappings on API request/response and DynamoDB

### Domain Objects

Type definitions for domain objects that are used in API request/response are defined under `../data-models/`:

- [TransformationPolicy](../data-models/transformation-policy.ts)
- [Origin](../data-models/origin.ts)
- [Mapping](../data-models/mappings.ts)

### DynamoDB Schema

The schema/type definitions are in [types.ts](./interfaces/types.ts). The implementation uses a single-table design with multiple entity types.

**Generic Entity Structure**

```bash
{
  PK: "{entityId}",    // Primary Key
  GSI1PK: "{ENTITY_TYPE}",           // Entity type for listing
  GSI1SK: "{sortableField}",         // Sort key (name, pattern, etc.)
  CreatedAt: "ISO_DATE_STRING",      // Creation timestamp
  UpdatedAt?: "ISO_DATE_STRING",     // Last update timestamp
  Data: {                            // Entity-specific data
    // ... entity fields
  }
}
```

**Transformation Policy**

```bash
{
  PK: "{policyId}",
  GSI1PK: "POLICY",
  GSI1SK: "{policyName}",
  GSI2PK?: "DEFAULT_POLICY",         // Only for default policy
  Data: {
    policyName: string,
    description?: string,
    policyJSON: string,              // JSON string of transformations
    isDefault: boolean
  }
}
```

**Origin**

```bash
{
  PK: "{originId}",
  GSI1PK: "ORIGIN",
  GSI1SK: "{originName}",
  Data: {
    originName: string,
    originDomain: string,            // Validated domain name
    originPath?: string,
    originHeaders?: Record<string, string>
  }
}
```

**Mapping**

```bash
{
  PK: "{mappingId}",
  GSI1PK: "PATH_MAPPING" | "HOST_HEADER_MAPPING",
  GSI1SK: "{pattern}",
  GSI2PK: "ORIGIN#{originId}",       // For querying by origin
  GSI3PK?: "POLICY#{policyId}",      // For querying by policy
  Data: {
    originId: string,
    policyId?: string
  }
}
```

## Code Patterns

### Base Classes

#### BaseDAO [base-dao.ts](./dao/base-dao.ts)

Abstract base class providing common DynamoDB operations:

- Generic CRUD operations (create, read, update, delete, list) on DynamoDB
- Data validation using Zod schemas with **reads** and **writes**
- Type-safe operations with generics

#### BaseService [base-service.ts](./services/base-service.ts)

Abstract base class providing common business logic:

- Request validation using Zod schemas
- Type-safe operations with generics

### Error Handling

#### Structured Error System (`common/error.ts`)

- **ManagementApiError**: Base error class with API Gateway response formatting
- **BadRequestError**: 400 errors with specific error codes
- **NotFoundError**: 404 errors for missing resources
- **InternalServerError**: 500 errors for system failures

#### Error Codes

```typescript
const ErrorCodes = {
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_VALUE: "INVALID_FIELD_VALUE",
  NOT_FOUND: "NOT_FOUND",
  POLICY_NOT_FOUND: "POLICY_NOT_FOUND",
  ORIGIN_NOT_FOUND: "ORIGIN_NOT_FOUND",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
};
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- transformation-policy-dao.test.ts

```

### End-to-End Tests

```bash
# Run all E2E tests (requires AWS credentials and deployed stack)
CURRENT_STACK_REGION={myRegion} CURRENT_STACK_NAME={myStackName} npm run test:e2e

# Run specific E2E test suite
CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run test:e2e -- policies.test.ts

# Run negative/authorization tests only
CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run test:e2e -- negative.test.ts
```

**E2E Test Requirements**:

- Deployed stack
- Local AWS credentials with permissions for DynamoDB, Cognito, and CloudFormation
- Environment variables: `CURRENT_STACK_REGION` and `CURRENT_STACK_NAME`

## Project Structure

```
management-lambda/
├── dao/                                  # Data Access Objects
│   ├── base-dao.ts                       # Abstract base DAO with common operations
│   ├── transformation-policy-dao.ts      # Policy data access layer
│   ├── origin-dao.ts                     # Origin data access layer
│   ├── mapping-dao.ts                    # Mapping data access layer
│   └── index.ts                          # DAO exports
├── services/                             # Business logic layer
│   ├── base-service.ts                   # Abstract base service with common operations
│   ├── transformation-policy-service.ts  # Policy service
│   ├── origin-service.ts                 # Origin service
│   ├── mapping-service.ts                # Mapping service
│   └── index.ts                          # Service exports
├── interfaces/                           # Type definitions and interfaces
│   ├── types.ts                          # DynamoDB entity types and validators
│   ├── dao.ts                            # DAO interface definitions
│   ├── service.ts                        # Service interface definitions
│   └── index.ts                          # Interface exports
├── common/                               # Shared utilities and error handling
│   ├── error.ts                          # Custom error classes and error codes
│   ├── utils.ts                          # Common utility functions
│   └── index.ts                          # Common exports
├── test/                                 # Test files
│   ├── mocks.ts                          # Test mocks and fixtures
│   ├── setupJestMocks.ts                 # Jest setup configuration
│   ├── transformation-policy/            # Policy-related unit tests
│   │   └── transformation-policy-dao.test.ts
│   ├── origin/                           # Origin-related unit tests
│   │   ├── origin-dao.test.ts
│   │   └── origin-service.test.ts
│   ├── mapping/                          # Mapping-related unit tests
│   │   └── mapping-dao.test.ts
│   └── e2e/                              # End-to-end integration tests
│       ├── global-setup.ts               # E2E test setup (DynamoDB, Cognito)
│       ├── global-teardown.ts            # E2E test cleanup
│       ├── dynamodb-client.ts            # DynamoDB test utilities
│       ├── cognito-client.ts             # Cognito test utilities
│       ├── cfn-client.ts                 # CloudFormation test utilities
│       ├── utils.ts                      # E2E test helper functions
│       ├── negative.test.ts              # Authorization & error handling tests
│       ├── policies.test.ts              # Policy CRUD operations tests
│       ├── origins.test.ts               # Origin CRUD operations tests
│       └── mappings.test.ts              # Mapping CRUD operations tests
├── index.ts                              # Lambda entry point with middleware
├── routes.ts                             # API route definitions and handlers
├── package.json                          # Dependencies and scripts
├── tsconfig.json                         # TypeScript configuration
├── jest.unit.config.js                   # Jest unit test configuration
├── jest.e2e.config.js                    # Jest E2E test configuration
└── README.md                             # This file
```
