# constructs (CDK app)

The AWS CDK app that defines both deployable stacks. It bundles the Lambda packages and the admin UI from their sibling folders, and for v8 builds the container image from `source/Dockerfile`.

| Stack | Architecture | Defined in |
|-------|--------------|------------|
| `v7-Stack` | Lambda: API Gateway (or S3 Object Lambda) in front of the [image-handler](../image-handler/README.md) Lambda | `lib/serverless-image-stack.ts` |
| `v8-Stack` | ECS: the [container](../container/README.md) on Fargate behind an ALB, with the admin UI and management API | `lib/v8/stacks/management-stack.ts`. See [lib/v8/README.md](./lib/v8/README.md) |

## Layout

| Path | What it holds |
|------|---------------|
| `bin/constructs.ts` | CDK app entry point; creates both stacks |
| `lib/serverless-image-stack.ts`, `lib/back-end/`, `lib/front-end/`, `lib/common-resources/`, `lib/dashboard/` | v7 stack, its constructs, and its CloudWatch dashboard |
| `lib/v8/` | v8 stacks, constructs, CloudFront Functions, and tests |
| `utils/` | CDK aspects and helpers shared by both |
| `test/` | v7 snapshot tests |
| `cdk.json` | App command and context (`solutionId`, `solutionVersion`, `solutionName`, `vpcCidr`, `environment`; see Configuration) |

## Develop

```bash
cd source/constructs
npm run clean:install
```

`clean:install` installs this package, then runs `install:dependencies` from `source/` to install every Lambda package and build the admin UI, because synthesis bundles them. It then symlinks `metrics-utils/node_modules/aws-cdk-lib` to this package's copy so both use one `aws-cdk-lib`; with two copies, TypeScript reports type mismatches between them.

| Task | Command |
|------|---------|
| Unit and snapshot tests | `npm test` (its `pretest` runs `clean:install`) |
| Update snapshots after an intended template change | `overrideWarningsEnabled=false npx jest -u` |
| Synthesize templates | `npm run cdk:synth` |
| Deploy | See the [root README](../../README.md#3-build-and-deploy) and [lib/v8/README.md](./lib/v8/README.md#deploy) |

`overrideWarningsEnabled=false` turns off AWS Solutions Constructs warnings about overridden defaults. The npm scripts set it; set it yourself when calling `jest` or `cdk` directly.

## Common tasks

- **Change a v8 resource or an environment variable passed to a Lambda or the container:** `lib/v8/constructs/`. The container's variables are set in `lib/v8/constructs/processor/alb-ecs-construct.ts` and `lib/v8/stacks/image-processing-stack.ts`; each runtime package's README lists which ones CDK sets.
- **Add a stack parameter:** v8 parameters are on the top-level stack in `lib/v8/stacks/management-stack.ts` and passed down to the nested image processing stack.
- **Review template changes:** run the tests. A failing snapshot shows the template diff; update snapshots only when the change is intended.

## Configuration

These variables are read at synthesis time, not by a deployed resource. For a local deploy none are needed; `cdk.json` context supplies the defaults.

| Name | Read in | What it does |
|------|---------|--------------|
| `DIST_OUTPUT_BUCKET`, `SOLUTION_NAME`, `VERSION` | `bin/constructs.ts` | When all three are set, assets are published to `<DIST_OUTPUT_BUCKET>-<region>` under `<SOLUTION_NAME>/<VERSION>/` instead of the CDK bootstrap bucket. `SOLUTION_NAME` and `VERSION` also override the `cdk.json` values |
| `SOLUTION_ID` | `bin/constructs.ts`, `lib/v8/constructs/common/*.ts`, `lib/v8/constructs/processor/alb-ecs-construct.ts` | Overrides `solutionId` from `cdk.json` |
| `PUBLIC_ECR_REGISTRY` | `bin/constructs.ts` | When set, the v8 stack uses `<PUBLIC_ECR_REGISTRY>/<SOLUTION_NAME>:<VERSION>` as the container image instead of building one |
| `TEST_TYPE` | `jest.config.js` | `e2e` selects the end-to-end test config (`npm run e2e-test`) |
| `overrideWarningsEnabled` | AWS Solutions Constructs | `false` turns off override warnings |

CDK context values (set in `cdk.json` or with `-c key=value`) also change the v8 template:

| Key | Default | What it does |
|-----|---------|--------------|
| `deploymentMode` | `prod` | `dev` makes the ALB internet-facing in the public subnets and skips the CloudFront distribution and CloudFront Function |
| `vpcCidr` | `10.0.0.0/16` | CIDR block of the v8 VPC |
| `environment` | `dev` in `cdk.json` | `dev` sets the config table and Cognito user pool removal policy to DESTROY instead of RETAIN |

## Related

- [lib/v8/README.md](./lib/v8/README.md): v8 stacks, parameters, sizing, and deploy
- [source/README.md](../README.md): the packages this app bundles
