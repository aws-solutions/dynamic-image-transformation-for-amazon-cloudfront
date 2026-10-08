# metrics-utils (v7 and v8)

A CDK construct, `SolutionsMetrics`, plus the Lambda it deploys, used by both stacks to send anonymous operational metrics. On a schedule, the Lambda runs CloudWatch metric and Logs Insights queries, reads counts from the v8 config table when one is configured, and sends the results to the AWS Solutions metrics endpoint. Log queries finish asynchronously, so the Lambda sends itself an SQS message and collects the results on the next invocation.

The constructs package imports it as the `metrics-utils` npm dependency (`source/constructs/lib/back-end/back-end-construct.ts`, `source/constructs/lib/v8/stacks/image-processing-stack.ts`).

## Layout

| Path | What it holds |
|------|---------------|
| `lib/solutions-metrics.ts` | The construct: Lambda, EventBridge schedule, SQS queue, and `addQueryDefinition` and `addMetricDataQuery`, which register the queries to run |
| `lib/query-builders.ts` | Builders for metric and Logs Insights queries |
| `lambda/index.ts` | Handler for the scheduled event and the SQS follow-up |
| `lambda/helpers/` | Query execution, config table scan, metric sending, logger |
| `index.ts` | Package exports |

## Develop

Install through [constructs](../constructs/README.md), then test here:

```bash
cd source/constructs && npm run clean:install
cd ../metrics-utils && npm test
```

`clean:install` installs this package and replaces its `node_modules/aws-cdk-lib` with a symlink to the constructs copy. A standalone `npm ci` here leaves two copies of `aws-cdk-lib`, and the tests fail to compile with a type mismatch on `DITNodejsFunction` (which this package imports from constructs).

## Configuration

Set by `lib/solutions-metrics.ts` on the Lambda it creates.

| Name | Read in | What it does |
|------|---------|--------------|
| `QUERY_PREFIX` | `lambda/helpers/metrics-helper.ts` | Prefix of the Logs Insights query definitions to run (`<stack name>-`) |
| `EXECUTION_DAY` | `lambda/index.ts`, `lambda/helpers/metrics-helper.ts` | Schedule day (`ExecutionDay`). `ExecutionDay.DAILY` makes the reporting window one day instead of seven |
| `CONFIG_TABLE_ARN` | `lambda/helpers/metrics-helper.ts` | v8 config table to count entities in. Only set when the stack passes one |
| `SQS_QUEUE_URL` | `lambda/helpers/metrics-helper.ts` | Queue for the follow-up message. Set by the AWS Solutions Constructs `LambdaToSqsToLambda` construct |
| `SOLUTION_ID`, `SOLUTION_VERSION`, `UUID`, `AWS_ACCOUNT_ID`, `AWS_STACK_ID` | `lambda/helpers/metrics-helper.ts` | Fields in the metrics payload |
| `POWERTOOLS_LOGGER_LOG_LEVEL` | `lambda/helpers/logger.ts` | Log level. Default `INFO` |
| `AWS_REGION`, `AWS_DEFAULT_REGION` | `lambda/helpers/client-helper.ts` | Region for the AWS SDK clients. Set by the Lambda runtime |
| `VERSION` | `lib/solutions-metrics.ts` | Read at synthesis time; overrides `solutionVersion` from `cdk.json` |

## Related

- [constructs](../constructs/README.md): the stacks that use this construct
- [v8-custom-resource](../v8-custom-resource/README.md): the deployment-time metric for v8
