// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, DefaultStackSynthesizer } from "aws-cdk-lib";
import { ServerlessImageHandlerStack } from "../lib/serverless-image-stack";
import { ManagementStack, ManagementStackProps } from "../lib/v8/stacks";

// CDK and default deployment
let synthesizer = new DefaultStackSynthesizer({
  generateBootstrapVersionRule: false,
});

// Solutions pipeline deployment
const { DIST_OUTPUT_BUCKET, SOLUTION_NAME, VERSION, SOLUTION_ID } = process.env;
const { PUBLIC_ECR_REGISTRY } = process.env;
if (DIST_OUTPUT_BUCKET && SOLUTION_NAME && VERSION)
  synthesizer = new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
    fileAssetsBucketName: `${DIST_OUTPUT_BUCKET}-\${AWS::Region}`,
    bucketPrefix: `${SOLUTION_NAME}/${VERSION}/`,
  });

const app = new App({
  context: {
    productionImageUri: PUBLIC_ECR_REGISTRY ? `${PUBLIC_ECR_REGISTRY}/${SOLUTION_NAME}:${VERSION}` : undefined,
  },
});

const solutionDisplayName = "Dynamic Image Transformation for Amazon CloudFront";
const solutionVersion = VERSION ?? app.node.tryGetContext("solutionVersion");
const solutionName = SOLUTION_NAME ?? app.node.tryGetContext("solutionName");
const solutionId = SOLUTION_ID ?? app.node.tryGetContext("solutionId");
const description = `(${solutionId}) - ${solutionDisplayName}. Version ${solutionVersion}`;

new ServerlessImageHandlerStack(app, "v7-Stack", {
  synthesizer,
  description,
  solutionId,
  solutionVersion,
  solutionName,
});

const managementStackProps: ManagementStackProps = {
  synthesizer,
  solutionId,
  solutionName,
  solutionVersion,
  description,
};
new ManagementStack(app, "v8-Stack", managementStackProps);
