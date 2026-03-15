import { defineConfig } from "vite-plus";

export default defineConfig({
	// Standard Vite configuration for dev/build/preview.
	plugins: [],

	// Vitest configuration.
	test: {
		include: ["src/**/*.test.ts"],
	},

	// Oxlint configuration.
	lint: {
		ignorePatterns: ["dist/**"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},

	// Oxfmt configuration.
	fmt: {
		useTabs: true,
		sortImports: {},
	},

	// `vp staged` configuration.
	staged: {
		"*": "vp check --fix",
	},
});
