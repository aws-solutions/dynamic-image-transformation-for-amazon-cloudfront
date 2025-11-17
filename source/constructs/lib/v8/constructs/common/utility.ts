// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Duration } from "aws-cdk-lib";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Cluster, FargateService } from "aws-cdk-lib/aws-ecs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import path from "path";
import { DITNodejsFunction } from "./lambda";

export interface UtilityConstructProps {
  table: ITable;
  ecsService: FargateService;
  cluster: Cluster;
}

export class Utility extends Construct {
  public readonly utilityFunction: LambdaFunction;

  constructor(scope: Construct, id: string, props: UtilityConstructProps) {
    super(scope, id);
    const { SOLUTION_ID, VERSION } = process.env;
    this.utilityFunction = new DITNodejsFunction(this, "UtilityFunction", {
      entry: path.join(__dirname, "../../../../../utility-lambda/index.ts"),
      environment: {
        ECS_CLUSTER_NAME: props.cluster.clusterName,
        ECS_SERVICE_NAME: props.ecsService.serviceName,
        SOLUTION_ID: SOLUTION_ID ?? scope.node.tryGetContext("solutionId"),
        SOLUTION_VERSION: VERSION ?? scope.node.tryGetContext("solutionVersion"),
      },
    });

    this.utilityFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["ecs:UpdateService", "ecs:DescribeServices"],
        resources: [props.ecsService.serviceArn, `${props.cluster.clusterArn}/*`],
      })
    );

    this.utilityFunction.addEventSource(
      new DynamoEventSource(props.table, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 1000,
        maxBatchingWindow: Duration.seconds(180), // ECS cancels in-progress deployments when new deployments are issued. To prevent deployment starvation, using a batch window to ensure pending deployments have time to complete.
        retryAttempts: 3,
      })
    );
  }
}
