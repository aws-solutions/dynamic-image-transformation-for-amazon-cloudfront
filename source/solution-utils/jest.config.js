module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
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
  setupFiles: ['./test/setJestEnvironmentVariables.ts']
};
