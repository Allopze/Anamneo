const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['<rootDir>/src/__tests__/setup.ts', '\\.fixtures\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  maxWorkers: 4,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  workerIdleMemoryLimit: '512MB',
};

module.exports = createJestConfig(config);
