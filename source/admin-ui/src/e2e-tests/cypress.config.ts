// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'cypress';
import ciEnv from './cypress/config/env.ci';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/specs/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      require('./cypress/plugins/index')(on, config);
      return config;
    },
    video: true,
    retries: {
      runMode: 0, // CI
      openMode: 0
    },
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    screenshotsFolder: 'artifacts/screenshots',
    videosFolder: 'artifacts/videos',
    env: {
      ...ciEnv,
      TAGS: process.env.TAGS || '',
      USER_PASSWORD: process.env.USER_PASSWORD,
      appUrl: process.env.APP_URL,
      cognitoOrigin: `https://dit-${process.env.COGNITO_ACCOUNT}-${process.env.COGNITO_REGION}.auth.${process.env.COGNITO_REGION}.amazoncognito.com`
    }
  },
});
