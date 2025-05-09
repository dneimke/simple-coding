module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/assets/**',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['lcov', 'text', 'clover'],
    coverageThreshold: {
        global: {
            statements: 30,
            branches: 30,
            functions: 30,
            lines: 30
        }
    }
};
