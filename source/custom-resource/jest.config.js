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
  ],
  setupFiles: ['./test/setJestEnvironmentVariables.ts', './test/setupJestMocks.ts']
};
