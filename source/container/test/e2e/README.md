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
```

### Fast local iteration (recommended)

Seeding DDB triggers a redeploy of the ECS service, and the suite must wait ~3 min
for the DDB stream batch window plus ECS stabilization. To avoid paying that on every
run, bootstrap **once** and then iterate freely:

```bash
npm run test:e2e:up      # one-time: create bucket, seed DDB, pay the ~3-min wait, persist state
npm run test:e2e         # fast loop: no seeding, no wait, no teardown (repeat as often as you like)
npm run test:e2e -- -t "smart crop"   # iterate on a single scenario
npm run test:e2e:down    # when finished: delete bucket + DDB data, remove state
```

`test:e2e:up` writes a gitignored `.e2e-state.json` recording the bucket and stack
details. `test:e2e` (which sets `SKIP_SETUP=true`) auto-discovers the bucket from that
file — no need to hand-copy `TEST_BUCKET`. If the bucket no longer exists (e.g. the
stack was redeployed/destroyed), the run fails loudly telling you to re-run
`test:e2e:up`.

### One-shot run (CI / full lifecycle)

```bash
npm run test:e2e:ci      # full setup + tests + teardown in a single jest run
```

### Optional overrides

```bash
export TEST_BUCKET=my-existing-bucket   # use an existing bucket (not auto-deleted)
export EXTERNAL_ORIGIN_BUCKET=my-external-bucket # Not currently used or provisioned.
```

## How It Works

**Setup** (`test:e2e:up` / `test:e2e:ci`):
1. Generates test images if they don't exist (`test.jpg`, `test.png`, `test.gif`)
2. Creates a temporary S3 bucket: `dit-e2e-test-<hex>` (or uses `TEST_BUCKET` if provided)
3. Uploads test images
4. Seeds DynamoDB with test policies/origins/mappings
5. Waits ~3 min for the DDB stream batch window, then for ECS to stabilize
6. Waits for CloudFront health check

**Fast loop** (`test:e2e`, `SKIP_SETUP=true`):
1. Resolves the bucket from `TEST_BUCKET` or `.e2e-state.json`
2. Verifies the bucket still exists (`HeadBucket`)
3. Waits for CloudFront health check, then runs the suite — no seeding, no wait, no teardown

**Teardown** (`test:e2e:down` / `test:e2e:ci`):
1. Deletes all test data from DynamoDB
2. Deletes the auto-created bucket (preserves user-provided buckets)
3. Removes `.e2e-state.json`

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
