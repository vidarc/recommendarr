import { expect, test } from "@playwright/test";

import { adminPassword, adminUsername } from "./constants.ts";

test.describe("login flows", () => {
	test("can log in and log out", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendarr")).toBeVisible();

		// Log out via the sidebar button
		await page.getByRole("button", { name: /log out/i }).click();

		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Login");

		// Log back in to verify round-trip
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendarr")).toBeVisible();
	});

	test("login with wrong credentials shows error", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill("wrongpassword");
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page.getByText("Invalid username or password")).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});
});
