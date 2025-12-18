// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CustomResource } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { DITNodejsFunction } from "../common";
import {addCfnGuardSuppressRules} from "../../../../utils/utils";

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

    const customResourceLambda = new DITNodejsFunction(this, "CustomResourceLambda", {
      handler: "handler",
      entry: path.join(__dirname, "../../../../../v8-custom-resource/index.ts"),
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

    addCfnGuardSuppressRules(customResourceLambda, [
      {
        id: "LAMBDA_INSIDE_VPC",
        reason: "Lambda used for sending metrics.",
      },
      {
        id: "LAMBDA_CONCURRENCY_CHECK",
        reason: "Lambda used for sending metrics.",
      },
    ]);
  }
}
