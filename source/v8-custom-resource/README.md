# V8 Custom Resource

The CloudFormation custom resource for the v8 (ECS) stack. It is separate from the legacy [custom-resource](../custom-resource/README.md) so the v7 code can be removed on its own when support ends.

## What it does

| Action | When | What it does |
|--------|------|--------------|
| `CREATE_UUID` | Stack create | Generates a unique ID for the deployment |
| `SEND_METRIC` | Create, update and delete, when `AnonymousData` is `Yes` | Sends anonymous usage metrics: region, request type, and `DeploymentSize` |

The payload also includes `UseExistingCloudFrontDistribution`, which is always `n/a` on v8. All other configuration, such as origins and policies, lives in DynamoDB and is managed through the admin UI, so this resource calls no AWS services.

## Configuration

| Name | Read in | What it does | Set by CDK |
|------|---------|--------------|------------|
| `SOLUTION_ID`, `SOLUTION_VERSION` | `index.ts` | Solution and version fields in the metrics payload | Yes, `source/constructs/lib/v8/constructs/metrics/metrics-construct.ts` |

## Testing

```bash
cd source/v8-custom-resource
npm ci
npm test
```
