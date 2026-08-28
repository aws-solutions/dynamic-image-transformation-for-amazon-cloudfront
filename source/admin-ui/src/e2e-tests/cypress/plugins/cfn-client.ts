// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";

export interface StackConfig {
  appUrl: string;
  userPoolId: string;
  cognitoOrigin: string;
  apiEndpoint: string;
}

export async function getStackConfig(stackName: string, region: string): Promise<StackConfig> {
  const client = new CloudFormationClient({ region });
  const response = await client.send(new DescribeStacksCommand({ StackName: stackName }));

  const stack = response.Stacks?.[0];
  if (!stack) throw new Error(`Stack ${stackName} not found in region ${region}`);

  const appUrl = stack.Outputs?.find((o) => o.OutputKey == "WebPortalUrl")?.OutputValue;
  if (!appUrl) throw new Error("Required stack output WebPortalUrl is missing");

  const userPoolId = stack.Outputs?.find((o) => o.OutputKey?.includes("UserPoolId"))?.OutputValue;
  if (!userPoolId) throw new Error("Required stack output UserPool is missing");

  const cognitoDomainPrefix = stack.Outputs?.find((o) => o.OutputKey?.includes("CognitoDomainPrefix"))?.OutputValue;
  if (!cognitoDomainPrefix) throw new Error("Required stack output CognitoDomainPrefix is missing");

  const apiEndpoint = stack.Outputs?.find((o) => o.OutputKey?.includes("APIEndpoint"))?.OutputValue;
  if (!apiEndpoint) throw new Error("Required stack output APIEndpoint is missing");

  return {
    appUrl,
    userPoolId,
    cognitoOrigin: `https://${cognitoDomainPrefix}.auth.${region}.amazoncognito.com`,
    apiEndpoint,
  };
}
