// Base configuration shared by both unit and e2e tests
const baseConfig = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }]
  ],
  silent: true,
  workerIdleMemoryLimit: 0.2
};

// Check for test type from environment variable or CLI argument
const testType = process.env.TEST_TYPE || 'unit';

// Configuration for unit tests
const unitConfig = {
  ...baseConfig,
  displayName: "Unit Tests",
  roots: ["<rootDir>/test", "<rootDir>/lib/v8/test/snapshot", "<rootDir>/lib/v8/test/unit"],
};

// Configuration for e2e tests
const e2eConfig = {
  ...baseConfig,
  displayName: 'E2E Tests',
  roots: ['<rootDir>/lib/v8/test/e2e'],
};

// Export configuration based on test type
module.exports = testType === 'unit' ? unitConfig : e2eConfig;
