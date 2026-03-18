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
		root: ".",
		coverage: {
			enabled: true,
			provider: "v8",
			include: ["src"],
			exclude: ["*.html"],
		},
		projects: [
			{
				test: {
					name: "client",
					include: ["src/client/**/__tests__/*.test.{ts,tsx}"],
					setupFiles: ["test/setup-client.ts"],
					environment: "happy-dom",
				},
			},
			{
				test: {
					name: "server",
					include: ["src/server/**/__tests__/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
		],
	},

	// Oxlint configuration.
	lint: {
		ignorePatterns: ["dist/**", ".yarn"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		plugins: ["import", "jsx-a11y", "node", "promise", "react-perf", "react", "vitest"],
		categories: {
			correctness: "error",
			perf: "error",
			style: "error",
			suspicious: "error",
		},
		rules: {
			"import/prefer-default-export": "off",
			"import/no-named-export": "off",
			"max-statements": "off",
			"no-ternary": "off",
			"react/react-in-jsx-scope": "off",
			"sort-imports": "off",
			"sort-keys": "off",
		},
		overrides: [
			{
				files: ["src/server/**"],
				rules: { "import/no-nodejs-modules": "off" },
			},
		],
	},

	// Oxfmt configuration.
	fmt: {
		sortImports: {
			newlinesBetween: false,
			groups: [
				["value-builtin", "value-external"],
				["value-internal", "value-parent", "value-sibling", "value-index"],
				{ newlinesBetween: true },
				"type-import",
				"unknown",
			],
		},
		useTabs: true,
	},

	// `vp staged` configuration.
	staged: {
		"*": "vp check --fix",
	},
});
