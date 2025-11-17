// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CustomResource, Duration } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

export interface MetricsConstructProps {
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly anonymousData: string;
  readonly useExistingCloudFrontDistribution: string;
  readonly deploymentSize: string;
}

export class MetricsConstruct extends Construct {
  public readonly uuid: string;

  constructor(scope: Construct, id: string, props: MetricsConstructProps) {
    super(scope, id);

    const customResourceLambda = new NodejsFunction(this, "CustomResourceLambda", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "../../../../../v8-custom-resource/index.ts"),
      timeout: Duration.seconds(30),
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        SOLUTION_ID: props.solutionId,
        SOLUTION_VERSION: props.solutionVersion,
      },
    });

    const uuidResource = new CustomResource(this, "UUID", {
      serviceToken: customResourceLambda.functionArn,
      properties: {
        CustomAction: "createUuid",
      },
    });
    this.uuid = uuidResource.getAttString("UUID");

    new CustomResource(this, "Metrics", {
      serviceToken: customResourceLambda.functionArn,
      properties: {
        CustomAction: "sendMetric",
        Region: Aws.REGION,
        UUID: this.uuid,
        AnonymousData: props.anonymousData,
        UseExistingCloudFrontDistribution: props.useExistingCloudFrontDistribution,
        DeploymentSize: props.deploymentSize,
      },
    });
  }
}
