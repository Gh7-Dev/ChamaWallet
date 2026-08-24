module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Force in-memory mode for all tests regardless of .env
  setupFiles: ['<rootDir>/jest.setup.js'],
  // stellar-sdk v16 pulls in ESM-only packages (@noble/ed25519, uint8array-extras).
  // Allow ts-jest to transform them; use [\\/] so the pattern matches on Windows.
  // moduleNameMapper redirects the nested ESM @noble/hashes to the top-level CJS copy.
  transformIgnorePatterns: [
    '[\\\\/]node_modules[\\\\/](?!(@noble[\\\\/]ed25519|uint8array-extras)[\\\\/])',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
    '^.+\\.js$': ['ts-jest', { diagnostics: false }],
  },
  moduleNameMapper: {
    '^@noble/hashes/(.+)$': '<rootDir>/node_modules/@noble/hashes/$1',
  },
};
