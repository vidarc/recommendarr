import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";
const ciRetries = 2;
const noRetries = 0;
const isCI = Boolean(process.env["CI"]);
const ciTimeout = 60_000;
const localTimeout = 30_000;
const defaultExpectTimeout = 5000;
const ciExpectTimeout = 10_000;

export default defineConfig({
	testDir: "./e2e",
	workers: 1,
	timeout: isCI ? ciTimeout : localTimeout,
	expect: { timeout: isCI ? ciExpectTimeout : defaultExpectTimeout },
	forbidOnly: isCI,
	retries: isCI ? ciRetries : noRetries,
	reporter: [["line"], ["html"]],
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
	],
});
