import { expect, test } from "@playwright/test";

const password = "navtest1234";

test.describe("navigation", () => {
	let username = "";

	test.beforeAll(({}, testInfo) => {
		username = `nav-e2e-${testInfo.project.name}`;
	});

	test.beforeEach(async ({ page }) => {
		// Register or login before each test
		await page.goto("/login");

		// Try to register first (will fail silently if user exists)
		await page.goto("/register");
		const registerButton = page.getByRole("button", { name: /register/i });
		if (await registerButton.isVisible()) {
			await page.getByLabel("Username").fill(username);
			await page.getByLabel("Password", { exact: true }).fill(password);
			await page.getByLabel("Confirm Password").fill(password);
			await registerButton.click();

			// If we get redirected to /, we're registered and logged in
			const url = page.url();
			if (url.endsWith("/")) {
				return;
			}
		}

		// Fall back to login
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();
		await expect(page).toHaveURL("/");
	});

	test("landing page shows Recommendations", async ({ page }) => {
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendations")).toBeVisible();
	});

	test("sidebar Settings link navigates to /settings", async ({ page }) => {
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");
		await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
	});

	test("sidebar History link navigates to /history", async ({ page }) => {
		await page.getByRole("link", { name: "History" }).click();
		await expect(page).toHaveURL("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
	});

	test("sidebar Recommendations link navigates to /", async ({ page }) => {
		// Navigate away first
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");

		// Then navigate back
		await page.getByRole("link", { name: "Recommendations" }).click();
		await expect(page).toHaveURL("/");
	});

	test("unknown route redirects to /", async ({ page }) => {
		await page.goto("/nonexistent-page");
		await expect(page).toHaveURL("/");
	});
});
