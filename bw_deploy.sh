usage() {
  cat <<'EOF'
Usage: ./bw_deploy.sh [OPTIONS]

Deploy mode (runs CDK deploy):
  ./bw_deploy.sh \
    --stack_name ServerlessImageHandler-bw-staging \
    --source_buckets "bwpaperclip-bwstaging" \
    --avif_cache_bucket serverlessimagehandler-bw-staging-avif-cache \
    --vpc_subnet_ids "subnet-abc123" \
    --security_group_ids "sg-abc123" \
    --efs_access_point_arn "arn:aws:elasticfilesystem:us-east-1:123456789:access-point/fsap-abc123" \
    --profile bw

Discovery mode (prints a ready-to-run deploy command from existing infra):
  ./bw_deploy.sh --eb_stack bwstaging-docker --stack_name ServerlessImageHandler-bw-staging

Required parameters:
  --stack_name            CloudFormation stack name (e.g. ServerlessImageHandler-bw-staging)
  --source_buckets        Comma-separated S3 buckets with original images
  --avif_cache_bucket     S3 bucket for AVIF cache (must exist before deploy)

Optional parameters:
  --vpc_subnet_ids        Comma-separated private subnet IDs (required for EFS)
  --security_group_ids    Comma-separated security group IDs (must allow NFS port 2049)
  --efs_access_point_arn  EFS access point ARN to mount at /mnt/bw_images
  --profile               AWS CLI named profile (defaults to env vars)
  --eb_stack              EB environment name for discovery mode (requires --stack_name)
EOF
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

while [[ $# -gt 0 ]] ; do
    key="$1"
    case $key in
        --stack_name)
            STACK_NAME="$2"
            shift
            ;;
        --profile)
            PROFILE="$2"
            shift
            ;;
        --source_buckets)
            SOURCE_BUCKETS="$2"
            shift
            ;;
        --avif_cache_bucket)
            AVIF_CACHE_BUCKET="$2"
            shift
            ;;
        --vpc_subnet_ids)
            VPC_SUBNET_IDS="$2"
            shift
            ;;
        --security_group_ids)
            SECURITY_GROUP_IDS="$2"
            shift
            ;;
        --efs_access_point_arn)
            EFS_ACCESS_POINT_ARN="$2"
            shift
            ;;
        --eb_stack)
            EB_STACK="$2"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            echo ""
            usage
            ;;
    esac
    shift
done

AWS_ARGS=""
if [ -n "${PROFILE+x}" ]; then
  AWS_ARGS="--profile $PROFILE"
fi

