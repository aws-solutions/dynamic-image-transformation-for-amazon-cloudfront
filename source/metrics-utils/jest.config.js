// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!test/**',
    '!**/*.test.ts',
    '!**/*.d.ts',
    '!jest.config.js',
    '!**/node_modules/**'
  ],
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }]
  ]
};
