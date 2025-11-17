#!/bin/bash
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

[ "$DEBUG" == 'true' ] && set -x
set -e

function headline(){
  echo "------------------------------------------------------------------------------"
  echo "$1"
  echo "------------------------------------------------------------------------------"
}

prepare_jest_coverage_report() {
  local component_name=$(basename "$1")

  if [ ! -d "coverage" ]; then
    echo "ValidationError: Missing required directory coverage after running unit tests"
    exit 129
  fi

  # prepare coverage reports
  rm -fr coverage/lcov-report
  mkdir -p $coverage_reports_top_path/jest
  coverage_report_path=$coverage_reports_top_path/jest/$component_name
  rm -fr $coverage_report_path
  mv coverage $coverage_report_path
}

# container tests need permission to pull amazon linux base image
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

headline "[Setup] Configure paths"
template_dir="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cdk_dir="$template_dir/../source/constructs"
image_handler_dir="$template_dir/../source/image-handler"
custom_resource_dir="$template_dir/../source/custom-resource"
metrics_utils_dir="$template_dir/../source/metrics-utils"
data_models_dir="$template_dir/../source/data-models"
management_lambda_dir="$template_dir/../source/management-lambda"
utility_lambda_dir="$template_dir/../source/utility-lambda"
container_dir="$template_dir/../source/container"
admin_ui_dir="$template_dir/../source/admin-ui"
v8_custom_resource_dir="$template_dir/../source/v8-custom-resource"
solution_utils_dir="$template_dir/../source/solution-utils"
coverage_reports_top_path="$template_dir/../source/test/coverage-reports"

headline "[Tests] Run unit tests"
declare -a packages=(
  "$cdk_dir"
  "$image_handler_dir"
  "$custom_resource_dir"
  "$metrics_utils_dir"
  "$data_models_dir"
  "$management_lambda_dir"
  "$utility_lambda_dir"
  "$container_dir"
  "$admin_ui_dir"
  "$v8_custom_resource_dir"
  "$solution_utils_dir"
)
for package in "${packages[@]}"; do
  cd "$package"
  npm test
  prepare_jest_coverage_report "$package"
done;