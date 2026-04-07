import { expect, test } from "./fixtures.ts";

const mockPlexUrl = "http://mock-services:9090";
const mockServerName = "E2E Plex Server";
const mockAuthToken = "e2e-plex-token-abc123";

test.describe.configure({ mode: "serial" });

test.describe("library settings flow", () => {
	test("set up Plex connection for library sync", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");

		// If already connected from a previous failed serial run, skip setup
		const alreadyConnected = await page
			.getByText(mockServerName)
			.isVisible({ timeout: 3000 })
			.catch(() => false);
		if (alreadyConnected) {
			return;
		}

		await page.getByText("Show Manual Connection").click();
		await page.getByLabel("Auth Token").fill(mockAuthToken);
		await page.getByLabel("Server URL").fill(mockPlexUrl);
		await page.getByLabel("Server Name").fill(mockServerName);
		await page.getByRole("button", { name: "Connect", exact: true }).click();
		await expect(page.getByText(mockServerName)).toBeVisible();
	});

	test("navigate to Library tab and see initial state", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "Library" }).click();

		await expect(page.getByRole("heading", { level: 3, name: "Library Sync" })).toBeVisible();
		await expect(page.getByRole("heading", { level: 3, name: "Preferences" })).toBeVisible();
		await expect(page.getByText("Never synced")).toBeVisible();
	});

	test("sync library and see results", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "Library" }).click();

		await page.getByRole("button", { name: "Sync Now" }).click();

		await expect(page.getByText(/Synced successfully/)).toBeVisible();
	});

	test("sync status updates after sync", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "Library" }).click();

		await expect(page.getByText("Never synced")).not.toBeVisible();
		await expect(page.getByText(/Last synced:/)).toBeVisible();
		await expect(page.getByText(/cached/)).toBeVisible();
	});

	test("change preferences and save", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "Library" }).click();

		// Wait for status data to load before interacting — the useEffect that
		// Hydrates local form state from the API fires after the fetch resolves.
		// Without this, WebKit can overwrite our selections when the effect runs.
		await expect(page.getByText(/Last synced:/)).toBeVisible();

		await page.locator("#sync-interval").selectOption("24h");
		await expect(page.locator("#sync-interval")).toHaveValue("24h");

		const excludeCheckbox = page.locator("#exclude-default");
		const isChecked = await excludeCheckbox.isChecked();
		await excludeCheckbox.click();

		// Wait for save API response before reloading
		const saveResponse = page.waitForResponse((resp) =>
			resp.url().includes("/api/library/settings"),
		);
		await page.getByRole("button", { name: "Save" }).click();
		await saveResponse;

		// Reload and verify persistence
		await page.goto("/settings");
		await page.getByRole("tab", { name: "Library" }).click();

		await expect(page.locator("#sync-interval")).toHaveValue("24h");
		const newChecked = await page.locator("#exclude-default").isChecked();
		expect(newChecked).toBe(!isChecked);
	});

	// Clean up Plex connection via API so other test suites start with a clean slate.
	// Uses afterAll so cleanup runs even when earlier tests fail.
	test.afterAll(async ({ browser }) => {
		const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
		const page = await context.newPage();
		await page.request.delete("/api/plex/connection");
		await context.close();
	});
});
