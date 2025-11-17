// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  roots: ["<rootDir>"],
  testMatch: ["**/e2e/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  silent: true,
  globalSetup: "<rootDir>/test/e2e/global-setup.ts",
  globalTeardown: "<rootDir>/test/e2e/global-teardown.ts",
};