##
## Discovery mode: --eb_stack looks up VPC/EFS/bucket config and prints a deploy command
##
if [ -n "${EB_STACK+x}" ]; then
  if [ -z "${STACK_NAME+x}" ]; then
    echo "Discovery mode requires --stack_name"
    echo ""
    usage
  fi

  echo "=== Discovering configuration ==="
  echo ""

  # --- EB Environment ---
  echo "EB Environment: $EB_STACK"

  APP_NAME=$(aws elasticbeanstalk describe-environments \
    --environment-names "$EB_STACK" $AWS_ARGS \
    --query 'Environments[0].ApplicationName' --output text 2>/dev/null)
  if [ -z "$APP_NAME" ] || [ "$APP_NAME" = "None" ]; then
    echo "  ERROR: EB environment not found"
    exit 1
  fi
  echo "  Application: $APP_NAME"

  EFS_FS_ID=$(aws elasticbeanstalk describe-configuration-settings \
    --application-name "$APP_NAME" --environment-name "$EB_STACK" $AWS_ARGS \
    --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment' && OptionName=='EFS_FILE_SYSTEM_ID'].Value | [0]" \
    --output text 2>/dev/null)
  [ "$EFS_FS_ID" = "None" ] && EFS_FS_ID=""

  DISC_EFS_ARN=""
  if [ -n "$EFS_FS_ID" ]; then
    echo "  EFS File System ID: $EFS_FS_ID"

    DISC_EFS_ARN=$(aws efs describe-access-points \
      --file-system-id "$EFS_FS_ID" $AWS_ARGS \
      --query 'AccessPoints[0].AccessPointArn' --output text 2>/dev/null)
    [ "$DISC_EFS_ARN" = "None" ] && DISC_EFS_ARN=""

    if [ -n "$DISC_EFS_ARN" ]; then
      echo "  EFS Access Point ARN: $DISC_EFS_ARN"
    fi
  else
    echo "  EFS: not configured"
  fi

  echo ""

  # --- Serverless Stack ---
  echo "Serverless Stack: $STACK_NAME"

  DISC_SOURCE=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" $AWS_ARGS \
    --query "Stacks[0].Parameters[?ParameterKey=='SourceBucketsParameter'].ParameterValue | [0]" \
    --output text 2>/dev/null)
  [ "$DISC_SOURCE" = "None" ] && DISC_SOURCE=""
  echo "  Source Buckets: ${DISC_SOURCE:-(not found)}"

  DISC_AVIF=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" $AWS_ARGS \
    --query "Stacks[0].Parameters[?ParameterKey=='AvifCacheBucketParameter'].ParameterValue | [0]" \
    --output text 2>/dev/null)
  [ "$DISC_AVIF" = "None" ] && DISC_AVIF=""

  # If not found in stack params, try the conventional bucket name
  if [ -z "$DISC_AVIF" ]; then
    CONV_BUCKET=$(echo "${STACK_NAME}-avif-cache" | tr '[:upper:]' '[:lower:]')
    if aws s3api head-bucket --bucket "$CONV_BUCKET" $AWS_ARGS >/dev/null 2>&1; then
      DISC_AVIF="$CONV_BUCKET"
    fi
  fi

  AVIF_BUCKET_EXISTS=true
  if [ -n "$DISC_AVIF" ]; then
    if ! aws s3api head-bucket --bucket "$DISC_AVIF" $AWS_ARGS >/dev/null 2>&1; then
      AVIF_BUCKET_EXISTS=false
      echo "  AVIF Cache Bucket: $DISC_AVIF (NOT FOUND — bucket does not exist)"
    else
      echo "  AVIF Cache Bucket: $DISC_AVIF"
    fi
  else
    AVIF_BUCKET_EXISTS=false
    echo "  AVIF Cache Bucket: (not found)"
  fi

  # Find the ImageHandler Lambda in the stack
  LAMBDA_FUNC=$(aws cloudformation describe-stack-resources \
    --stack-name "$STACK_NAME" $AWS_ARGS \
    --query "StackResources[?ResourceType=='AWS::Lambda::Function'] | [?contains(LogicalResourceId, 'ImageHandlerLambdaFunction')].PhysicalResourceId | [0]" \
    --output text 2>/dev/null)
  [ "$LAMBDA_FUNC" = "None" ] && LAMBDA_FUNC=""

  DISC_SUBNETS=""
  DISC_SGS=""

  if [ -n "$LAMBDA_FUNC" ]; then
    echo "  Lambda: $LAMBDA_FUNC"

    DISC_SUBNETS=$(aws lambda get-function-configuration \
      --function-name "$LAMBDA_FUNC" $AWS_ARGS \
      --query 'VpcConfig.SubnetIds[]' --output text 2>/dev/null | tr '\t' ',')
    [ "$DISC_SUBNETS" = "None" ] && DISC_SUBNETS=""

    DISC_SGS=$(aws lambda get-function-configuration \
      --function-name "$LAMBDA_FUNC" $AWS_ARGS \
      --query 'VpcConfig.SecurityGroupIds[]' --output text 2>/dev/null | tr '\t' ',')
    [ "$DISC_SGS" = "None" ] && DISC_SGS=""

    if [ -n "$DISC_SUBNETS" ]; then
      echo "  VPC Subnet IDs: $DISC_SUBNETS"
      echo "  Security Group IDs: $DISC_SGS"
    else
      echo "  VPC: not configured on Lambda"
    fi

    # Fallback: get EFS ARN from Lambda config if not found via EB env vars
    if [ -z "$DISC_EFS_ARN" ]; then
      LAMBDA_EFS=$(aws lambda get-function-configuration \
        --function-name "$LAMBDA_FUNC" $AWS_ARGS \
        --query 'FileSystemConfigs[0].Arn' --output text 2>/dev/null)
      [ "$LAMBDA_EFS" = "None" ] && LAMBDA_EFS=""
      if [ -n "$LAMBDA_EFS" ]; then
        DISC_EFS_ARN="$LAMBDA_EFS"
        echo "  EFS Access Point ARN (from Lambda): $DISC_EFS_ARN"
      fi
    fi
  else
    echo "  WARNING: Lambda function not found in stack"
  fi

  if [ -n "$EFS_FS_ID" ] && [ -z "$DISC_EFS_ARN" ]; then
    echo "  WARNING: EFS file system $EFS_FS_ID found but no access point discovered."
    echo "           Create one for Lambda access (see README)."
  fi

  echo ""
  echo "=== Deploy Command ==="
  echo ""

  # Build command parts, then print with line continuations
  PARTS=()
  PARTS+=("./bw_deploy.sh")
  PARTS+=("  --stack_name $STACK_NAME")
  PARTS+=("  --source_buckets \"${DISC_SOURCE:-[SOURCE_BUCKETS]}\"")
  AVIF_BUCKET_DEFAULT=$(echo "${STACK_NAME}-avif-cache" | tr '[:upper:]' '[:lower:]')
  PARTS+=("  --avif_cache_bucket ${DISC_AVIF:-$AVIF_BUCKET_DEFAULT}")
  PARTS+=("  --vpc_subnet_ids \"${DISC_SUBNETS:-[VPC_SUBNET_IDS]}\"")
  PARTS+=("  --security_group_ids \"${DISC_SGS:-[SECURITY_GROUP_IDS]}\"")
  PARTS+=("  --efs_access_point_arn \"${DISC_EFS_ARN:-[EFS_ACCESS_POINT_ARN]}\"")
  [ -n "${PROFILE+x}" ] && PARTS+=("  --profile $PROFILE")

  LAST_IDX=$((${#PARTS[@]} - 1))
  for i in "${!PARTS[@]}"; do
    if [ "$i" -lt "$LAST_IDX" ]; then
      echo "${PARTS[$i]} \\"
    else
      echo "${PARTS[$i]}"
    fi
  done

  if [ "$AVIF_BUCKET_EXISTS" = false ]; then
    echo ""
    echo "=== AVIF Cache Bucket Missing ==="
    echo ""
    echo "Create it first with:"
    INIT_CMD="./bw_init_avif_cache.sh --stack_name $STACK_NAME"
    [ -n "${PROFILE+x}" ] && INIT_CMD="$INIT_CMD --profile $PROFILE"
    echo "  $INIT_CMD"
  fi

  exit 0
fi

##
## Deploy mode
##
MISSING=()
[ -z "${STACK_NAME+x}" ] && MISSING+=("--stack_name")
[ -z "${SOURCE_BUCKETS+x}" ] && MISSING+=("--source_buckets")
[ -z "${AVIF_CACHE_BUCKET+x}" ] && MISSING+=("--avif_cache_bucket")
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Missing required parameters: ${MISSING[*]}"
  echo ""
  usage
fi

# VPC/EFS params are optional — CDK condition handles empty values
VPC_PARAMS=""
[ -n "${VPC_SUBNET_IDS:-}" ] && VPC_PARAMS="$VPC_PARAMS --parameters VpcSubnetIdsParameter=$VPC_SUBNET_IDS"
[ -n "${SECURITY_GROUP_IDS:-}" ] && VPC_PARAMS="$VPC_PARAMS --parameters VpcSecurityGroupIdsParameter=$SECURITY_GROUP_IDS"
[ -n "${EFS_ACCESS_POINT_ARN:-}" ] && VPC_PARAMS="$VPC_PARAMS --parameters EfsAccessPointArnParameter=$EFS_ACCESS_POINT_ARN"

cd ./source/constructs

STACK_NAME=$STACK_NAME overrideWarningsEnabled=false npx cdk deploy\
  --parameters DeployDemoUIParameter=No\
  --parameters SourceBucketsParameter=$SOURCE_BUCKETS\
  --parameters AvifCacheBucketParameter=$AVIF_CACHE_BUCKET\
  --parameters CorsEnabledParameter=Yes\
  --parameters EnableSignatureParameter=Yes\
  --parameters SecretsManagerSecretParameter=Secret_for_CDN_image_requests\
  --parameters SecretsManagerKeyParameter=secret\
  $VPC_PARAMS\
  $(if [ -z ${PROFILE+x} ]; then echo ""; else echo "--profile ${PROFILE}"; fi)
