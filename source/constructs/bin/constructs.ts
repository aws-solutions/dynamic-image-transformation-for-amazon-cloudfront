// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, DefaultStackSynthesizer } from "aws-cdk-lib";
import { ServerlessImageHandlerStack } from "../lib/serverless-image-stack";

// CDK and default deployment
let synthesizer = new DefaultStackSynthesizer({
  generateBootstrapVersionRule: false,
});

// Solutions pipeline deployment
const { DIST_OUTPUT_BUCKET, SOLUTION_NAME, VERSION, STACK_NAME } = process.env;
if (!STACK_NAME) {
  throw new Error("STACK_NAME env variable has to be set!");
}
if (DIST_OUTPUT_BUCKET && SOLUTION_NAME && VERSION)
  synthesizer = new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
    fileAssetsBucketName: `${DIST_OUTPUT_BUCKET}-\${AWS::Region}`,
    bucketPrefix: `${SOLUTION_NAME}/${VERSION}/`,
  });

const app = new App();
const solutionDisplayName = "Serverless Image Handler";
const description = `(${app.node.tryGetContext("solutionId")}) - ${solutionDisplayName}. Version ${
  VERSION ?? app.node.tryGetContext("solutionVersion")
}`;
// eslint-disable-next-line no-new
new ServerlessImageHandlerStack(app, STACK_NAME, {
  synthesizer: synthesizer,
  description: description,
  solutionId: app.node.tryGetContext("solutionId"),
  solutionVersion: app.node.tryGetContext("solutionVersion"),
  solutionName: app.node.tryGetContext("solutionName"),
});
