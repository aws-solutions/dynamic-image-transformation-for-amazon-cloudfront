#!/bin/bash

# Dynamic Image Transformation for Amazon CloudFront - Deployment Script
# This script handles deployment to dev and prod AWS accounts

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONSTRUCTS_DIR="$SCRIPT_DIR/source/constructs"

# Default values
ENVIRONMENT="dev"
COMMAND="deploy"
CONFIRMED=false

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [ENVIRONMENT] [OPTIONS]

Commands:
    deploy      Deploy the stack (default)
    bootstrap   Bootstrap CDK in the target account
    diff        Show deployment differences
    destroy     Destroy the stack
    synth       Synthesize CloudFormation template

Environment:
    dev         Deploy to development account (AWS profile: lumberscan-dev) [default]
    prod        Deploy to production account (AWS profile: lumberscan-prod)

Options:
    --confirm   Required for prod deployments (and destroy commands)
    --help      Show this help message

Environment Variables (optional):
    SOURCE_BUCKETS              Comma-separated list of S3 bucket names
    DEPLOY_DEMO_UI              Yes/No - Deploy demo UI (default: No)
    ENABLE_S3_OBJECT_LAMBDA     Yes/No - Enable S3 Object Lambda (default: No)
    ENABLE_SIGNED_URLS          Yes/No - Enable CloudFront signed URLs (default: No)
    TRUSTED_KEY_GROUP_IDS       Comma-separated CloudFront key group IDs (required if ENABLE_SIGNED_URLS=Yes)
    CORS_ENABLED                Yes/No - Enable CORS for cross-origin requests (default: No)
    CORS_ORIGIN                 Allowed origin (* for any, or specific domain like https://example.com)

Examples:
    $0                               # Deploy to dev (default)
    $0 deploy dev                    # Deploy to dev (explicit)
    $0 deploy prod --confirm          # Deploy to prod (requires confirmation)
    $0 bootstrap dev                 # Bootstrap dev account
    $0 diff prod                     # Show diff for prod
    $0 destroy prod --confirm        # Destroy prod stack

You can also create .env.dev or .env.prod files with environment-specific variables.
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|bootstrap|diff|destroy|synth)
            COMMAND="$1"
            shift
            ;;
        dev|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        --confirm)
            CONFIRMED=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown argument: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set AWS profile based on environment
if [ "$ENVIRONMENT" = "dev" ]; then
    AWS_PROFILE="lumberscan-dev"
    ENV_FILE="$SCRIPT_DIR/.env.dev"
else
    AWS_PROFILE="lumberscan-prod"
    ENV_FILE="$SCRIPT_DIR/.env.prod"
fi

# Check for confirmation when deploying/destroying prod
if [ "$ENVIRONMENT" = "prod" ] && ([ "$COMMAND" = "deploy" ] || [ "$COMMAND" = "destroy" ]); then
    if [ "$CONFIRMED" = false ]; then
        print_error "Production $COMMAND requires --confirm flag"
        print_info "Run: $0 $COMMAND prod --confirm"
        exit 1
    fi
fi

# Load environment-specific variables if file exists
if [ -f "$ENV_FILE" ]; then
    print_info "Loading environment variables from $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
fi

# Print deployment information
echo ""
print_info "========================================="
print_info "CDK $COMMAND - $ENVIRONMENT environment"
print_info "AWS Profile: $AWS_PROFILE"
print_info "========================================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    print_error "AWS profile '$AWS_PROFILE' is not configured or credentials are invalid"
    exit 1
fi

# Print AWS account information
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
REGION=$(aws configure get region --profile "$AWS_PROFILE" || echo "us-east-1")
print_info "Account ID: $ACCOUNT_ID"
print_info "Region: $REGION"
echo ""

# Handle bootstrap command
if [ "$COMMAND" = "bootstrap" ]; then
    print_info "Bootstrapping CDK in $ENVIRONMENT environment..."
    cd "$CONSTRUCTS_DIR"
    overrideWarningsEnabled=false npx cdk bootstrap --profile "$AWS_PROFILE"
    print_success "Bootstrap completed successfully"
    exit 0
