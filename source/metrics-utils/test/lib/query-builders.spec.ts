// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { SolutionsMetrics } from "../../lib/solutions-metrics";

const makeStack = () =>
  new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

const makeMetrics = (stack: cdk.Stack) => new SolutionsMetrics(stack, "Metrics", {});

const ecsLogGroup = (stack: cdk.Stack) => LogGroup.fromLogGroupName(stack, "LG", "/aws/ecs/container");

/** Assert a QueryDefinition exists with the given name suffix and a query string matching the pattern. */
function assertQueryDefinition(template: Template, nameSuffix: string, queryStringPattern: string) {
  template.hasResourceProperties("AWS::Logs::QueryDefinition", {
    Name: {
      "Fn::Join": ["", [{ Ref: "AWS::StackName" }, `-${nameSuffix}`]],
    },
    QueryString: Match.stringLikeRegexp(queryStringPattern),
  });
}

/** Assert the Lambda role policy grants logs:StartQuery + logs:GetQueryResults on the given resource ARN. */
function assertLogsQueryPermission(template: Template, expectedResource: unknown) {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        {
          Action: ["logs:StartQuery", "logs:GetQueryResults"],
          Effect: "Allow",
          Resource: expectedResource,
        },
      ]),
    },
  });
}

/** Assert the EventBridge InputTransformer embeds a metric data query for the given namespace and metric. */
function assertMetricDataQuery(template: Template, namespace: string, metricName: string) {
  template.hasResourceProperties("AWS::Events::Rule", {
    Targets: Match.arrayWith([
      Match.objectLike({
        InputTransformer: {
          InputTemplate: Match.stringLikeRegexp(`"Namespace":"${namespace}".*"MetricName":"${metricName}"`),
        },
      }),
    ]),
  });
}

