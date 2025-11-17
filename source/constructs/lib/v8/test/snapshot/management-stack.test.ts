// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ManagementStack } from "../../stacks";
import { cleanTemplateForSnapshot } from "./test-utils";

describe("ManagementStack", () => {
  let app: App;
  let stack: ManagementStack;
  let template: Template;

  beforeEach(() => {
    app = new App();

    stack = new ManagementStack(app, "TestManagementStack", {
      description: "Test Management Stack for DIT v8",
      solutionId: "SO0023",
      solutionName: "dynamic-image-transformation-for-amazon-cloudfront",
      solutionVersion: "v8.0.0",
    });

    template = Template.fromStack(stack);
  });

  test("Snapshot Test", () => {
    const templateJson = template.toJSON();
    const cleanedTemplate = cleanTemplateForSnapshot(templateJson);

    expect.assertions(1);
    expect(cleanedTemplate).toMatchSnapshot();
  });
});
