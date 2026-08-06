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
      if (!stackName || !region) throw new Error('CURRENT_STACK_NAME and CURRENT_STACK_REGION are required');
      const stackConfig = await getStackConfig(stackName, region);
      config.env.appUrl = stackConfig.appUrl;
      config.env.cognitoOrigin = stackConfig.cognitoOrigin;
      config.env.COGNITO_USER_POOL_ID = stackConfig.userPoolId;
      return config;
    },
    video: true,
    retries: {
      runMode: 0, // CI
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
      TAGS: process.env.TAGS || '',
    }
  },
});
