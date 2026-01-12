const jestConfig = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: './',
  moduleNameMapper: {
    '^src/(.*)': ['<rootDir>/src/$1'],
    '^test/(.*)': ['<rootDir>/test/$1'],
    '@eppo(.*)': '<rootDir>/node_modules/@eppo/$1',
  },
  testRegex: '.*\\..*spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.{ts,js}'],
  coverageDirectory: 'coverage/',
  testEnvironment: 'node',
};

export default jestConfig;
