import { expect, test } from "@playwright/test";

const adminUsername = "admin";
const adminPassword = "admin1234";

test.describe.configure({ mode: "serial" });

test.describe("admin login flow", () => {
	test("fresh app redirects to register page", async ({ page }) => {
		// A fresh database has no users, so visiting / should redirect to /register
		await page.goto("/");
		await expect(page).toHaveURL(/\/register/);
		await expect(page.locator("h1")).toHaveText("Register");
	});

	test("register first admin user", async ({ page }) => {
		await page.goto("/register");

		// Fill in the registration form
		await page.locator("#username").fill(adminUsername);
		await page.locator("#password").fill(adminPassword);
		await page.locator("#confirmPassword").fill(adminPassword);
		await page.locator('button[type="submit"]').click();

		// After registering (first user = admin), we should land on the main app
		await expect(page).toHaveURL("/");
		await expect(page.locator("text=Recommendarr")).toBeVisible();
	});

	test("can log out and log back in", async ({ page }) => {
		// Log in via the login page
		await page.goto("/login");
		await page.locator("#username").fill(adminUsername);
		await page.locator("#password").fill(adminPassword);
		await page.locator('button[type="submit"]').click();

		// Should land on the main app
		await expect(page).toHaveURL("/");
		await expect(page.locator("text=Recommendarr")).toBeVisible();

		// Log out via the sidebar button
		await page.locator("text=Log out").click();

		// Should be redirected to login
		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator("h1")).toHaveText("Login");

		// Log back in
		await page.locator("#username").fill(adminUsername);
		await page.locator("#password").fill(adminPassword);
		await page.locator('button[type="submit"]').click();

		// Should land on the main app again
		await expect(page).toHaveURL("/");
		await expect(page.locator("text=Recommendarr")).toBeVisible();
	});

	test("login with wrong credentials shows error", async ({ page }) => {
		await page.goto("/login");

		await page.locator("#username").fill(adminUsername);
		await page.locator("#password").fill("wrongpassword");
		await page.locator('button[type="submit"]').click();

		// Should show error message and stay on login page
		await expect(page.locator("text=Invalid username or password")).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});
});
