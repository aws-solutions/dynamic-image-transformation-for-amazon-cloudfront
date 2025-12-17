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
    esac
    shift
done

if [ -z ${STACK_NAME+x} ]; then
  echo "--stack_name parameter is required!"
  exit 1
fi
if [ -z ${SOURCE_BUCKETS+x} ]; then
  echo "--source_buckets parameter is required!"
  exit 1
fi

cd ./source/constructs

# Clean CDK output to force fresh bundling
rm -rf cdk.out

STACK_NAME=$STACK_NAME overrideWarningsEnabled=false npx cdk deploy\
  --parameters DeployDemoUIParameter=No\
  --parameters SourceBucketsParameter=$SOURCE_BUCKETS\
  --parameters CorsEnabledParameter=Yes\
  --parameters EnableSignatureParameter=Yes\
  --parameters SecretsManagerSecretParameter=Secret_for_CDN_image_requests\
  --parameters SecretsManagerKeyParameter=secret\
  $(if [ -z ${PROFILE+x} ]; then echo ""; else echo "--profile ${PROFILE}"; fi)