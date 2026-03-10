#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./bw_init_avif_cache.sh --stack_name <STACK_NAME> [--profile <PROFILE>]

Creates the S3 bucket used to cache AVIF images, with a 90-day expiration lifecycle.
The bucket name is derived from the stack name: <stack_name_lowercased>-avif-cache

Example:
  ./bw_init_avif_cache.sh --stack_name ServerlessImageHandler-bw-staging
  # Creates bucket: serverlessimagehandler-bw-staging-avif-cache

Options:
  --stack_name   CloudFormation stack name (required)
  --profile      AWS CLI named profile (optional)
EOF
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack_name) STACK_NAME="$2"; shift ;;
    --profile)    PROFILE="$2"; shift ;;
    -h|--help)    usage ;;
    *)            echo "Unknown option: $1"; echo ""; usage ;;
  esac
  shift
done

if [ -z "${STACK_NAME:-}" ]; then
  echo "Missing required parameter: --stack_name"
  echo ""
  usage
fi

AWS_ARGS=""
[ -n "${PROFILE:-}" ] && AWS_ARGS="--profile $PROFILE"

BUCKET_NAME=$(echo "${STACK_NAME}-avif-cache" | tr '[:upper:]' '[:lower:]')

echo "Creating AVIF cache bucket: $BUCKET_NAME"

REGION=$(aws configure get region $AWS_ARGS 2>/dev/null || echo "us-east-1")

if aws s3api head-bucket --bucket "$BUCKET_NAME" $AWS_ARGS >/dev/null 2>&1; then
  echo "  Bucket already exists, skipping creation."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" $AWS_ARGS
  else
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" $AWS_ARGS
  fi
  echo "  Bucket created."
fi

echo "Setting 90-day expiration lifecycle..."
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET_NAME" $AWS_ARGS \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "ExpireAfter90Days",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": { "Days": 90 }
    }]
  }' > /dev/null
echo "  Lifecycle configured."

echo ""
echo "Done. Use this in your deploy command:"
echo "  --avif_cache_bucket $BUCKET_NAME"
