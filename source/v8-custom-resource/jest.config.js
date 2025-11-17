// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: ["index.ts", "lib/**/*.ts"],
  coverageReporters: ["text", ["lcov", { projectRoot: "../../" }]],
  testMatch: ["**/*.spec.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setupJestMocks.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};
