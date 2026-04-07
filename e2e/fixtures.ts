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
		// StorageState already has valid session cookies — just verify auth works
		const me = await page.request.get("/api/auth/me");
		if (!me.ok()) {
			throw new Error("storageState session is invalid — re-run setup");
		}
		await use(page);
	},
});

export { expect, test };
