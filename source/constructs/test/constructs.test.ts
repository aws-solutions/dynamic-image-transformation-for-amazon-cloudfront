// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from "aws-cdk-lib/assertions";
import { App } from "aws-cdk-lib";

import { ServerlessImageHandlerStack } from "../lib/serverless-image-stack";

const SUPPORTED_RUNTIMES = ["nodejs22.x", "python3.13"];

describe("ServerlessImageHandlerStack", () => {
  let app: App;
  let stack: ServerlessImageHandlerStack;
  let template: Template;

  beforeEach(() => {
    app = new App({
      context: {
        solutionId: "SO0023",
        solutionName: "dynamic-image-transformation-for-amazon-cloudfront",
        solutionVersion: "v7.0.1",
      },
    });

    stack = new ServerlessImageHandlerStack(app, "TestStack", {
      solutionId: "S0ABC",
      solutionName: "dit",
      solutionVersion: "v7.0.1",
    });

    template = Template.fromStack(stack);
  });

  test("Dynamic Image Transformation for Amazon CloudFront Stack Snapshot", () => {
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
      if (templateJson.Resources[key].Properties?.SourceObjectKeys) {
        templateJson.Resources[key].Properties.SourceObjectKeys = [
          "Omitted to remove snapshot dependency on demo ui module hash",
        ];
      }
      if (templateJson.Resources[key].Properties?.Environment?.Variables?.SOLUTION_VERSION) {
        templateJson.Resources[key].Properties.Environment.Variables.SOLUTION_VERSION =
          "Omitted to remove snapshot dependency on solution version";
      }
    });

    expect.assertions(1);
    expect(templateJson).toMatchSnapshot();
  });

  test("All Lambda functions should use supported runtimes", () => {
    const lambdaFunctions = template.findResources("AWS::Lambda::Function");
    const functionNames = Object.keys(lambdaFunctions);

    expect(functionNames.length).toBeGreaterThan(0);

    functionNames.forEach((functionName) => {
      const runtime = lambdaFunctions[functionName].Properties.Runtime;
      expect(SUPPORTED_RUNTIMES).toContain(runtime);
    });
  });
});
