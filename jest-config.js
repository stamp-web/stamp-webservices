module.exports = {
    "modulePaths": [
        "<rootDir>/src",
        "<rootDir>/node_modules"
    ],
    "moduleFileExtensions": [
        "js",
        "json"
    ],
    "testRegex": "\\.spec\\.js$",
    "testEnvironment": "node",
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
        "src/**/*.js",
        "!**/node_modules/**",
        "!**/test/**"
    ],
    "coverageDirectory": "<rootDir>/coverage",
    "coverageReporters": [
        "json",
        "lcov",
        "html"
    ]
}