/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/tests/integration/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "babel-jest",
  },
  testTimeout: 30000,
};
