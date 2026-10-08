# utility-lambda (v8)

A Lambda function that keeps the v8 container in step with its configuration. The container loads the config table only at startup, so when an origin, mapping, or policy changes, this Lambda starts a new ECS deployment and the new tasks load the change.

It is triggered by the config table's DynamoDB stream (`source/constructs/lib/v8/constructs/common/utility.ts`). On any insert, modify, or remove it calls ECS `UpdateService` with `forceNewDeployment`. Stream records are batched for up to 3 minutes, so a redeploy can start up to 3 minutes after the change.

## Layout

| Path | What it holds |
|------|---------------|
| `index.ts` | Handler: passes the event to the first utility whose `canHandle` accepts it |
| `utilities/ecs-deployment.ts` | Forces the ECS deployment for DynamoDB stream events |
| `types.ts` | Event and utility interfaces |

## Develop

```bash
cd source/utility-lambda
npm ci
npm test
```

## Configuration

| Name | Read in | What it does | Set by CDK |
|------|---------|--------------|------------|
| `ECS_CLUSTER_NAME`, `ECS_SERVICE_NAME` | `utilities/ecs-deployment.ts` | Service to redeploy | Yes, `utility.ts` |
| `SOLUTION_ID`, `SOLUTION_VERSION` | `../solution-utils/get-options.ts` | Adds the solution to the AWS SDK user agent | Yes, `utility.ts` |

## Related

- [container](../container/README.md): what gets redeployed, and how to skip the redeploy when running locally
