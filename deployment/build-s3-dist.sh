#!/bin/bash
# The script is for aws-solutions internal purposes only

[ "$DEBUG" == 'true' ] && set -x
set -e

# Check to see if input has been provided:
if [ -z "$SOLUTION_NAME" ]; then
    echo "Please provide the trademark approved solution name through environment variables"
    exit 1
fi

function headline(){
  echo "------------------------------------------------------------------------------"
  echo "$1"
  echo "------------------------------------------------------------------------------"
}

headline "[Init] Setting up paths and variables"
deployment_dir="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
staging_dist_dir="$deployment_dir/staging"
template_dist_dir="$deployment_dir/global-s3-assets"
build_dist_dir="$deployment_dir/regional-s3-assets"
source_dir="$deployment_dir/../source"
cdk_source_dir="$source_dir/constructs"

headline "[Init] Clean old folders"
rm -rf "$staging_dist_dir"
mkdir -p "$staging_dist_dir"
rm -rf "$template_dist_dir"
mkdir -p "$template_dist_dir"
rm -rf "$build_dist_dir"
mkdir -p "$build_dist_dir"

headline "[Init] Ensure package versions are updated"
npm --prefix "$source_dir" run bump-version

headline "[Build] Synthesize cdk template and assets"
cd "$cdk_source_dir"
npm run clean:install
overrideWarningsEnabled=false npx cdk synth --quiet --asset-metadata false --path-metadata --output="$staging_dist_dir"
cd "$staging_dist_dir"
rm tree.json manifest.json cdk.out ./*.assets.json
cp "$staging_dist_dir"/*.template.json "$template_dist_dir"/"$SOLUTION_NAME".template
rm ./*.template.json

headline "[Package] Generate public assets for lambda and ui"
cd "$deployment_dir"/cdk-solution-helper/asset-packager && npm ci
npx ts-node ./index "$staging_dist_dir" "$build_dist_dir"
rm -rf $staging_dist_dir