import { test as base, expect } from "@playwright/test";

import { adminPassword, adminUsername } from "./constants.ts";

import type { Page } from "@playwright/test";

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
 * Authentication is handled by storageState (set in playwright.config.ts),
 * so this fixture just ensures the page is ready — no login round-trip needed.
 */
const test = base.extend<AuthFixtures>({
	testPassword: [adminPassword, { option: true }],
	testUsername: [adminUsername, { option: true }],

	authenticatedPage: async ({ page }, use) => {
		// StorageState already has valid session cookies — just navigate to verify
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle");
		await use(page);
	},
});

export { adminPassword, adminUsername, expect, login, test };
