# Deployment Guide

This guide covers how to deploy the Dynamic Image Transformation for Amazon CloudFront solution to your AWS accounts using the provided deployment script.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Script Commands](#script-commands)
- [Environment Configuration](#environment-configuration)
- [Configuration Parameters](#configuration-parameters)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

1. **Node.js 20.x or later** installed
2. **AWS CLI** configured with appropriate credentials
3. **AWS profiles** configured:
   - `lumberscan-dev`: For dev account
   - `lumberscan-prod`: For prod account
4. **Appropriate AWS permissions** to deploy CDK stacks (CloudFormation, Lambda, S3, CloudFront, etc.)

### Setting up AWS Profiles

Configure your AWS profiles if not already done:

```bash
# Configure dev profile
aws configure --profile lumberscan-dev

# Configure prod profile
aws configure --profile lumberscan-prod
```

## Quick Start

### 1. Make the script executable (first time only)

```bash
chmod +x deploy.sh
```

### 2. Bootstrap your AWS accounts (first time only)

```bash
# Bootstrap dev account
./deploy.sh bootstrap dev

# Bootstrap prod account
./deploy.sh bootstrap prod
```

### 3. Deploy to dev (default)

```bash
# Deploy to dev (default environment)
./deploy.sh

# Or explicitly specify dev
./deploy.sh deploy dev
```

### 4. Deploy to prod (requires confirmation)

```bash
./deploy.sh deploy prod --confirm
```

## Script Commands

The deployment script supports the following commands:

### deploy (default)

Deploys the CDK stack to the specified environment.

```bash
./deploy.sh deploy [dev|prod] [--confirm]
```

- Runs `npm run clean:install` to build the project
- Deploys the CloudFormation stack
- **Requires `--confirm` flag for prod deployments**

### bootstrap

Bootstraps CDK in the target AWS account. This is required once per account/region before the first deployment.

```bash
./deploy.sh bootstrap [dev|prod]
```

### diff

Shows what changes would be made to the deployed stack without actually deploying.

```bash
./deploy.sh diff [dev|prod]
```

Useful for:
- Reviewing changes before deployment
- Understanding infrastructure changes
- Verifying configuration

### destroy

Removes the deployed stack from AWS.

```bash
./deploy.sh destroy [dev|prod] --confirm
```

- **Requires `--confirm` flag for prod environment**
- Permanently deletes all resources
- Use with caution!

### synth

Synthesizes the CloudFormation template without deploying.

```bash
./deploy.sh synth [dev|prod]
```

Useful for:
- Reviewing generated CloudFormation templates
- Debugging CDK code
- Integration with CI/CD pipelines

## Environment Configuration

The script supports two methods for configuration:

### Method 1: Environment Files (Recommended)

Create environment-specific configuration files:

```bash
# Create dev config
cp .env.example .env.dev
# Edit .env.dev with your dev values

# Create prod config
cp .env.example .env.prod
# Edit .env.prod with your prod values
```

Example `.env.prod`:
```bash
SOURCE_BUCKETS=my-prod-images,my-prod-assets
DEPLOY_DEMO_UI=No
ENABLE_S3_OBJECT_LAMBDA=No
```

Example `.env.dev`:
```bash
SOURCE_BUCKETS=my-dev-images
DEPLOY_DEMO_UI=Yes
ENABLE_S3_OBJECT_LAMBDA=No
```

### Method 2: Environment Variables

Pass variables directly when running the script:

```bash
SOURCE_BUCKETS="my-bucket" DEPLOY_DEMO_UI="Yes" ./deploy.sh deploy dev
```

## Configuration Parameters

### SOURCE_BUCKETS

**Required for most deployments**

Comma-separated list of S3 bucket names that the solution can access for image transformation.

- **Type**: String (comma-separated)
- **Example**: `my-images-bucket,my-other-bucket`
- **Default**: None

```bash
SOURCE_BUCKETS=bucket1,bucket2,bucket3
```

### DEPLOY_DEMO_UI

Whether to deploy the demo UI for testing the solution.

- **Type**: Yes/No
- **Options**: `Yes`, `No`
- **Default**: `No`
- **Recommendation**:
  - `Yes` for dev environments
  - `No` for production environments

```bash
DEPLOY_DEMO_UI=Yes
```

### ENABLE_S3_OBJECT_LAMBDA

**⚠️ DEPRECATED** - Enable S3 Object Lambda architecture.

- **Type**: Yes/No
- **Options**: `Yes`, `No`
- **Default**: `No`
- **Important**: This architecture has been deprecated. Only use if you were an existing user before November 7, 2025.

```bash
ENABLE_S3_OBJECT_LAMBDA=No
```

## Usage Examples

### Basic Deployment

```bash
# Deploy to dev with demo UI
echo "SOURCE_BUCKETS=my-dev-bucket
DEPLOY_DEMO_UI=Yes" > .env.dev
./deploy.sh deploy dev

# Deploy to prod without demo UI
echo "SOURCE_BUCKETS=my-prod-bucket
DEPLOY_DEMO_UI=No" > .env.prod
./deploy.sh deploy prod --confirm
```

### Using Inline Environment Variables

```bash
# Deploy to dev with specific configuration
SOURCE_BUCKETS="bucket1,bucket2" \
DEPLOY_DEMO_UI="Yes" \
./deploy.sh deploy dev

# Deploy to prod
SOURCE_BUCKETS="prod-bucket" \
DEPLOY_DEMO_UI="No" \
./deploy.sh deploy prod --confirm
```

### Preview Changes Before Deployment

```bash
# See what will change in prod
./deploy.sh diff prod

# Review, then deploy if satisfied
./deploy.sh deploy prod --confirm
```

### Update Existing Deployment

```bash
# Make changes to your code, then redeploy
./deploy.sh deploy dev

# Or for prod
./deploy.sh deploy prod --confirm
```

### Complete Workflow Example

```bash
# 1. First time setup - bootstrap accounts
./deploy.sh bootstrap dev
./deploy.sh bootstrap prod

# 2. Configure dev environment
cat > .env.dev << EOF
SOURCE_BUCKETS=my-dev-images
DEPLOY_DEMO_UI=Yes
EOF

# 3. Deploy to dev and test
./deploy.sh deploy dev

# 4. Configure prod environment
cat > .env.prod << EOF
SOURCE_BUCKETS=my-prod-images-1,my-prod-images-2
DEPLOY_DEMO_UI=No
EOF

# 5. Preview prod changes
./deploy.sh diff prod

# 6. Deploy to prod
./deploy.sh deploy prod --confirm
```

### CI/CD Integration

```bash
# In your CI/CD pipeline
export SOURCE_BUCKETS="${PROD_BUCKETS}"
export DEPLOY_DEMO_UI="No"

# Synthesize and validate
./deploy.sh synth prod

# Deploy with confirmation
./deploy.sh deploy prod --confirm
```

### Cleanup

```bash
# Remove dev stack
./deploy.sh destroy dev

# Remove prod stack (requires confirmation)
./deploy.sh destroy prod --confirm
```

## Script Options Reference

### Command Line Options

| Option | Description | Required For |
|--------|-------------|--------------|
| `--confirm` | Confirms destructive operations | prod deploy, any destroy |
| `--help`, `-h` | Shows help message | - |

### Positional Arguments

| Position | Options | Default | Description |
|----------|---------|---------|-------------|
| 1st | `deploy`, `bootstrap`, `diff`, `destroy`, `synth` | `deploy` | Command to execute |
| 2nd | `dev`, `prod` | `dev` | Target environment |

### Environment Mapping

| Environment | AWS Profile | Config File |
|-------------|-------------|-------------|
| `dev` | `lumberscan-dev` | `.env.dev` |
| `prod` | `lumberscan-prod` | `.env.prod` |

## Troubleshooting

### Error: "Production deploy requires --confirm flag"

**Solution**: Add `--confirm` flag when deploying to prod:
```bash
./deploy.sh deploy prod --confirm
```

### Error: "AWS profile 'lumberscan-prod' is not configured"

**Solution**: Configure the prod AWS profile:
```bash
aws configure --profile lumberscan-prod
```

### Error: "This stack uses assets, so the toolkit stack must be deployed"

**Solution**: Bootstrap the account first:
```bash
./deploy.sh bootstrap prod
```

### Build Errors

If you encounter npm or build errors:

```bash
# Clean and rebuild manually
cd source/constructs
rm -rf node_modules cdk.out
npm ci
cd ../..

# Then try deploying again
./deploy.sh deploy dev
```

### Permission Errors

Ensure your AWS credentials have the following permissions:
- CloudFormation (full access)
- Lambda (create, update, delete functions)
- S3 (create, configure buckets)
- CloudFront (create, update distributions)
- API Gateway (create, configure APIs)
- IAM (create roles and policies)
- CloudWatch Logs (create log groups)

### Stack Already Exists

If you need to update an existing stack:
```bash
# The deploy command will update the existing stack
./deploy.sh deploy prod --confirm
```

If you need to completely redeploy:
```bash
# Destroy the existing stack
./deploy.sh destroy prod --confirm

# Redeploy
./deploy.sh deploy prod --confirm
```

## Advanced Usage

### Custom AWS Region

The script uses the region configured in your AWS profile. To use a different region:

```bash
aws configure set region us-west-2 --profile lumberscan-prod
./deploy.sh deploy prod --confirm
```

### Using Different Profile Names

The script is configured to use `lumberscan-dev` and `lumberscan-prod` profiles. If you need to use different profile names, edit the script:

```bash
# In deploy.sh, modify these lines:
if [ "$ENVIRONMENT" = "dev" ]; then
    AWS_PROFILE="lumberscan-dev"  # Change to your-dev-profile-name
else
    AWS_PROFILE="lumberscan-prod"  # Change to your-prod-profile-name
fi
```

### Deploying to Additional Environments

To add a staging environment:

1. Add a new AWS profile:
```bash
aws configure --profile lumberscan-staging
```

2. Create `.env.staging` file:
```bash
SOURCE_BUCKETS=staging-bucket
DEPLOY_DEMO_UI=No
```

3. Modify the script to recognize `staging` as a valid environment (update the case statement and profile mapping)

## Getting Help

- Script help: `./deploy.sh --help`
- CDK help: `cd source/constructs && npx cdk --help`
- AWS Solutions: https://aws.amazon.com/solutions/implementations/dynamic-image-transformation-for-amazon-cloudfront/

## Security Best Practices

1. **Never commit `.env.dev` or `.env.prod` files** to version control
2. **Use AWS IAM roles** with minimum required permissions
3. **Enable MFA** for production AWS accounts
4. **Review diffs** before deploying to production
5. **Test thoroughly** in dev before promoting to prod
6. **Use separate AWS accounts** for dev and prod when possible
7. **Audit CloudTrail logs** regularly
8. **Rotate credentials** periodically
