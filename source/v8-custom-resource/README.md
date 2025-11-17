# V8 Custom Resource

This is the minimal custom resource implementation for DIT v8 (ECS architecture).

## Purpose

The v8 custom resource handles only two actions:
1. **UUID Generation** - Creates a unique identifier for the deployment
2. **Metrics Collection** - Sends anonymous usage metrics to AWS

## Key Differences from Legacy Custom Resource

The v8 custom resource is significantly simplified compared to the legacy implementation:

- **80% smaller codebase** (~150 lines vs ~800 lines)
- **Only 2 actions** vs 10 actions in legacy
- **1 metric tracked** (UseExistingCloudFrontDistribution) vs 11 metrics
- **2 NPM dependencies** (axios, moment) vs 3 in legacy - uses native crypto.randomUUID()
- **No AWS service dependencies** (only metrics endpoint)
- **30 second timeout** vs 60 seconds
- **Runtime validation** - Configuration is validated at runtime via Admin UI, not at deployment

## Metrics Tracked

The only deployment-time metric tracked is:
- `UseExistingCloudFrontDistribution` - Whether the deployment uses an existing CloudFront distribution

All other configuration (origins, policies, etc.) is managed via DynamoDB and the Admin UI.

## Architecture

```
CloudFormation Stack
  └─> Custom Resource Lambda
      ├─> CREATE_UUID (on CREATE only)
      └─> SEND_METRIC (on CREATE/UPDATE/DELETE if AnonymousData=Yes)
```

## Testing

Run unit tests:
```bash
npm test
```

## Why Separate from Legacy?

The v8 custom resource is in a separate directory (`v8-custom-resource`) to:
1. Avoid conflicts with legacy custom resource
2. Enable clean removal of legacy code when support ends
3. Reflect the architectural shift to ECS
4. Maintain simpler, focused codebase
