import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
	// Standard Vite configuration for dev/build/preview.
	root: "src/client",
	build: {
		emptyOutDir: true,
		outDir: "../../dist/client",
	},
	plugins: [
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		wyw({
			babelOptions: { presets: ["@babel/preset-typescript"] },
			ssrDevCss: true,
		}),
	],

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
		plugins: [
			"eslint",
			"import",
			"jsx-a11y",
			"node",
			"promise",
			"react-perf",
			"react",
			"typescript",
			"unicorn",
			"vitest",
		],
		categories: {
			correctness: "error",
			perf: "error",
			style: "error",
			suspicious: "error",
		},
		rules: {
			"eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
			"import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
			"import/prefer-default-export": "off",
			"import/no-named-export": "off",
			"max-statements": "off",
			"no-ternary": "off",
			"react/only-export-components": "error",
			"react/react-in-jsx-scope": "off",
			"sort-imports": "off",
			"sort-keys": "off",
			"unicorn/filename-case": [
				"error",
				{
					cases: {
						kebabCase: true,
						pascalCase: true,
					},
				},
			],
		},
		overrides: [
			{
				files: ["src/server/**"],
				rules: { "import/no-nodejs-modules": "off" },
			},
			{
				files: ["e2e/**"],
				rules: {
					"import/no-nodejs-modules": "off",
					"vitest/require-hook": "off",
					"no-magic-numbers": "off",
					"new-cap": "off",
				},
			},
		],
	},

	// Oxfmt configuration.
	fmt: {
		sortImports: {
			newlinesBetween: true,
			groups: [
				"value-builtin",
				"value-external",
				["value-internal", "value-parent", "value-sibling", "value-index"],
				"type-import",
				["style", "side_effect", "side_effect_style"],
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
