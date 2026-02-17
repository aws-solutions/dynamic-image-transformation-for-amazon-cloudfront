// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";

// Mock NodejsFunction to avoid Docker bundling during tests
jest.mock("aws-cdk-lib/aws-lambda-nodejs", () => {
  const lambda = require("aws-cdk-lib/aws-lambda");

  return {
    NodejsFunction: class extends lambda.Function {
      constructor(scope: any, id: string, props: any) {
        const { entry, bundling, projectRoot, depsLockFilePath, ...rest } = props;
        super(scope, id, {
          ...rest,
          code: lambda.Code.fromAsset(path.join(__dirname)),
          handler: "index.handler",
        });
      }
    },
  };
});

import { Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib";

import { ServerlessImageHandlerStack } from "../lib/serverless-image-stack";

test("Serverless Image Handler Stack Snapshot", () => {
  const app = new App();

  const stack = new ServerlessImageHandlerStack(app, "TestStack", {
    solutionId: "S0ABC",
    solutionName: "sih",
    solutionVersion: "v6.2.5",
  });

  const template = Template.fromStack(stack);

  const templateJson = template.toJSON();

  /**
   * iterate templateJson and for any attribute called S3Key, replace the value for that attribute with "Omitted to remove snapshot dependency on hash",
   * this is so that the snapshot can be saved and will not change because the hash has been regenerated
   */
  Object.keys(templateJson.Resources).forEach((key) => {
    if (templateJson.Resources[key].Properties?.Code?.S3Key) {
      templateJson.Resources[key].Properties.Code.S3Key = "Omitted to remove snapshot dependency on hash";
    }
    if (templateJson.Resources[key].Properties?.Content?.S3Key) {
      templateJson.Resources[key].Properties.Content.S3Key = "Omitted to remove snapshot dependency on hash";
    }
  });

  expect.assertions(1);
  expect(templateJson).toMatchSnapshot();
});
