import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	// Standard Vite configuration for dev/build/preview.
	root: "src/client",
	build: {
		emptyOutDir: true,
		outDir: "../../dist/client",
	},
	plugins: [react()],

	// Vitest configuration.
	test: {
		include: ["src/**/__tests__/*.test.ts"],
		root: ".",
	},

	// Oxlint configuration.
	lint: {
		categories: {
			correctness: "error",
			nursery: "error",
			pedantic: "error",
			perf: "error",
			restriction: "error",
			style: "error",
			suspicious: "error",
		},
		ignorePatterns: ["dist/**", ".yarn"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		plugins: ["import", "jsx-a11y", "node", "promise", "react-perf", "react", "vitest"],
		rules: {
			"sort-keys": "off",
		},
	},

	// Oxfmt configuration.
	fmt: {
		sortImports: {},
		useTabs: true,
	},

	// `vp staged` configuration.
	staged: {
		"*": "vp check --fix",
	},
});
