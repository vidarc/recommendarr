import { expect, test } from "@playwright/test";

const adminPassword = "admin1234";

test.describe.configure({ mode: "serial" });

test.describe("admin login flow", () => {
	let adminUsername = "";

	test.beforeAll((_fixtures, testInfo) => {
		adminUsername = `admin-${testInfo.project.name}`;
	});

	test("fresh app redirects to register page", async ({ page }) => {
		// A fresh database has no users, so visiting / should redirect to /register
		await page.goto("/");
		await expect(page).toHaveURL(/\/register/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register");
	});

	test("register first admin user", async ({ page }) => {
		await page.goto("/register");

		// Fill in the registration form
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password", { exact: true }).fill(adminPassword);
		await page.getByLabel("Confirm Password").fill(adminPassword);
		await page.getByRole("button", { name: /register/i }).click();

		// After registering (first user = admin), we should land on the main app
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendarr")).toBeVisible();
	});

	test("can log out and log back in", async ({ page }) => {
		// Log in via the login page
		await page.goto("/login");
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		// Should land on the main app
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendarr")).toBeVisible();

		// Log out via the sidebar button
		await page.getByRole("button", { name: /log out/i }).click();

		// Should be redirected to login
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Login");

		// Log back in
		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill(adminPassword);
		await page.getByRole("button", { name: /log in/i }).click();

		// Should land on the main app again
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendarr")).toBeVisible();
	});

	test("login with wrong credentials shows error", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Username").fill(adminUsername);
		await page.getByLabel("Password").fill("wrongpassword");
		await page.getByRole("button", { name: /log in/i }).click();

		// Should show error message and stay on login page
		await expect(page.getByText("Invalid username or password")).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});
});
