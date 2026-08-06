// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ManagementStack } from "../../stacks";
import { cleanTemplateForSnapshot } from "./test-utils";

// nodejs24.x covers CDK-generated framework helpers (LogRetention, custom-resource
// provider framework) whose runtime is set internally by aws-cdk-lib. Our own Lambdas
// use nodejs22.x via DIT_LAMBDA_RUNTIME.
const SUPPORTED_RUNTIMES = ["nodejs22.x", "nodejs24.x", "python3.13"];

describe("ManagementStack", () => {
  let app: App;
  let stack: ManagementStack;
  let template: Template;

  beforeEach(() => {
    process.env.SOLUTION_ID = "SO0023";
    process.env.VERSION = "v8.0.6";

    app = new App();
    stack = new ManagementStack(app, "TestManagementStack", {
      description: "Test Management Stack for DIT v8",
      solutionId: process.env.SOLUTION_ID,
      solutionName: "dynamic-image-transformation-for-amazon-cloudfront",
      solutionVersion: process.env.VERSION,
    });

    template = Template.fromStack(stack);
  });

  test("Snapshot Test", () => {
    const templateJson = template.toJSON();
    const cleanedTemplate = cleanTemplateForSnapshot(templateJson);

    expect.assertions(1);
    expect(cleanedTemplate).toMatchSnapshot();
  });

  test("All Lambda functions should use Node.js 22 runtime", () => {
    const lambdaFunctions = template.findResources("AWS::Lambda::Function");
    const functionNames = Object.keys(lambdaFunctions);

    expect(functionNames.length).toBeGreaterThan(0);

    functionNames.forEach((functionName) => {
      const runtime = lambdaFunctions[functionName].Properties.Runtime;
      expect(SUPPORTED_RUNTIMES).toContain(runtime);
    });
  });
});
