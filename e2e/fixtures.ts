import { test as base, expect } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Shared credentials matching admin-login.test.ts.
 * Tests run with workers: 1, so admin-login (alphabetically first) always
 * registers the user before other test files need to log in.
 */
const sharedPassword = "admin1234";

const LOGIN_TIMEOUT = 15_000;

const login = async (page: Page, username: string, password: string) => {
	await page.goto("/login", { waitUntil: "domcontentloaded" });
	await page.getByLabel("Username").fill(username);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: /log in/i }).click();
	await expect(page).toHaveURL("/", { timeout: LOGIN_TIMEOUT });
	await page.waitForLoadState("networkidle");
};

interface AuthFixtures {
	authenticatedPage: Page;
	testUsername: string;
	testPassword: string;
}

/**
 * Extends Playwright's base test with an `authenticatedPage` fixture.
 * All test files share the same user (created by admin-login.test.ts).
 * Since tests run serially (workers: 1), the user is guaranteed to exist.
 */
const test = base.extend<AuthFixtures>({
	testPassword: [sharedPassword, { option: true }],

	testUsername: [
		async ({}, use, testInfo) => {
			const username = `admin-${testInfo.project.name}`;
			await use(username);
		},
		{ scope: "test" },
	],

	authenticatedPage: async ({ page, testUsername, testPassword }, use) => {
		await login(page, testUsername, testPassword);
		await use(page);
	},
});

export { expect, test };
