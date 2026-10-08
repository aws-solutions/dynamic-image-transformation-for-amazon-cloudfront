module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts',
    '!**/test/**',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', ['lcov', { projectRoot: '../' }]],
  setupFiles: ['./test/setJestEnvironmentVariables.ts', './test/setupJestMocks.ts']
};
