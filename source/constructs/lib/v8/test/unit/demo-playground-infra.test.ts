// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { ImageProcessingStack } from "../../stacks";
import { ManagementStack } from "../../stacks";

describe("Demo Playground Infrastructure", () => {
  describe("ImageProcessingStack", () => {
    let parentStack: Stack;
    let configTable: dynamodb.TableV2;

    beforeEach(() => {
      process.env.SOLUTION_ID = "SO0023";
      process.env.VERSION = "v8.0.3";
    });

    function createImageProcessingStack(props: {
      userPoolId?: string;
      userPoolClientId?: string;
      corsOrigin?: string;
    }): Template {
      const app = new App();
      parentStack = new Stack(app, "TestParentStack");
      configTable = new dynamodb.TableV2(parentStack, "TestConfigTable", {
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      });

      const stack = new ImageProcessingStack(parentStack, "TestImageProcessingStack", {
        configTable,
        deploymentSize: "small",
        userPoolId: props.userPoolId,
        userPoolClientId: props.userPoolClientId,
        corsOrigin: props.corsOrigin,
      });

      return Template.fromStack(stack);
    }

    test("should set Cognito env vars on container when userPoolId and userPoolClientId are provided", () => {
      const template = createImageProcessingStack({ userPoolId: "us-east-1_ABC123", userPoolClientId: "client-abc-123" });

      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([
              Match.objectLike({
                Name: "COGNITO_USER_POOL_ID",
                Value: "us-east-1_ABC123",
              }),
              Match.objectLike({
                Name: "COGNITO_CLIENT_ID",
                Value: "client-abc-123",
              }),
            ]),
          }),
        ]),
      });
    });

    test("should expose distribution domain and ID as public properties in prod mode", () => {
      const template = createImageProcessingStack({});

      template.hasResourceProperties("AWS::CloudFront::Distribution", {
        DistributionConfig: Match.objectLike({
          Comment: Match.stringLikeRegexp("Image Handler Distribution"),
        }),
      });

      template.hasOutput("ImageProcessingDistributionDomain", {
        Description: Match.stringLikeRegexp("Image processing CloudFront distribution domain"),
      });
    });

    test("should include X-DIT expose headers and OPTIONS in response headers policy CORS config", () => {
      const template = createImageProcessingStack({});

      template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
        ResponseHeadersPolicyConfig: Match.objectLike({
          CorsConfig: Match.objectLike({
            AccessControlAllowMethods: {
              Items: Match.arrayWith(["GET", "HEAD", "OPTIONS"]),
            },
            AccessControlExposeHeaders: {
              Items: Match.arrayWith([
                "X-DIT-Metrics",
                "Content-Type",
                "Content-Length",
              ]),
            },
            AccessControlMaxAgeSec: 86400,
          }),
        }),
      });
    });

  });

  describe("ManagementStack", () => {
    let template: Template;

    beforeEach(() => {
      process.env.SOLUTION_ID = "SO0023";
      process.env.VERSION = "v8.0.3";

      const app = new App();
      const stack = new ManagementStack(app, "TestManagementStack", {
        description: "Test Management Stack",
        solutionId: process.env.SOLUTION_ID,
        solutionName: "dynamic-image-transformation-for-amazon-cloudfront",
        solutionVersion: process.env.VERSION,
      });

      template = Template.fromStack(stack);
    });

    test("should pass userPoolId to image processing nested stack", () => {
      const nestedStacks = template.findResources("AWS::CloudFormation::Stack");
      const nestedStackKeys = Object.keys(nestedStacks);
      expect(nestedStackKeys.length).toBeGreaterThanOrEqual(1);
      const imageProcessingStack = nestedStackKeys.find((key) => {
        const params = nestedStacks[key].Properties?.Parameters || {};
        return Object.entries(params).some(
          ([paramName, paramValue]: [string, any]) =>
            paramName.includes("AuthUserPool") && paramValue.Ref && paramValue.Ref.startsWith("AuthUserPool")
        );
      });
      expect(imageProcessingStack).toBeDefined();
    });
  });
});
