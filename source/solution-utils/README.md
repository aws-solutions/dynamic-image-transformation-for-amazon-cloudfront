# solution-utils

Small helpers shared by the Lambda packages, imported by relative path (for example `../solution-utils/get-options`) rather than as an npm package. CDK bundles them into each Lambda that imports them.

| File | What it provides |
|------|------------------|
| `get-options.ts` | `getOptions()`: AWS SDK client options with a `customUserAgent` of `AwsSolution/<SOLUTION_ID>/<SOLUTION_VERSION>` when both variables are set |
| `helpers.ts` | `isNullOrWhiteSpace()` |
| `logger.ts` | Level-filtered console logger (currently unused) |

Used by image-handler, custom-resource, management-lambda, utility-lambda, metrics-utils, and the CSP updater in constructs. The container has its own copy of `get-options.ts` (`source/container/src/utils/`), because its Docker image only includes the container and data-models.

## Develop

```bash
cd source/solution-utils
npm test    # pretest deletes node_modules and runs npm install
```

## Configuration

| Name | Read in | What it does |
|------|---------|--------------|
| `SOLUTION_ID`, `SOLUTION_VERSION` | `get-options.ts` | Values for the user agent. Each Lambda's CDK construct sets them |
