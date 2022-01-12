module.exports = {
    "modulePaths": [
        "<rootDir>/app",
        "<rootDir>/node_modules"
    ],
    "moduleFileExtensions": [
        "js",
        "json"
    ],
    "testRegex": "/test/*/.*-test.js$",
    "testEnvironment": "node",
    "testTimeout": 10000,
    "collectCoverage": true,
    "reporters": [
        "default",
        [
            "jest-junit",
            {
                "outputDirectory": "test/junit",
                "outputName": "TESTS.xml"
            }
        ]
    ],
    "collectCoverageFrom": [
        "app/**/*.js",
        "!**/node_modules/**",
        "!**/test/**"
    ],
    "coverageDirectory": "<rootDir>/coverage",
    "coverageReporters": [
        "json",
        "lcov",
        "html",
        "cobertura"
    ]
}