fi

# Handle synth command
if [ "$COMMAND" = "synth" ]; then
    print_info "Synthesizing CloudFormation template..."
    cd "$CONSTRUCTS_DIR"
    npm run cdk:synth -- --profile "$AWS_PROFILE"
    print_success "Synth completed successfully"
    exit 0
fi

# Build the project (for deploy, diff, destroy)
if [ "$COMMAND" = "deploy" ] || [ "$COMMAND" = "diff" ]; then
    print_info "Building project (this may take a few minutes)..."
    cd "$CONSTRUCTS_DIR"
    npm run clean:install
    print_success "Build completed"
    echo ""
fi

# Prepare CDK parameters
CDK_PARAMS=""

if [ -n "$SOURCE_BUCKETS" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters SourceBucketsParameter=$SOURCE_BUCKETS"
    print_info "Using SOURCE_BUCKETS: $SOURCE_BUCKETS"
fi

if [ -n "$DEPLOY_DEMO_UI" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters DeployDemoUIParameter=$DEPLOY_DEMO_UI"
    print_info "Using DEPLOY_DEMO_UI: $DEPLOY_DEMO_UI"
fi

if [ -n "$ENABLE_S3_OBJECT_LAMBDA" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters EnableS3ObjectLambdaParameter=$ENABLE_S3_OBJECT_LAMBDA"
    print_info "Using ENABLE_S3_OBJECT_LAMBDA: $ENABLE_S3_OBJECT_LAMBDA"
fi

if [ -n "$ENABLE_SIGNED_URLS" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters EnableSignedUrlsParameter=$ENABLE_SIGNED_URLS"
    print_info "Using ENABLE_SIGNED_URLS: $ENABLE_SIGNED_URLS"

    if [ "$ENABLE_SIGNED_URLS" = "Yes" ] && [ -z "$TRUSTED_KEY_GROUP_IDS" ]; then
        print_error "TRUSTED_KEY_GROUP_IDS is required when ENABLE_SIGNED_URLS is set to Yes"
        exit 1
    fi
fi

if [ -n "$TRUSTED_KEY_GROUP_IDS" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters TrustedKeyGroupIdsParameter=$TRUSTED_KEY_GROUP_IDS"
    print_info "Using TRUSTED_KEY_GROUP_IDS: $TRUSTED_KEY_GROUP_IDS"
fi

if [ -n "$CORS_ENABLED" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters CorsEnabledParameter=$CORS_ENABLED"
    print_info "Using CORS_ENABLED: $CORS_ENABLED"
fi

if [ -n "$CORS_ORIGIN" ]; then
    CDK_PARAMS="$CDK_PARAMS --parameters CorsOriginParameter=$CORS_ORIGIN"
    print_info "Using CORS_ORIGIN: $CORS_ORIGIN"
fi

echo ""

# Execute the CDK command
cd "$CONSTRUCTS_DIR"

case $COMMAND in
    deploy)
        print_info "Deploying to $ENVIRONMENT..."
        if [ "$ENVIRONMENT" = "prod" ]; then
            print_warning "Deploying to PRODUCTION account: $ACCOUNT_ID"
        fi
        overrideWarningsEnabled=false npx cdk deploy $CDK_PARAMS --profile "$AWS_PROFILE"
        print_success "Deployment completed successfully"
        ;;
    diff)
        print_info "Showing deployment differences for $ENVIRONMENT..."
        overrideWarningsEnabled=false npx cdk diff $CDK_PARAMS --profile "$AWS_PROFILE"
        ;;
    destroy)
        print_warning "Destroying stack in $ENVIRONMENT environment..."
        if [ "$ENVIRONMENT" = "prod" ]; then
            print_warning "DESTROYING PRODUCTION STACK in account: $ACCOUNT_ID"
        fi
        overrideWarningsEnabled=false npx cdk destroy --profile "$AWS_PROFILE" --force
        print_success "Stack destroyed"
        ;;
esac

echo ""
print_success "Command '$COMMAND' completed successfully for $ENVIRONMENT environment"
