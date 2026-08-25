/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // Real-DB integration tests (src/tests/integration/) run separately via
  // `npm run test:integration` (jest.integration.config.js) — they need a
  // live Postgres and shouldn't slow down or break the default fast/mocked
  // suite when it's run without one.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/tests/integration/"],
  transform: {
    "^.+\\.tsx?$": "babel-jest",
  },
  clearMocks: true,
};
