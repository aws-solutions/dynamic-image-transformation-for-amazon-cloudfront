// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFormationClient, DescribeStacksCommand, Stack } from "@aws-sdk/client-cloudformation";

export interface Solution {
  cognitoDomainPrefix: string;
  apiUrl: string;
  consoleUrl: string;
  userPoolId: string;
  region?: string;
  stackName?: string;
  configTable: string;
}

export class CfnClient {
  private readonly client: CloudFormationClient;

  constructor(private region: string) {
    this.client = new CloudFormationClient({
      region,
    });
  }

  async readCfnStackDetails(stackName: string): Promise<Solution> {
    const stack: Stack = await this.getCfnStack(stackName, this.region);

    const consoleUrl = stack.Outputs?.find((it) => it.OutputKey == "WebPortalUrl")?.OutputValue;
    if (!consoleUrl) throw new Error("Required Stack output WebPortalUrl is missing");

    const apiUrl = stack.Outputs?.find((it) => it.OutputKey?.includes("DITApi"))?.OutputValue;
    if (!apiUrl) throw new Error("Required Stack output APIEndpoint is missing");

    const userPoolId = stack.Outputs?.find((it) => it.OutputKey?.includes("UserPool"))?.OutputValue;
    if (!userPoolId) throw new Error("Required Stack output UserPool is missing");

    const cognitoDomainPrefix = stack.Outputs?.find((it) => it.OutputKey?.includes("CognitoDomainPrefix"))?.OutputValue;
    if (!cognitoDomainPrefix) throw new Error("Required Stack output CognitoDomainPrefix is missing");

    const configTable = stack.Outputs?.find((it) => it.OutputKey?.includes("ConfigTableName"))?.OutputValue;
    if (!configTable) throw new Error("Required Stack output ConfigTableName is missing");

    return {
      region: this.region,
      stackName,
      consoleUrl,
      apiUrl,
      cognitoDomainPrefix,
      userPoolId,
      configTable,
    };
  }

  async getCfnStack(stackName: string, region: string): Promise<Stack> {
    const command = new DescribeStacksCommand({
      StackName: stackName,
    });
    const response = await this.client.send(command);

    const stack = response.Stacks?.[0];
    if (!stack) {
      throw new Error(`Stack ${stackName} not found in region ${region}`);
    }

    return stack;
  }
}
