# Container (v8 image processor)

The Express.js server that runs on Amazon ECS in the v8 (ECS) architecture. CloudFront forwards image requests to it through an Application Load Balancer. For each request it finds the origin, works out the transformations from the URL and any transformation policy, fetches the source image, applies the edits with [Sharp](https://sharp.pixelplumbing.com/), and returns the result.

Origins, mappings, and transformation policies live in the DynamoDB config table that the [management API](../management-lambda/README.md) writes. The container reads that table once at startup into in-memory caches. It does not read it again while running.

## Layout

| Path | What it holds |
|------|---------------|
| `src/server.ts` | HTTP server, port, graceful shutdown |
| `src/app.ts` | Middleware chain and error handlers (see below) |
| `src/routes/` | `/health`, and the catch-all image route (`image.ts`) |
| `src/middleware/` | Query parsing, base64 path decoding, Cognito token check, device simulation |
| `src/services/request-resolver/` | Validates the request and picks the origin (path mapping, host header mapping, or origin override header) |
| `src/services/transformation-resolver/` | Merges URL parameters with the transformation policy, evaluates conditions, applies auto-optimization and the transformation limit |
| `src/services/image-processing/` | Fetches the origin image, maps transformations to Sharp edits, encodes the output |
| `src/services/cache/`, `src/services/initialization/` | In-memory caches of the config table and the startup code that fills them |
| `src/services/` (other) | DynamoDB client, and Amazon Rekognition calls with their DynamoDB result cache |
| `test/integration/`, `test/e2e/` | Integration tests (DynamoDB Local) and end-to-end tests against a deployed stack |

The image route calls three services in order: request resolver, then transformation resolver, then image processor (`src/routes/image.ts`).

## Middleware chain

Registered in `src/app.ts`, in this order:

| # | Middleware | What it does | Why it sits here |
|---|-----------|--------------|------------------|
| 1 | `helmet()` | Security response headers | Applies to every response, including errors |
| 2 | `cors()` | CORS headers on container responses | Early so preflight requests get an answer. In deployed stacks CloudFront also sets CORS headers |
| 3 | `compression()` | Compresses response bodies | Wraps every response written after it |
| 4 | `queryTypesMiddleware()` | Parses the query string into typed values (numbers, booleans, arrays, nested objects) | Everything after it reads typed `req.query` values |
| 5 | `b64DecoderMiddleware()` | Decodes a base64url JSON path (`{"path", "edits", "policyId"}`) into a normal path and query | After query parsing, because it overwrites `req.query` with the decoded edits |
| 6 | `morgan('combined')` | Access log line per request | Logs the decoded URL |
| 7 | `express.json` / `express.urlencoded` (10 MB limit) | Parses JSON and form bodies | Before the routes |
| 8 | `cognitoJwtValidator` (mounted with the routes) | If Cognito is configured and `x-dit-authorization: Bearer <access token>` is valid, marks the request authenticated and applies device simulation headers | Runs before the routes so the image route knows whether to attach `x-dit-metrics` |
| 9 | Error handlers | Maps Express 4xx errors (bad encoding, oversized body) to 4xx JSON, everything else to 500 | Last, so it catches errors from every step |

`initializeContainer()` is also started in `app.ts`. It does not block requests; `/health` returns 503 until it finishes.

## Develop

The container is an npm workspace member together with `data-models`, so install from `source/`:

```bash
cd source
npm ci
```

| Task | Command (from `source/container`) |
|------|-----------------------------------|
| Unit tests | `npm test` (its `pretest` deletes `node_modules` and runs `npm ci`) |
| Integration tests | `npm run test:integration` (needs Docker and the standalone `docker-compose` command; starts DynamoDB Local from `docker-compose.test.yml`) |
| End-to-end tests | See [test/e2e/README.md](./test/e2e/README.md) (needs a deployed stack) |
| Type-check and compile | `npm run build` |
| Lint | `npm run lint` |

### Run locally against a deployed stack

The container exits at startup (`process.exit(1)`) if it cannot load the config table, so it needs a real table. The simplest setup is to deploy the v8 stack once and point a local container at its tables. Config changes then take a container restart instead of an ECS rolling deployment.

1. Get the table names from the deployed stack. The config table name is the stack output whose key contains `ConfigTableName`. The Rekognition cache table is the `RekognitionCacheTable` resource in the image processing nested stack. It is only needed for smart crop and content moderation, and the container falls back to calling Rekognition directly if it is missing.
2. Build the image. The build context is `source/`, because the image also contains `data-models`:

   ```bash
   cd source
   docker build -t dit-container:local .
   ```

3. Run it with credentials that can read the config table (and read and write the Rekognition cache table, if you use it):

   ```bash
   eval "$(aws configure export-credentials --profile <PROFILE_NAME> --format env)"
   docker run --rm -p 8080:8080 \
     -e AWS_REGION=<STACK_REGION> \
     -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
     -e DDB_TABLE_NAME=<CONFIG_TABLE_NAME> \
     -e REKOGNITION_CACHE_TABLE=<REKOGNITION_CACHE_TABLE_NAME> \
     dit-container:local
   ```

4. Check it and send a request:

   ```bash
   curl -s localhost:8080/health          # {"status":"HEALTHY",...}
   curl -s -o out.webp 'localhost:8080/<path-that-matches-a-mapping>?resize.width=200&format=webp'
   ```

To pick up a change made in the admin UI or the management API, restart the container. In a deployed stack the same change triggers a new ECS deployment through the DynamoDB stream and the [utility Lambda](../utility-lambda/README.md).

To test without creating mappings first, add `-e CUSTOM_ORIGIN_HEADER=dit-origin-override` and send the origin in that header, for example `curl -H 'dit-origin-override: https://my-images.example.com' 'localhost:8080/photo.jpg?format=webp'`.

For faster edits to TypeScript, run the server with `ts-node` instead of Docker. Use the same environment variables. It listens on port 3000:

```bash
cd source/container
DDB_TABLE_NAME=<CONFIG_TABLE_NAME> AWS_REGION=<STACK_REGION> npm run dev
```

With no deployed stack, the integration tests show how to create a config table in DynamoDB Local (`test/integration/setup/`), and `AWS_ENDPOINT_URL_DYNAMODB` points the container at it.

## Common tasks

- **Add or change a transformation:** start with the [data-models walkthrough](../data-models/README.md#add-a-transformation-parameter).
- **Change how the origin is chosen:** `src/services/request-resolver/`.
- **Change the order edits are applied in:** `src/services/image-processing/transformation-engine/edit-applicator.ts`.
- **Change what CDK passes to the container:** `source/constructs/lib/v8/constructs/processor/alb-ecs-construct.ts`.

## Configuration

AWS SDK settings (`AWS_REGION`, credentials) are read the standard way. The container reads these variables:

| Name | Read in | What it does | Set by CDK |
|------|---------|--------------|------------|
| `DDB_TABLE_NAME` | `services/database/index.ts` | Config table the caches load at startup. Required | Yes, `alb-ecs-construct.ts` |
| `REKOGNITION_CACHE_TABLE` | `services/rekognition/rekognition-cache-dao.ts` | Cache of Rekognition results. Read and write errors are logged and the call goes to Rekognition | Yes, `image-processing-stack.ts` |
| `REKOGNITION_CACHE_TTL` | `services/rekognition/rekognition-cache-dao.ts` | Cache entry lifetime in seconds. Default `86400` | Yes, `86400`, `image-processing-stack.ts` |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | `middleware/cognito-jwt-validator.ts` | Enables the `x-dit-authorization` token check. Unset means every request is unauthenticated | Yes, `alb-ecs-construct.ts` |
| `CUSTOM_ORIGIN_HEADER` | `services/request-resolver/request-resolver.service.ts` | Name of a request header whose URL value replaces origin lookup | Yes, `alb-ecs-construct.ts`, from the `OriginOverrideHeader` parameter; empty disables the override |
| `LIMIT_INPUT_PIXELS` | `services/image-processing/image-processor.service.ts` | Largest source image, in pixels, Sharp will decode. Default `50000000` | Yes, per deployment size, `alb-ecs-construct.ts` |
| `SOLUTION_ID`, `SOLUTION_VERSION` | `utils/get-options.ts` | Adds the solution to the AWS SDK user agent | Yes, `alb-ecs-construct.ts` |
| `PORT` | `server.ts` | Listen port. Default `3000` | No. The image sets `8080` (`source/Dockerfile`) |
| `HOST` | `server.ts` | Listen address. Default `0.0.0.0` | No |
| `NODE_ENV` | `app.ts`, `services/initialization/index.ts`, `utils/url-validator.ts` | `development` puts error detail in error responses. `test` skips startup loading and allows `http://localhost` origins | No. The image sets `production` |
| `SKIP_INITIALIZATION` | `services/initialization/index.ts` | `true` skips loading the config table; the caches are never registered, so `/health` reports healthy but image requests are not expected to work | No |
| `AWS_ENDPOINT_URL_DYNAMODB` | `services/database/ddb-driver.ts` | DynamoDB endpoint override, for DynamoDB Local | No |
| `MAX_TRANSFORMATIONS` | `services/transformation-resolver/transformation-limiting/transformation-limiter.ts` | Most transformations applied to one request. Default `10` | No, so deployed stacks use `10` |
| `CORS_ORIGIN` | `routes/image.ts` | Adds `Access-Control-Allow-Origin` to image responses | No. CloudFront's response headers policy handles CORS (`image-processing-stack.ts`) |
| `SHARP_SIZE_LIMIT` | `services/image-processing/utils/sharp-utils.ts` | Read by `SharpUtils.getDefaultSharpOptions()`, which nothing calls, so it has no effect. Use `LIMIT_INPUT_PIXELS` | No |

## Related

- [data-models](../data-models/README.md): the schemas the container validates transformations against
- [management-lambda](../management-lambda/README.md): the API that writes the config table
- [constructs/lib/v8](../constructs/lib/v8/README.md): the CDK stacks that deploy the container
- [source/README.md](../README.md): workspace install and the full package list
