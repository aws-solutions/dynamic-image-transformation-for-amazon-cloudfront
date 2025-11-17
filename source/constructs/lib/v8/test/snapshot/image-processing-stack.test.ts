// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { ImageProcessingStack } from "../../stacks";
import { cleanTemplateForSnapshot } from "./test-utils";

describe("ImageProcessingStack", () => {
  let app: App;
  let parentStack: Stack;
  let configTable: dynamodb.TableV2;
  let stack: ImageProcessingStack;
  let template: Template;

  beforeEach(() => {
    app = new App({
      context: {
        solutionId: "SO0023",
        solutionVersion: "v8.0.0",
      },
    });

    parentStack = new Stack(app, "TestParentStack");

    // image processing stack has dependency on DDB Table from parent stack
    configTable = new dynamodb.TableV2(parentStack, "TestConfigTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    });

    stack = new ImageProcessingStack(parentStack, "TestImageProcessingStack", {
      configTable,
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