describe("query-builders", () => {
  describe("metric data queries", () => {
    test("addLambdaInvocationCount embeds Lambda/Invocations metric in EventBridge InputTransformer", () => {
      const stack = makeStack();
      makeMetrics(stack).addLambdaInvocationCount({ functionName: "my-function" });
      const template = Template.fromStack(stack);
      assertMetricDataQuery(template, "AWS/Lambda", "Invocations");
      template.hasResourceProperties("AWS::Events::Rule", {
        Targets: Match.arrayWith([
          Match.objectLike({
            InputTransformer: { InputTemplate: Match.stringLikeRegexp("my-function") },
          }),
        ]),
      });
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([{ Action: "cloudwatch:GetMetricData", Effect: "Allow", Resource: "*" }]),
        },
      });
    });

    test("addCloudFrontMetric embeds CloudFront/Requests metric with us-east-1 region in EventBridge InputTransformer", () => {
      const stack = makeStack();
      makeMetrics(stack).addCloudFrontMetric({ distributionId: "EDFDVBD6EXAMPLE", metricName: "Requests" });
      const template = Template.fromStack(stack);
      assertMetricDataQuery(template, "AWS/CloudFront", "Requests");
      template.hasResourceProperties("AWS::Events::Rule", {
        Targets: Match.arrayWith([
          Match.objectLike({
            InputTransformer: { InputTemplate: Match.stringLikeRegexp('"region":"us-east-1"') },
          }),
        ]),
      });
    });
  });

  describe("ECS log-based queries", () => {
    test("addLambdaBilledDurationMemorySize creates QueryDefinition with billedDuration and memorySize stats", () => {
      const stack = makeStack();
      makeMetrics(stack).addLambdaBilledDurationMemorySize({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "BilledDurationMemorySizeQuery", "billedDuration");
      assertQueryDefinition(template, "BilledDurationMemorySizeQuery", "memorySize");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSImageSizeMetrics creates QueryDefinition filtering imageTransformation with size stats", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSImageSizeMetrics({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSImageSizeMetrics", "imageTransformation");
      assertQueryDefinition(template, "ECSImageSizeMetrics", "ImageSize_TotalOrigin");
      assertQueryDefinition(template, "ECSImageSizeMetrics", "ImageSize_TotalTransformed");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSImageFormatMetrics creates QueryDefinition with per-format counts", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSImageFormatMetrics({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSImageFormatMetrics", "imageTransformation");
      assertQueryDefinition(template, "ECSImageFormatMetrics", "Format_Origin_Jpeg");
      assertQueryDefinition(template, "ECSImageFormatMetrics", "Format_Transformed_Webp");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSTransformationTimeBuckets creates QueryDefinition filtering request_latencies with time buckets", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSTransformationTimeBuckets({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSTransformationTimeBuckets", "request_latencies");
      assertQueryDefinition(template, "ECSTransformationTimeBuckets", "TotalRequestTimeBucket");
      assertQueryDefinition(template, "ECSTransformationTimeBuckets", "OriginFetchBucket");
      assertQueryDefinition(template, "ECSTransformationTimeBuckets", "TransformationApplicationBucket");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSImageSizeBuckets creates QueryDefinition with image size histogram buckets", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSImageSizeBuckets({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSImageSizeBuckets", "imageTransformation");
      assertQueryDefinition(template, "ECSImageSizeBuckets", "ImageSize_Origin_Bucket");
      assertQueryDefinition(template, "ECSImageSizeBuckets", "ImageSize_Transformed_Bucket");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSImageRequestCount creates QueryDefinition counting total images", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSImageRequestCount({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSImageRequestCount", "imageTransformation");
      assertQueryDefinition(template, "ECSImageRequestCount", "Requests_TotalImages");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSOriginTypeMetrics creates QueryDefinition filtering image_fetched with S3 and external counts", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSOriginTypeMetrics({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSOriginTypeMetrics", "image_fetched");
      assertQueryDefinition(template, "ECSOriginTypeMetrics", "OriginType_S3");
      assertQueryDefinition(template, "ECSOriginTypeMetrics", "OriginType_External");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addECSTransformationUsageMetrics creates QueryDefinition with per-transformation counts", () => {
      const stack = makeStack();
      makeMetrics(stack).addECSTransformationUsageMetrics({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "ECSTransformationUsageMetrics", "transformations");
      assertQueryDefinition(template, "ECSTransformationUsageMetrics", "Transformation_Resize");
      assertQueryDefinition(template, "ECSTransformationUsageMetrics", "Transformation_SmartCrop");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });

    test("addTransformationSourceMetrics creates QueryDefinition filtering transformations_finalized with source counts", () => {
      const stack = makeStack();
      makeMetrics(stack).addTransformationSourceMetrics({ logGroups: [ecsLogGroup(stack)] });
      const template = Template.fromStack(stack);
      assertQueryDefinition(template, "TransformationSourceMetrics", "transformations_finalized");
      assertQueryDefinition(template, "TransformationSourceMetrics", "TransformationSource_URL");
      assertQueryDefinition(template, "TransformationSourceMetrics", "TransformationSource_Policy");
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            ":logs:us-east-1:123456789012:log-group:/aws/ecs/container:*",
          ],
        ],
      });
    });
  });

  describe("CloudFront Function log-based queries", () => {
    test("addCFTierDetectionMetrics creates QueryDefinition with us-east-1 log group and DIT-DETECT filter, regardless of stack region", () => {
      // Use ap-southeast-2 to prove us-east-1 is hardcoded regardless of stack region
      const stack = new cdk.Stack(undefined, undefined, {
        env: { account: "123456789012", region: "ap-southeast-2" },
      });
      makeMetrics(stack).addCFTierDetectionMetrics({ functionName: "dit-header-normalization-ap-southeast-2" });
      const template = Template.fromStack(stack);

      // QueryString filters on DIT-DETECT, parses name field, and counts all 5 tiers
      assertQueryDefinition(template, "CFTierDetectionMetrics", "DIT-DETECT");
      assertQueryDefinition(template, "CFTierDetectionMetrics", "Tier1_ClientHintsWidth");
      assertQueryDefinition(template, "CFTierDetectionMetrics", "Tier5_Fallback");
      assertQueryDefinition(template, "CFTierDetectionMetrics", '"name":"\\*"');

      // Query definition rely on plain log group name
      template.hasResourceProperties("AWS::Logs::QueryDefinition", {
        Name: {
          "Fn::Join": ["", [{ Ref: "AWS::StackName" }, "-CFTierDetectionMetrics"]],
        },
        LogGroupNames: ["/aws/cloudfront/function/dit-header-normalization-ap-southeast-2"],
      });

      // IAM resource ARN must also hardcode us-east-1 as CF function only logs in us-east-1
      assertLogsQueryPermission(template, {
        "Fn::Join": [
          "",
          [
            "arn:aws:logs:us-east-1:",
            { Ref: "AWS::AccountId" },
            ":log-group:/aws/cloudfront/function/dit-header-normalization-ap-southeast-2:*",
          ],
        ],
      });
    });
  });
});
