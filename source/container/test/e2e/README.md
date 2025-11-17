# E2E Tests for DIT Container
## Prerequisites

1. **Deployed DIT CloudFormation Stack**

2. **AWS Credentials**
   - Permissions for CloudFormation, DynamoDB, S3, ECS

## Running E2E Tests

```bash
# Set required environment variables
export CURRENT_STACK_REGION=us-east-1
export CURRENT_STACK_NAME=v8-Stack

# Optional: Use existing S3 buckets instead of auto-creating them
export TEST_BUCKET=my-existing-bucket
export EXTERNAL_ORIGIN_BUCKET=my-external-bucket # Not currently used or provisioned. Might want to use nginx on an ec2 instance instead.

# Optional: Skip DDB seeding and ECS deployment wait for faster iteration
export SKIP_SETUP=true

# Run E2E tests
npm run test:e2e
```

## How It Works

**Setup:**
1. Generates test images if they don't exist (`test.jpg`, `test.png`, `test.gif`)
2. Creates temporary S3 buckets: `dit-e2e-<uuid>` (or uses `TEST_BUCKET`/`EXTERNAL_ORIGIN_BUCKET` if provided)
3. Uploads test images to both buckets
4. Seeds DynamoDB with test policies/origins/mappings (skip with `SKIP_SETUP=true`)
5. Waits for ECS deployment to stabilize (skip with `SKIP_SETUP=true`)
6. Waits for CloudFront health check

**Teardown:**
1. Deletes all test data from DynamoDB
2. Deletes auto-created buckets (preserves user-provided buckets)

## Test Structure

- `setup/` - Global setup/teardown and AWS clients
- `scenarios/` - Test scenarios organized by feature
- `helpers/` - Shared test utilities

## Key Differences from Integration Tests

| Aspect | Integration Tests | E2E Tests |
|--------|------------------|-----------|
| **DynamoDB** | Local Docker | Real AWS DynamoDB |
| **Image Origins** | Test HTTP server | Real S3 + Developer S3 |
| **Container** | In-process Express | Deployed ECS behind ALB |
| **Network** | Direct calls | HTTP through CloudFront |
| **Setup** | `docker-compose up` | Requires deployed stack |

## Test Data Cleanup

E2E tests use unique test run IDs to avoid conflicts. All test data (DynamoDB records and S3 bucket) is automatically cleaned up in global teardown.
