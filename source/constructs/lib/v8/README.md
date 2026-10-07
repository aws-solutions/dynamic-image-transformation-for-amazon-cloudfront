# Dynamic Image Transformation (DIT) v8

The CDK code for the v8 architecture: an ECS Fargate image service behind CloudFront, plus the admin portal that configures it.

## Components

| Folder | What it builds |
|--------|----------------|
| [stacks/](./stacks/) | `management-stack.ts` is the top-level `v8-Stack`. `image-processing-stack.ts` is nested inside it |
| [constructs/frontend/](./constructs/frontend/) | Admin UI: S3 bucket and CloudFront distribution, the Cognito user pool, and a custom resource that sets the UI's Content-Security-Policy |
| [constructs/dal/](./constructs/dal/) | Management API: API Gateway built from `open-api-spec.yaml`, the [management Lambda](../../../management-lambda/README.md), and the DynamoDB config table |
| [constructs/processor/](./constructs/processor/) | Image service: VPC, the container image, and the ALB with the ECS Fargate service |
| [constructs/common/](./constructs/common/) | Shared Lambda defaults and the [utility Lambda](../../../utility-lambda/README.md) that redeploys ECS when config changes |
| [constructs/metrics/](./constructs/metrics/) | Anonymous metrics custom resource ([v8-custom-resource](../../../v8-custom-resource/README.md)) |
| [functions/](./functions/) | CloudFront Functions source |
| [test/](./test/) | Unit, snapshot and end-to-end tests |

## Architecture

The management stack serves the admin UI from S3 through CloudFront, signs users in with Cognito, and stores origins, mappings and policies through the management API.

The image processing stack runs the [container](../../../container/README.md) on ECS Fargate behind an Application Load Balancer. CloudFront terminates TLS and forwards to the ALB over HTTP. The VPC's CIDR block comes from the `vpcCidr` CDK context (see [constructs](../../README.md#configuration)). It has public and isolated subnets across three availability zones, and the ALB sits in the isolated subnets. The ALB health check is `/health`.

## Parameters

| Parameter | What it does |
|-----------|--------------|
| `AdminEmail` | Email address of the first admin user |
| `DeploymentSize` | ECS sizing: `small` (default), `medium`, `large`, or `xlarge` |
| `OriginOverrideHeader` | Request header that names an origin directly, skipping mapping lookup. Must be empty or start with `dit-` |
| `CorsOriginParameter` | Origin allowed to request images cross-origin. Empty allows any origin |

The image processing stack receives `DeploymentSize`, `OriginOverrideHeader` and `CorsOriginParameter` from the management stack.

| Size | Per task | Desired tasks | Scaling range |
|------|----------|---------------|---------------|
| `small` | 1 vCPU, 2 GB | 2 | 1-4 |
| `medium` | 2 vCPU, 4 GB | 3 | 2-8 |
| `large` | 2 vCPU, 4 GB | 8 | 6-20 |
| `xlarge` | 2 vCPU, 4 GB | 30 | 24-96 |

The management stack outputs `WebPortalUrl` (the admin UI) and `APIEndpoint` (the management API). The image processing stack's outputs include `LoadBalancerDNS` and `ImageUri`.

## Unit tests

```bash
cd source/constructs
overrideWarningsEnabled=false npx jest lib/v8/test/snapshot/management-stack.test.ts
overrideWarningsEnabled=false npx jest lib/v8/test/snapshot/image-processing-stack.test.ts
```

## Deploy

Docker must be running locally to build the container image.

```bash
cd source/constructs
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
overrideWarningsEnabled=false npx cdk deploy v8-Stack --parameters AdminEmail="myEmail"
```

## End-to-end test

Run this after deploying, with AWS credentials for the stack's account and region available to the AWS SDK (for example through `AWS_PROFILE`).

```bash
STACK_REGION={myRegion} STACK_NAME={myStack} TEST_TYPE=e2e npx jest e2e.test.ts
```
