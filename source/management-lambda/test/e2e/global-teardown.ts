// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoClient } from "./cognito-client";

const globalTeardown = async (): Promise<void> => {
  console.log(" 💣 Running global teardown...");
  console.log(" 🧹 Deleting test cognito app client...");

  if (!process.env.USER_POOL_ID || !process.env.TEST_CLIENT_ID) {
    throw new Error("environment variable is not set");
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const cognitoClient = new CognitoClient(region);
  await cognitoClient.deleteCognitoAppClient({
    userPoolId: process.env.USER_POOL_ID!,
    clientId: process.env.TEST_CLIENT_ID!,
  });
  console.log(" 🏁 Global teardown complete.");
};

export default globalTeardown;
