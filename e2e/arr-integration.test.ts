import { expect, test } from "@playwright/test";

// NOTE: The add-to-arr modal flow (opening the modal, selecting quality profile/root folder,
// And submitting) is covered by unit tests in
// Src/client/components/__tests__/AddToArrModal.test.tsx.
// Testing it via E2E would require AI chat to generate recommendations first,
// Which involves complex Plex + AI mocking out of scope for this test suite.

const adminPassword = "arradmin1234";
const radarrUrl = "http://mock-services:7878";
const radarrApiKey = "testradarrapikey1234";

test.describe.configure({ mode: "serial" });

test.describe("arr integration settings flow", () => {
	let adminUsername = "";

	test.beforeAll(({}, testInfo) => {
		adminUsername = `arr-e2e-${testInfo.project.name}`;
	});

	test("register user for arr integration tests", async ({ page }) => {
		await page.goto("/register");

		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password", { exact: true }).fill(adminPassword);
		await page.getByLabel("Confirm Password").fill(adminPassword);
		await page.getByRole("button", { name: /register/i }).click();

		await expect(page).toHaveURL("/");
	});

	test("navigate to Settings > Integrations tab", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");

		await page.goto("/settings");
		await page.getByRole("button", { name: "Integrations" }).click();

		await expect(page.getByRole("heading", { level: 3, name: "Radarr" })).toBeVisible();
		await expect(page.getByRole("heading", { level: 3, name: "Sonarr" })).toBeVisible();
	});

	test("fill in Radarr URL and API Key and save", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "Integrations" }).click();

		await page.getByLabel("Radarr URL").fill(radarrUrl);
		await page.getByLabel("Radarr API Key").fill(radarrApiKey);

		await page.getByRole("button", { name: "Save" }).first().click();

		// After saving, the Test Connection and Remove buttons should appear
		// Because the connection is now stored
		await expect(page.getByRole("button", { name: "Test Connection" }).first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();
	});

	test("test Radarr connection shows success message", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "Integrations" }).click();

		// The connection was saved in the previous test, so Test Connection should be visible.
		// This now exercises the full server path: auth → DB → decrypt → arr-client → mock Radarr.
		await page.getByRole("button", { name: "Test Connection" }).first().click();

		await expect(page.getByText(/Connection successful/)).toBeVisible();
		await expect(page.getByText("5.3.6")).toBeVisible();
	});

	test("remove Radarr connection hides Test Connection button", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "Integrations" }).click();

		await page.getByRole("button", { name: "Remove" }).first().click();

		// After removal, Test Connection and Remove buttons should be gone
		// (Only the Save button remains in the disconnected state)
		await expect(page.getByRole("button", { name: "Test Connection" }).first()).not.toBeVisible();
	});
});
