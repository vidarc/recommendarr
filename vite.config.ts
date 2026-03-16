import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	// Standard Vite configuration for dev/build/preview.
	root: "src/client",
	build: {
		outDir: "../../dist/client",
		emptyOutDir: true,
	},
	plugins: [react()],

	// Vitest configuration.
	test: {
		root: ".",
		include: ["src/**/__tests__/*.test.ts"],
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
