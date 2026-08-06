// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { ArnFormat, CfnResource, CustomResource, Duration, Fn, Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct, IConstruct } from "constructs";
import { addCfnSuppressRules } from "../../utils/utils";

export interface EventSourceMappingResolverProps {
  /** The Lambda function that has the EventSourceMapping */
  readonly targetFunction: LambdaFunction;
  /** The SQS queue that is the event source */
  readonly targetQueue: Queue;
}

/**
 * Custom Resource that resolves EventSourceMapping conflicts during upgrades.
 *
 * When a CDK construct ID change causes the EventSourceMapping logical ID to change,
 * CloudFormation tries create-before-delete. Lambda rejects the duplicate with 409.
 *
 * This runs once on first creation (the upgrade) and deletes any existing mapping
 * for the pair, allowing CloudFormation to create the new one cleanly.
 */
export class EventSourceMappingResolver extends Construct {
  public readonly customResource: CustomResource;

  constructor(scope: Construct, id: string, props: EventSourceMappingResolverProps) {
    super(scope, id);

    const resolverFunction = new NodejsFunction(this, "Function", {
      description: "Resolves EventSourceMapping conflicts during stack upgrades",
      entry: path.join(__dirname, "../../../custom-resource/event-source-mapping-resolver/index.ts"),
      projectRoot: path.join(__dirname, "../../../custom-resource"),
      depsLockFilePath: path.join(__dirname, "../../../custom-resource/package-lock.json"),
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 128,
    });

    resolverFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["lambda:ListEventSourceMappings"],
        resources: ["*"],
      })
    );

    resolverFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["lambda:DeleteEventSourceMapping"],
        resources: [
          Stack.of(this).formatArn({
            service: "lambda",
            resource: "event-source-mapping",
            resourceName: "*",
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      })
    );

    resolverFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["cloudformation:ListStackResources"],
        resources: [
          Fn.sub("arn:${AWS::Partition}:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/${AWS::StackName}/*"),
        ],
      })
    );

    addCfnSuppressRules(resolverFunction, [
      { id: "W89", reason: "Not in VPC — only calls Lambda control plane APIs" },
      { id: "W92", reason: "No reserved concurrency needed — runs once during deployment" },
    ]);

    this.customResource = new CustomResource(this, "Resource", {
      serviceToken: resolverFunction.functionArn,
      properties: {
        FunctionName: props.targetFunction.functionName,
        EventSourceArn: props.targetQueue.queueArn,
      },
    });
  }

  /**
   * Makes all EventSourceMapping resources under the given scope depend on this
   * Custom Resource, ensuring the resolver runs first.
   */
  public addDependencyToEventSourceMappings(scope: IConstruct): void {
    const crCfn = this.customResource.node.defaultChild as CfnResource;
    for (const child of scope.node.findAll()) {
      const defaultChild = child.node.defaultChild as any;
      if (
        defaultChild?.cfnResourceType === "AWS::Lambda::EventSourceMapping" &&
        typeof defaultChild.addDependency === "function"
      ) {
        defaultChild.addDependency(crCfn);
      }
    }
  }

  /**
   * Finds the SQS queue and consumer Lambda inside a SolutionsMetrics construct
   * by traversing the construct tree. Uses duck-typing instead of instanceof
   * to avoid issues with duplicate aws-cdk-lib copies across packages.
   */
  static findTargetsInMetrics(metricsConstruct: IConstruct): { targetFunction: LambdaFunction; targetQueue: Queue } | undefined {
    let targetFunction: LambdaFunction | undefined;
    let targetQueue: Queue | undefined;

    for (const child of metricsConstruct.node.findAll()) {
      // Duck-type check: does the default child have a cfnResourceType property?
      const cfnChild = child.node.defaultChild as any;
      if (!cfnChild?.cfnResourceType) continue;

      if (
        cfnChild.cfnResourceType === "AWS::Lambda::Function" &&
        child.node.id === "MetricsLambda"
      ) {
        targetFunction = child as unknown as LambdaFunction;
      }
      if (
        cfnChild.cfnResourceType === "AWS::SQS::Queue" &&
        child.node.path.includes("LambdaToSqsToLambda") &&
        !child.node.path.includes("deadLetter")
      ) {
        targetQueue = child as unknown as Queue;
      }
    }

    if (targetFunction && targetQueue) {
      return { targetFunction, targetQueue };
    }
    return undefined;
  }
}
