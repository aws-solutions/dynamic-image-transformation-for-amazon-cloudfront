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
    echo "--stack_name is required for discovery!"
    exit 1
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
    else
      echo "  WARNING: No EFS access point found for $EFS_FS_ID"
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
  echo "  AVIF Cache Bucket: ${DISC_AVIF:-(not found)}"

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

  echo ""
  echo "=== Deploy Command ==="
  echo ""

  # Build command parts, then print with line continuations
  PARTS=()
  PARTS+=("./bw_deploy.sh")
  PARTS+=("  --stack_name $STACK_NAME")
  [ -n "$DISC_SOURCE" ] && PARTS+=("  --source_buckets \"$DISC_SOURCE\"")
  [ -n "$DISC_AVIF" ] && PARTS+=("  --avif_cache_bucket $DISC_AVIF")
  [ -n "$DISC_SUBNETS" ] && PARTS+=("  --vpc_subnet_ids \"$DISC_SUBNETS\"")
  [ -n "$DISC_SGS" ] && PARTS+=("  --security_group_ids \"$DISC_SGS\"")
  [ -n "$DISC_EFS_ARN" ] && PARTS+=("  --efs_access_point_arn \"$DISC_EFS_ARN\"")
  [ -n "${PROFILE+x}" ] && PARTS+=("  --profile $PROFILE")

  LAST_IDX=$((${#PARTS[@]} - 1))
  for i in "${!PARTS[@]}"; do
    if [ "$i" -lt "$LAST_IDX" ]; then
      echo "${PARTS[$i]} \\"
    else
      echo "${PARTS[$i]}"
    fi
  done

  exit 0
fi

##
## Deploy mode
##
if [ -z ${STACK_NAME+x} ]; then
  echo "--stack_name parameter is required!"
  exit 1
fi
if [ -z ${SOURCE_BUCKETS+x} ]; then
  echo "--source_buckets parameter is required!"
  exit 1
fi
if [ -z ${AVIF_CACHE_BUCKET+x} ]; then
  echo "--avif_cache_bucket parameter is required!"
  exit 1
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
