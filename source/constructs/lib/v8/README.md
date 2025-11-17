# Dynamic Image Transformation (DIT) v8

## Directory Structure

```
v8/
├── constructs/                        # DIT L3 CDK constructs
│   ├── common/                        # Common utilities
│   │   ├── constants.ts               # Shared constants (Lambda runtime, memory, timeout)
│   │   ├── lambda.ts                  # Lambda utility functions
│   │   └── index.ts                   # Common exports
│   ├── dal/                           # Data Access Layer
│   │   ├── dal-construct.ts           # API Gateway + Lambda + DynamoDB
│   │   ├── single-table-construct.ts  # DynamoDB single-table design
│   │   ├── open-api-spec.yaml         # API specification
│   │   └── index.ts                   # DAL exports
│   ├── frontend/                      # Frontend infrastructure
│   │   ├── auth-construct.ts          # Cognito User Pool for auth
│   │   ├── ui-construct.ts            # CloudFront distribution with S3 bucket for frontend assets
│   │   └── index.ts                   # Frontend exports
│   └── processor/                     # Image processing infrastructure
│       ├── alb-ecs-construct.ts       # Application Load Balancer + ECS Fargate service
│       ├── container-construct.ts     # ECR repository and Docker image management
│       ├── network-construct.ts       # VPC, subnets, and security groups
│       └── index.ts                   # Processor exports
├── stacks/                            # CDK stack definitions
│   ├── image-processing-stack.ts      # Provisions ECS-based image processing infrastructure
│   ├── management-stack.ts            # DIT portal management stack
│   └── index.ts                       # Stack exports
├── test/                              # Jest tests and snapshots
│   ├── __snapshots__/                 # Jest snapshot files
│   │   ├── image-processing-stack.test.ts.snap
│   │   └── management-stack.test.ts.snap
│   ├── e2e.test.ts                    # End-to-end integration tests
│   ├── image-processing-stack.test.ts # Image processing stack unit tests
│   └── management-stack.test.ts       # Management stack unit tests
└── README.md                          # This documentation file
```

## Architecture Overview

### Management Stack

Primary stack provisioning infrastructure for the v8 management portal with three main layers:

**Frontend Layer**

- CloudFront distribution for global content delivery
- S3 bucket for static web assets (TODO: frontend deployment automation)
- Cognito User Pool for admin authentication

**Data Access Layer (DAL)**

- API Gateway with OpenAPI specification
- Microservice backed by Lambda functions
- DynamoDB single-table design for configuration storage

**Common Components**

- Shared constants and utilities
- Baseline Lambda function (Node.js 20.x, 512MB, 30s timeout)

#### Key Outputs

- `WebPortalUrl`: Admin web portal endpoint
- `APIEndpoint`: Backend API base URL

#### Parameters

- `AdminEmail`: Email address for initial admin user creation

### Image Processing Stack

ECS-based stack for high-performance image processing with the following architecture:

**Network Layer**

- VPC with configurable CIDR block (/16 to /24 prefix)
- 3 public subnets across different availability zones
- Internet Gateway for ECS tasks to download container images
- Security groups for ALB and ECS with appropriate ingress/egress rules

**Container Layer**

- ECR repository for Docker image storage
- Docker image asset management with multi-platform support
- IAM roles for ECS task execution and runtime permissions
- Automatic image building and deployment

**Compute Layer**

- Application Load Balancer (ALB) with HTTP support (TLS termination at CloudFront)
- ECS Fargate service with auto-scaling capabilities
- Health check endpoint at `/health-check`
- T-shirt sizing configurations (Small, Medium, Large, XLarge)

#### Key Outputs

- `VpcId`: VPC ID for the image processing infrastructure
- `ContainerDeploymentMode`: Container deployment mode (local or production)
- `ImageUri`: Container image URI used by ECS tasks
- `LoadBalancerDNS`: DNS name of the Application Load Balancer

#### Parameters

- `AdminEmail`: Email address for the admin user
- `DeploymentSize`: T-shirt sizing for ECS Fargate deployment (Small/Medium/Large/XLarge)
- `OriginOverrideHeader`: HTTP header used to override the image origin (if present in request, mapping lookup is skipped)

#### T-shirt Sizing Configurations

- **Small**: 1 vCPU, 2GB RAM, 2 desired tasks (1-4 range)
- **Medium**: 2 vCPU, 4GB RAM, 3 desired tasks (2-8 range)
- **Large**: 2 vCPU, 4GB RAM, 8 desired tasks (6-20 range)
- **XLarge**: 2 vCPU, 4GB RAM, 30 desired tasks (24-96 range)

## Unit Tests

```bash
# Test management stack
npx jest test/management-stack.test.ts

npx jest test/image-processing-stack.test.ts
```

## Deploy

Docker engine needs to be installed locally to build ecr image

```bash
cd source/constructs

aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

# Management stack (deployment time ~15 mins)
overrideWarningsEnabled=false npx cdk deploy v8-Stack --parameters AdminEmail="myEmail"
```

## End-to-end test

ℹ️ **Pre-requisite** - aws credentials configured in local environment // TODO add details on configuring local environment

These tests validate local deployment, ensure to run them after deploying above stacks

```bash
STACK_REGION={myRegion} STACK_NAME={myStack} TEST_TYPE=e2e npx jest e2e.test.ts
```
