// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnClient } from "./cfn-client";
import { CognitoClient } from "./cognito-client";
import { DynamoDBClient } from "./dynamodb-client";
import { loadEnvironment } from "./utils";

const globalSetup = async (): Promise<void> => {
  console.log(" 🌍 Running global setup...");

  const { region, stackName } = loadEnvironment();

  const solution = await new CfnClient(region).readCfnStackDetails(stackName);
  const cognitoClient = new CognitoClient(region);

  await new DynamoDBClient(region, solution.configTable).recreateTable();

  const { base64Credentials, clientId } = await cognitoClient.createCognitoAppClient({
    userPoolId: solution.userPoolId,
  });

  const apiAccessToken = await cognitoClient.fetchAccessToken({
    base64Credentials,
    cognitoDomainPrefix: solution.cognitoDomainPrefix,
  });

  // token and api url needed for test execution
  // user pool and client id needed for cleaning app client created for test
  Object.assign(process.env, {
    TEST_ACCESS_TOKEN: apiAccessToken,
    TEST_CLIENT_ID: clientId,
    API_URL: solution.apiUrl,
    USER_POOL_ID: solution.userPoolId,
  });

  console.log(" 🔧 Global setup complete ✅ ");
  console.log(" 🚀 Starting test execution...");
};

export default globalSetup;
