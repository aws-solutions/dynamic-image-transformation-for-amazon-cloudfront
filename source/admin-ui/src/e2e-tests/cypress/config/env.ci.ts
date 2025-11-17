// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export default {
  // CloudFormation stack outputs - set by pipeline
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  APP_URL: process.env.APP_URL,
  
  // AWS configuration
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  
  // Test configuration
  TAGS: process.env.TAGS || '',
};