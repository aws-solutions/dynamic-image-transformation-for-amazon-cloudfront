// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["e2e"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  setupFilesAfterEnv: ["./test/setupJestMocks.ts"],
  silent: true,
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }]
  ],
};
