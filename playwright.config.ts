import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";
const ciRetries = 2;
const noRetries = 0;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env["CI"]),
	retries: process.env["CI"] ? ciRetries : noRetries,
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
