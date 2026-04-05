import { expect, test } from "./fixtures.ts";

const mockPlexUrl = "http://mock-services:9090";
const mockServerName = "E2E Plex Server";
const mockAuthToken = "e2e-plex-token-abc123";

test.describe.configure({ mode: "serial" });

test.describe("plex connection settings flow", () => {
	test("navigate to Settings and verify Plex tab is default", async ({
		authenticatedPage: page,
	}) => {
		await page.goto("/settings");

		await expect(page.getByRole("heading", { level: 3, name: "Plex Connection" })).toBeVisible();

		// Clean up any leftover Plex connection from a previous failed serial run
		const disconnectButton = page.getByRole("button", { name: "Disconnect" });
		if (await disconnectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
			await disconnectButton.click();
		}

		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});

	test("expand manual connection and fill in details", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");

		await page.getByText("Show Manual Connection").click();

		await page.getByLabel("Auth Token").fill(mockAuthToken);
		await page.getByLabel("Server URL").fill(mockPlexUrl);
		await page.getByLabel("Server Name").fill(mockServerName);

		await page.getByRole("button", { name: "Connect", exact: true }).click();

		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("connection persists after navigation", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");

		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("disconnect Plex returns to not-connected state", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");

		await page.getByRole("button", { name: "Disconnect" }).click();

		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});
});
