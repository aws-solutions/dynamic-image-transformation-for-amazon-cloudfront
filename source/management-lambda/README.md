# Management Lambda

A TypeScript AWS Lambda function that serves the v8 management API. The admin UI uses it to create, read, update and delete transformation policies, origins, and mappings, which it stores in the DynamoDB config table.

## How a request flows

```
┌─────────────────┐
│   API Gateway   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Lambda Handler  │  ← Middleware chain and router
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Service Layer   │  ← Business logic & validation
└─────────┬───────┘
          │
┌─────────▼───────┐
│   DAO Layer     │  ← Data access & item validation
└─────────┬───────┘
          │
┌─────────▼───────┐
│   DynamoDB      │  ← Config table
└─────────────────┘
```

API Gateway invokes the handler in [index.ts](./index.ts). It is a [Middy](https://middy.js.org/) chain. In order, it adds the Lambda context and request ID to log lines, normalizes headers, applies CORS for `CORS_ORIGIN`, adds security headers, parses JSON bodies on POST and PUT (invalid JSON returns 415 `INVALID_JSON`), turns thrown errors into API responses, and marks responses `no-store`. The router then dispatches to the handler in [routes.ts](./routes.ts).

Each resource then passes through two layers:

| Layer | Folder | Job |
|-------|--------|-----|
| Service | [services/](./services/) | Validates requests against the shared Zod schemas in [data-models](../data-models/README.md) and applies business rules |
| DAO | [dao/](./dao/) | Reads and writes DynamoDB, validating items on both read and write. Common operations live in `base-dao.ts` |

To add a resource, follow the pattern of an existing one: a DAO extending `BaseDAO`, a service extending `BaseService`, and routes in `routes.ts`.

## API

The full contract is the OpenAPI spec, [open-api-spec.yaml](../constructs/lib/v8/constructs/dal/open-api-spec.yaml). The routes are defined in [routes.ts](./routes.ts).

| Resource | Collection | Item |
|----------|------------|------|
| Transformation policies | `GET`, `POST /policies` | `GET`, `PUT`, `DELETE /policies/{policyId}` |
| Origins | `GET`, `POST /origins` | `GET`, `PUT`, `DELETE /origins/{originId}` |
| Mappings | `GET`, `POST /mappings` | `GET`, `PUT`, `DELETE /mappings/{mappingId}` |

List endpoints return `{ "items": [...], "nextToken": "..." }`. Pass `nextToken` back as a query parameter to get the next page. Tokens are encrypted with a key from Secrets Manager (`PAGINATION_TOKEN_SECRET_ARN`) and bound to the account (`ACCOUNT_ID`), so clients must treat them as opaque.

Errors are classes in [common/error.ts](./common/error.ts), each mapped to a status code (400, 404, 415, 429, 500) and an error code from the same file.

## Storage

The config table uses a single-table design. The API request and response types come from [data-models](../data-models/README.md); the DynamoDB item schemas are in [interfaces/types.ts](./interfaces/types.ts).

**Generic entity structure**

```
{
  PK: "{entityId}",                  // Primary key
  GSI1PK: "{ENTITY_TYPE}",           // Entity type for listing
  GSI1SK: "{sortableField}",         // Sort key (name, pattern, etc.)
  CreatedAt: "ISO_DATE_STRING",      // Creation timestamp
  UpdatedAt?: "ISO_DATE_STRING",     // Last update timestamp
  Data: {                            // Entity-specific data
    // ... entity fields
  }
}
```

**Transformation policy**

```
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

```
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

```
{
  PK: "{mappingId}",
  GSI1PK: "PATH_MAPPING" | "HOST_HEADER_MAPPING",
  GSI1SK: "{pattern}",
  GSI2PK: "ORIGIN#{originId}",       // For querying by origin
  GSI3PK?: "POLICY#{policyId}",      // For querying by policy
  Data: {
    mappingName: string,
    description?: string,
    originId: string,
    policyId?: string
  }
}
```

## Testing

```bash
# Unit tests
npm test
npm test -- transformation-policy-dao.test.ts

# End-to-end tests against a deployed stack
CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run test:e2e
CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run test:e2e -- policies.test.ts

# Throttling tests (excluded from test:e2e; leaves the API's throttling in place)
CURRENT_STACK_REGION=us-east-1 CURRENT_STACK_NAME=my-stack npm run test:e2e:throttling
```

The end-to-end tests need a deployed stack and local AWS credentials with DynamoDB, Cognito and CloudFormation permissions. They live in [test/e2e/](./test/e2e/).

## Configuration

| Name | Read in | What it does | Set by CDK |
|------|---------|--------------|------------|
| `CONFIG_TABLE_NAME` | `routes.ts`, `dao/base-dao.ts` | DynamoDB config table | Yes, `constructs/lib/v8/constructs/dal/dal-construct.ts` |
| `ACCOUNT_ID` | `dao/base-dao.ts` | AWS account ID that pagination tokens are bound to. Required | Yes, `dal-construct.ts` |
| `CORS_ORIGIN` | `index.ts` | Allowed CORS origin | Yes, the admin UI CloudFront URL, `dal-construct.ts` |
| `PAGINATION_TOKEN_SECRET_ARN` | `common/pagination-token-service.ts` | Secrets Manager secret used to encrypt and validate `nextToken` values | Yes, `dal-construct.ts` |
| `POWERTOOLS_LOGGER_LOG_LEVEL` | `common/logger.ts` | Log level. Default `INFO` | Yes, `INFO`, `dal-construct.ts` |
| `SOLUTION_ID`, `SOLUTION_VERSION` | `../solution-utils/get-options.ts` | Adds the solution to the AWS SDK user agent | Yes, `constructs/lib/v8/constructs/common/lambda.ts` |

The end-to-end tests read `CURRENT_STACK_REGION` and `CURRENT_STACK_NAME`.
