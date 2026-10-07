# Source packages

Each folder under `source/` is its own npm package with its own `package.json` and tests. This page covers installing them together and lists what each one is.

## Install

`container` and `data-models` form an npm workspace rooted here; one install covers both:

```bash
cd source
npm ci
```

The other packages install separately. To install the Lambda packages, demo UI and admin UI (and build the admin UI, which the v8 stack deploys), run from `source/`:

```bash
npm run install:dependencies
```

This skips `constructs` and `solution-utils`, which install on their own; the workspace install above covers `container`.

[constructs](./constructs/README.md) runs this for you in `npm run clean:install`, because synthesizing the stacks bundles every package.

## Test

Run everything the way the release build does:

```bash
cd deployment
./run-unit-tests.sh
```

The script needs Docker and AWS credentials, because it logs in to Amazon ECR Public to pull the container's base image. It then runs `npm test` in every package except `demo-ui`. A single package can also be tested alone with `npm test` in its folder; several packages reinstall their dependencies first (`pretest`).

Lint and format from `source/` with `npm run lint` and `npm run prettier-format`.

## Package guide

v7 is the Lambda architecture (`v7-Stack`), v8 the ECS architecture (`v8-Stack`). See the [root README](../README.md#architecture-diagram) for diagrams.

| Package | Arch | What it is |
|---------|------|------------|
| [constructs](./constructs/README.md) | both | CDK app that defines and deploys both stacks |
| [container](./container/README.md) | v8 | Express.js image processor that runs on ECS |
| [data-models](./data-models/README.md) | v8 | Zod schemas for origins, mappings, and transformation policies, shared by the container, management API, and admin UI |
| [management-lambda](./management-lambda/README.md) | v8 | REST API that stores configuration in DynamoDB |
| [admin-ui](./admin-ui/README.md) | v8 | React admin console for configuration and the Playground |
| [utility-lambda](./utility-lambda/README.md) | v8 | Redeploys the container when configuration changes |
| [v8-custom-resource](./v8-custom-resource/README.md) | v8 | Deployment UUID and anonymous metrics |
| [image-handler](./image-handler/README.md) | v7 | Image processing Lambda |
| [custom-resource](./custom-resource/README.md) | v7 | Deployment-time checks and setup |
| [demo-ui](./demo-ui/README.md) | v7 | Static demo page |
| [metrics-utils](./metrics-utils/README.md) | both | CDK construct and Lambda for anonymous operational metrics |
| [solution-utils](./solution-utils/README.md) | both | Small helpers imported by the Lambda packages |
