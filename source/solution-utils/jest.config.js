module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }]
  ],
  setupFiles: ['./test/setJestEnvironmentVariables.ts']
};
