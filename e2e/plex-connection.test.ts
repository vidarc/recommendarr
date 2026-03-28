import { expect, test } from "@playwright/test";

const password = "plextest1234";
const mockPlexUrl = "http://mock-services:9090";
const mockServerName = "E2E Plex Server";
const mockAuthToken = "e2e-plex-token-abc123";

test.describe.configure({ mode: "serial" });

test.describe("plex connection settings flow", () => {
	let username = "";

	test.beforeAll((_fixtures, testInfo) => {
		username = `plex-e2e-${testInfo.project.name}`;
	});

	test("register user for plex connection tests", async ({ page }) => {
		await page.goto("/register");

		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByLabel("Confirm Password").fill(password);
		await page.getByRole("button", { name: /register/i }).click();

		await expect(page).toHaveURL("/");
	});

	test("navigate to Settings and verify Plex tab is default", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await expect(page.getByRole("heading", { level: 3, name: "Plex Connection" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});

	test("expand manual connection and fill in details", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await page.getByText("Show Manual Connection").click();

		await page.getByLabel("Auth Token").fill(mockAuthToken);
		await page.getByLabel("Server URL").fill(mockPlexUrl);
		await page.getByLabel("Server Name").fill(mockServerName);

		// Click the Connect button inside the manual connection section
		await page.getByRole("button", { name: "Connect" }).click();

		// Should transition to connected state showing the server name
		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("connection persists after navigation", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");

		// Navigate to settings
		await page.goto("/settings");

		// Should still show connected state
		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("disconnect Plex returns to not-connected state", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await page.getByRole("button", { name: "Disconnect" }).click();

		// Should return to not-connected state
		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});
});
