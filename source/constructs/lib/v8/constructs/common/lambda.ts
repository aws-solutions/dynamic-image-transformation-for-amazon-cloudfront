// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import {
  DIT_LAMBDA_DEFAULT_MEMORY_SIZE,
  DIT_LAMBDA_DEFAULT_TIMEOUT,
  DIT_LAMBDA_RUNTIME,
  LOG_RETENTION_DAYS,
} from "./constants";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";

/**
 * Construct to create a Lambda function with default configuration for the DIT solution
 */
export class DITNodejsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props?: NodejsFunctionProps) {
    const logGroup = new LogGroup(scope, `${id}LogGroup`, {
      retention: LOG_RETENTION_DAYS,
    });

    addCfnGuardSuppressRules(logGroup, [
      {
        id: "CLOUDWATCH_LOG_GROUP_ENCRYPTED",
        reason:
          "CFN Guard KMS key requirement suppressed as there's no customer information involved. Using AWS managed encryption is sufficient for Lambda function logs.",
      },
    ]);

    super(scope, id, {
      runtime: DIT_LAMBDA_RUNTIME,
      memorySize: DIT_LAMBDA_DEFAULT_MEMORY_SIZE,
      timeout: DIT_LAMBDA_DEFAULT_TIMEOUT,
      logGroup: logGroup,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      ...props,
    });
  }
}
