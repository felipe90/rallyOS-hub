/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/tests/**/*.spec.ts', '!**/tests/**/security.spec.ts', '!**/tests/**/match-logic.spec.ts', '!**/tests/**/multi-table.spec.ts'],
  rootDir: '.',
};
