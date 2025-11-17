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
for file in "$staging_dist_dir"/*.template.json; do
  filename=$(basename "$file" .template.json)
  if [ "$filename" = "v8-Stack" ]; then
    # Replace the hash-based filename with static nested template name
    sed -i.bak 's|/[a-f0-9]\{64\}\.json"|/'${SOLUTION_NAME}'-ecs.nested.template"|g' "$file"
    cp "$file" "$template_dist_dir/$SOLUTION_NAME-ecs.template"
  elif [ "$filename" = "v7-Stack" ]; then
    cp "$file" "$template_dist_dir/$SOLUTION_NAME-lambda.template"
  else
    # Nested stack is only meant to be used by primary template, copy to regional assets
    cp "$file" "$build_dist_dir/$SOLUTION_NAME-ecs.nested.template"
  fi
done
rm ./*.template.json

headline "[Package] Generate public assets for lambda and ui"
cd "$deployment_dir"/cdk-solution-helper/asset-packager && npm ci
npx ts-node ./index "$staging_dist_dir" "$build_dist_dir"
rm -rf $staging_dist_dir

headline "[Package] Prepare ECR build context for pipeline"
ecr_build_dir="$deployment_dir/ecr/dynamic-image-transformation-for-amazon-cloudfront"
mkdir -p "$ecr_build_dir"

# Copy source files needed for Docker build
cp "$source_dir/package.json" "$ecr_build_dir/"
cp "$source_dir/package-lock.json" "$ecr_build_dir/"
cp "$source_dir/.dockerignore" "$ecr_build_dir/"
cp "$source_dir/Dockerfile" "$ecr_build_dir/"
cp -r "$source_dir/container" "$ecr_build_dir/"
cp -r "$source_dir/data-models" "$ecr_build_dir/"
rm -rf "$ecr_build_dir/container/node_modules"
rm -rf "$ecr_build_dir/data-models/node_modules"

# Create ECR image tag file for stable version
cat > "$deployment_dir/ecr_image_tags.json" << EOF
{
  "dynamic-image-transformation-for-amazon-cloudfront": "v8.0-stable"
}
EOF
