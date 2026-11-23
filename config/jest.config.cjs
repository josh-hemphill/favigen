module.exports = {
	rootDir: '..',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/tests/**/*.test.ts'],
	moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: {
			module: 'CommonJS', moduleResolution: 'node10', ignoreDeprecations: '6.0',
		} }],
	},
	coverageReporters: ['text-summary', 'lcov'],
};
