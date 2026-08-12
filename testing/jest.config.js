module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 10000,
  roots: [
    "<rootDir>",
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '../GS-Orchestrator/tsconfig.json',
      isolatedModules: true
    }]
  }
};