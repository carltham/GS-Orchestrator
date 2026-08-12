module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 10000,
  roots: [
    "<rootDir>",
    "<rootDir>/../testing/or/sft",
    "<rootDir>/../testing/ps/sit",
    "<rootDir>/../testing/sys/sit"
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }]
  }
};
