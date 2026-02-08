module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '@solana-eda/(.*)': '<rootDir>/../$1/src',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        verbatimModuleSyntax: false,
      },
    },
  },
};
