import { expect, test } from "./fixtures.ts";

test.describe("navigation", () => {
	test("landing page shows Recommendations", async ({ authenticatedPage: page }) => {
		await expect(page).toHaveURL("/");
		await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
	});

	test("sidebar Settings link navigates to /settings", async ({ authenticatedPage: page }) => {
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");
		await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
	});

	test("sidebar History link navigates to /history", async ({ authenticatedPage: page }) => {
		await page.getByRole("link", { name: "History" }).click();
		await expect(page).toHaveURL("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
	});

	test("sidebar Recommendations link navigates back to /", async ({ authenticatedPage: page }) => {
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");

		await page.getByRole("link", { name: "Recommendations" }).click();
		await expect(page).toHaveURL("/");
	});

	test("unknown route redirects to /", async ({ authenticatedPage: page }) => {
		await page.goto("/nonexistent-page");
		await expect(page).toHaveURL("/");
	});
});
