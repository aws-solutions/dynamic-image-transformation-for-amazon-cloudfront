/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/test/**/docker-health.test.ts',  // Docker and container health tests only
    '**/__tests__/**/*.ts',               // Future unit tests
    '**/?(*.)+(spec|test).ts'            // Future unit tests (excluding docker-health.test.ts)
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**/*',           // Exclude all test files from coverage
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }],
    'html'
  ],
  testTimeout: 90000, // Extended timeout for Docker operations
  verbose: true,
  // AWS SDK v3 mocking support (for future unit tests)
  moduleNameMapper: {
    '^@aws-sdk/(.*)$': '<rootDir>/../node_modules/@aws-sdk/$1',
    '^@dit/(.*)$': '<rootDir>/../node_modules/@dit/$1'
  },
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};
