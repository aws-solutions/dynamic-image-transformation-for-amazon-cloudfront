module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  coverageReporters: [
    'text',
    ['lcov', { 'projectRoot': '../' }]
  ],
  setupFiles: ['./test/setJestEnvironmentVariables.ts']
};
