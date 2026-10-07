# custom-resource (v7)

CloudFormation custom resource Lambda functions for the v7 (Lambda) stack. They run during stack create, update, and delete. v8 uses the smaller [v8-custom-resource](../v8-custom-resource/README.md) instead.

## Layout

| Path | What it holds |
|------|---------------|
| `index.ts` | Main handler. Dispatches on the `CustomAction` resource property (see `lib/enums.ts`): check source buckets and the first bucket's region, check the Secrets Manager secret and the fallback image, validate an existing CloudFront distribution, create the CloudFront logging bucket, write the demo UI config file, create the deployment UUID, and send anonymous metrics |
| `event-source-mapping-resolver/index.ts` | Separate handler that deletes a duplicate Lambda event source mapping during an upgrade, so CloudFormation can create the new one. Deployed by `source/constructs/lib/common-resources/event-source-mapping-resolver-construct.ts` |
| `lib/` | Enums, request and response types |

Shared helpers come from [solution-utils](../solution-utils/README.md) by relative import.

## Develop

```bash
cd source/custom-resource
npm test    # pretest deletes node_modules and runs npm ci
```

CDK bundles both handlers; there is no separate build step.

## Common tasks

- **Add a deployment-time check:** add a value to `CustomResourceActions` in `lib/enums.ts`, a case in `index.ts`, and the custom resource that calls it in `source/constructs/lib/common-resources/custom-resources/custom-resource-construct.ts`.

## Configuration

| Name | Read in | What it does | Set by CDK |
|------|---------|--------------|------------|
| `RETRY_SECONDS` | `index.ts` | Base delay, in seconds, between retries when writing the demo UI config and checking the secret or fallback image | Yes, `5`, `custom-resource-construct.ts` |
| `SOLUTION_ID`, `SOLUTION_VERSION` | `index.ts`, `../solution-utils/get-options.ts` | Metrics payload and AWS SDK user agent | Yes, `custom-resource-construct.ts` |
| `AWS_REGION` | `index.ts` | Region in metrics and region checks | Set by the Lambda runtime |

## Related

- [constructs](../constructs/README.md): the `v7-Stack` that uses these resources
- [image-handler](../image-handler/README.md): the v7 image Lambda
