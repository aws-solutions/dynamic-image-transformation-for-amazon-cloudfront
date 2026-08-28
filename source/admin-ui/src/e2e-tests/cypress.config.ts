// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'cypress';
import { getStackConfig } from './cypress/plugins/cfn-client';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/specs/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    async setupNodeEvents(on, config) {
      require('./cypress/plugins/index')(on, config);
      const stackName = process.env.CURRENT_STACK_NAME;
      const region = process.env.CURRENT_STACK_REGION;
      if (!stackName || !region) throw new Error('CURRENT_STACK_NAME and CURRENT_STACK_REGION are required as env variable');
      if (!process.env.USER_PASSWORD) throw new Error('USER_PASSWORD is required as env variable');
      const stackConfig = await getStackConfig(stackName, region);
      config.env.appUrl = stackConfig.appUrl;
      config.env.cognitoOrigin = stackConfig.cognitoOrigin;
      config.env.COGNITO_USER_POOL_ID = stackConfig.userPoolId;
      config.env.apiEndpoint = stackConfig.apiEndpoint;
      return config;
    },
    experimentalInteractiveRunEvents: true,
    video: true,
    retries: {
      runMode: 2, // CI — retry failed tests to handle transient timing issues
      openMode: 0
    },
    defaultCommandTimeout: 30000,
    pageLoadTimeout: 30000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    screenshotsFolder: 'artifacts/screenshots',
    videosFolder: 'artifacts/videos',
    env: {
      AWS_REGION: process.env.CURRENT_STACK_REGION,
      CURRENT_STACK_NAME: process.env.CURRENT_STACK_NAME,
      TAGS: process.env.TAGS || '',
      USER_PASSWORD: process.env.USER_PASSWORD,
    }
  },
});
