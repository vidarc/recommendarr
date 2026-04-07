import { test as base, expect } from "@playwright/test";

import type { Page } from "@playwright/test";

interface AuthFixtures {
	authenticatedPage: Page;
}

/**
 * Extends Playwright's base test with an `authenticatedPage` fixture.
 * Authentication is handled by storageState (set in playwright.config.ts),
 * so this fixture just ensures the session is valid — no login round-trip needed.
 */
const test = base.extend<AuthFixtures>({
	authenticatedPage: async ({ page }, use) => {
		// StorageState already has valid session cookies — navigate to "/" so
		// The page has content (sidebar, etc.) before the test interacts with it.
		// Using domcontentloaded avoids stalling on background API requests.
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await use(page);
	},
});

export { expect, test };
