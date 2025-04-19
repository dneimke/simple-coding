module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['js'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    collectCoverage: true,
    collectCoverageFrom: ['utils.js'],
    coverageDirectory: 'coverage',
};
