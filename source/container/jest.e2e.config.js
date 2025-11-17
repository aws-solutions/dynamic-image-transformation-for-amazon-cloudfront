// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/e2e/**/*.e2e.test.ts'],
  globalSetup: '<rootDir>/test/e2e/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/e2e/setup/global-teardown.ts',
  testTimeout: 60000,
  maxWorkers: 1,
  verbose: true
};
