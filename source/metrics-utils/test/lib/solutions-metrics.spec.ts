// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SolutionsMetrics } from "../../lib/solutions-metrics";
import { SolutionsMetricProps } from "../../lambda/helpers/types";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { LogGroup } from "aws-cdk-lib/aws-logs";

test("Test that query definition correctly adds StartQuery/GetQueryResults permissions", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID", "SomeLogGroup")],
    queryDefinitionName: "ExampleQuery",
  });
  const template = Template.fromStack(stack);
  assertPolicyStatementContains(template, [
    {
      Action: ["logs:StartQuery", "logs:GetQueryResults"],
      Effect: "Allow",
      Resource: Match.anyValue(),
    },
    {
      Action: "logs:DescribeQueryDefinitions",
      Effect: "Allow",
      Resource: "*",
    },
  ]);
});

test("Test that a metric data query correctly adds GetMetricData permission", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName" });
  const template = Template.fromStack(stack);
  assertPolicyStatementContains(template, [
    {
      Action: "cloudwatch:GetMetricData",
      Effect: "Allow",
      Resource: "*",
    },
  ]);
});

test("Test that a duplicate metric will correctly throw an error", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName" });

  expect(() => {
    solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName2" });
  }).toThrow();
});

test("Test that a unique identifier allows duplicate metrics", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName" });

  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName2", identifier: "Identifier" });
});

test("Test that a forward slash is permitted as a metric identifier", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName", identifier: "Resources/Resource1" });
});

test("Test that a query definition and metric data query correctly adds all required permissions", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID", "SomeLogGroup")],
    identifier: "ExampleQuery",
  });
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName" });
  const template = Template.fromStack(stack);
  assertPolicyStatementContains(template, [
    {
      Action: ["logs:StartQuery", "logs:GetQueryResults"],
      Effect: "Allow",
      Resource: Match.anyValue(),
    },
    {
      Action: "logs:DescribeQueryDefinitions",
      Effect: "Allow",
      Resource: "*",
    },
    {
      Action: "cloudwatch:GetMetricData",
      Effect: "Allow",
      Resource: "*",
    },
  ]);
});

test("Test that metric data queries are defined correctly", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaInvocationCount({ functionName: "SomeFunctionName" });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: Match.anyValue(),
    State: "ENABLED",
    Targets: [
      {
        Arn: Match.anyValue(),
        Id: Match.anyValue(),
        InputTransformer: {
          InputPathsMap: Match.anyValue(),
          InputTemplate: Match.anyValue(),
        },
      },
    ],
  });
});

test("Test that multiple query definitions are defined correctly", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID", "SomeLogGroup")],
    queryDefinitionName: "ExampleQuery",
    identifier: "_LogGroup",
  });
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID2", "SomeLogGroup")],
    queryDefinitionName: "ExampleQuery2",
    identifier: "_LogGroup2",
  });
  const template = Template.fromStack(stack);
  template.hasResource("AWS::Logs::QueryDefinition", {
    Properties: {
      LogGroupNames: ["SomeLogGroup"],
      Name: {
        "Fn::Join": [
          "",
          [
            {
              Ref: "AWS::StackName",
            },
            "-ExampleQuery_LogGroup",
          ],
        ],
      },
      QueryString: Match.anyValue(),
    },
  });

  template.hasResource("AWS::Logs::QueryDefinition", {
    Properties: {
      LogGroupNames: ["SomeLogGroup"],
      Name: {
        "Fn::Join": [
          "",
          [
            {
              Ref: "AWS::StackName",
            },
            "-ExampleQuery2_LogGroup2",
          ],
        ],
      },
      QueryString: Match.anyValue(),
    },
  });
});

test("Test that multiple query definitions with identical identifier correctly throw an error", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID", "SomeLogGroup")],
    queryDefinitionName: "ExampleQuery",
  });
  expect(() => {
    solutionsMetrics.addLambdaBilledDurationMemorySize({
      logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID2", "SomeLogGroup")],
      queryDefinitionName: "ExampleQuery2",
    });
  }).toThrow();
});

test("Test that identical query definition names correctly throw an error", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  solutionsMetrics.addLambdaBilledDurationMemorySize({
    logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID", "SomeLogGroup")],
    queryDefinitionName: "ExampleQuer",
    identifier: "ySomeIdentifier",
  });
  expect(() => {
    solutionsMetrics.addLambdaBilledDurationMemorySize({
      logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID2", "SomeLogGroup")],
      queryDefinitionName: "ExampleQuery",
      identifier: "SomeIdentifier",
    });
  }).toThrow();
});

test("Test that identifier with invalid values throws an error", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "us-east-1" },
  });

  const props: SolutionsMetricProps = {
    metricDataProps: [],
    queryProps: [],
  };
  const solutionsMetrics = new SolutionsMetrics(stack, "test-one", props);
  expect(() => {
    solutionsMetrics.addLambdaBilledDurationMemorySize({
      logGroups: [LogGroup.fromLogGroupName(stack, "LogGroupID2", "SomeLogGroup")],
      queryDefinitionName: "ExampleQuery",
      identifier: "Identifier/Resource",
    });
  }).toThrow();
});

test("Test correct version identifier on lambda environment variables", () => {
  // arrange
  process.env["VERSION"] = "my-version";
  const stack = new cdk.Stack();

  // act
  new SolutionsMetrics(stack, "test-version", {});
  const template = Template.fromStack(stack);

  // assert
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: {
        SOLUTION_VERSION: process.env["VERSION"],
      },
    },
  });
});

test("addCFTierDetectionMetrics creates a QueryDefinition with us-east-1 log group ARN", () => {
  const stack = new cdk.Stack(undefined, undefined, {
    env: { account: "123456789012", region: "ap-southeast-2" },
  });

  const solutionsMetrics = new SolutionsMetrics(stack, "test-cf-tier", {});
  solutionsMetrics.addCFTierDetectionMetrics({ functionName: "dit-header-normalization-ap-southeast-2" });

  const template = Template.fromStack(stack);

  // LogGroupNames only carries the log group name (CDK strips the ARN prefix),
  // so assert the IAM policy resource instead — that uses the full ARN and
  // proves us-east-1 is hardcoded regardless of the stack's deployment region.
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        {
          Action: ["logs:StartQuery", "logs:GetQueryResults"],
          Effect: "Allow",
          Resource: {
            "Fn::Join": [
              "",
              [
                "arn:aws:logs:us-east-1:",
                { Ref: "AWS::AccountId" },
                ":log-group:/aws/cloudfront/function/dit-header-normalization-ap-southeast-2:*",
              ],
            ],
          },
        },
      ]),
    },
  });

  // Also verify the query string targets DIT-DETECT events
  template.hasResource("AWS::Logs::QueryDefinition", {
    Properties: {
      QueryString: Match.stringLikeRegexp("DIT-DETECT"),
    },
  });
});

function assertPolicyStatementContains(template: Template, pattern: any[]) {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith(pattern),
    },
  });
}
