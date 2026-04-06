import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";
const ciRetries = 2;
const noRetries = 0;
const isCI = Boolean(process.env["CI"]);
const ciTimeout = 60_000;
const localTimeout = 30_000;
const defaultExpectTimeout = 5000;
const ciExpectTimeout = 10_000;

const storageState = "e2e/.auth/user.json";

// Workers must stay at 1 because test files share a single-user DB:
// - ai-config.test.ts  <->  feedback.test.ts    (both modify AI config)
// - plex-connection.test.ts  <->  library-settings.test.ts  (both modify Plex connection)
// To increase workers, merge conflicting pairs into single serial files
// Or give each file its own isolated user (requires multi-user registration).

const testIgnore = [/auth\.setup\.ts/, /admin-login\.test\.ts/];

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
		// Phase 1: Register user and save authenticated storageState
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},

		// Phase 2: Auth flow tests (no storageState — they test login/logout itself)
		{
			name: "auth-tests",
			testMatch: /admin-login\.test\.ts/,
			dependencies: ["setup"],
			use: { ...devices["Desktop Chrome"] },
		},

		// Phase 2: Main test suites per browser (use storageState, skip auth overhead)
		{
			name: "chromium",
			dependencies: ["setup"],
			testIgnore,
			use: { ...devices["Desktop Chrome"], storageState },
		},
		{
			name: "firefox",
			dependencies: ["setup"],
			testIgnore,
			use: { ...devices["Desktop Firefox"], storageState },
		},
		{
			name: "webkit",
			dependencies: ["setup"],
			testIgnore,
			use: { ...devices["Desktop Safari"], storageState },
		},
	],
});
