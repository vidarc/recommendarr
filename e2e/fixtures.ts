import { test as base, expect } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Set of usernames that have been registered in the current worker.
 * Since each browser project gets a fresh Docker container (clean DB),
 * we only need to track registrations within a single worker process.
 */
const registeredUsers = new Set<string>();

const registerAndLogin = async (page: Page, username: string, password: string) => {
	if (!registeredUsers.has(username)) {
		await page.goto("/register");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByLabel("Confirm Password").fill(password);
		await page.getByRole("button", { name: /register/i }).click();

		try {
			await expect(page).toHaveURL("/");
			registeredUsers.add(username);
			return;
		} catch {
			// User may already exist from a prior attempt — fall through to login.
		}
	}

	await page.goto("/login");
	await page.getByLabel("Username").fill(username);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: /log in/i }).click();
	await expect(page).toHaveURL("/");
	registeredUsers.add(username);
};

interface AuthFixtures {
	authenticatedPage: Page;
	testUsername: string;
	testPassword: string;
}

/**
 * Extends Playwright's base test with an `authenticatedPage` fixture.
 * Each test file gets a unique username based on the test file name and browser project.
 * The first test in a serial suite registers the user; subsequent tests log in.
 */
const test = base.extend<AuthFixtures>({
	testPassword: ["e2epassword1234", { option: true }],

	testUsername: [
		async ({}, use, testInfo) => {
			const suiteName = testInfo.titlePath[0] ?? "default";
			const slug = suiteName.toLowerCase().replace(/\s+/g, "-").slice(0, 20);
			const username = `${slug}-${testInfo.project.name}`;
			await use(username);
		},
		{ scope: "test" },
	],

	authenticatedPage: async ({ page, testUsername, testPassword }, use) => {
		await registerAndLogin(page, testUsername, testPassword);
		await use(page);
	},
});

export { expect, test };
