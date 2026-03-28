import { expect, test } from "@playwright/test";

const password = "aitest1234";
const testEndpoint = "https://api.openai.com/v1";
const testApiKey = "sk-test-key-1234567890abcdef";
const testModel = "gpt-4";

test.describe.configure({ mode: "serial" });

test.describe("AI configuration settings flow", () => {
	let username = "";

	test.beforeAll(({}, testInfo) => {
		username = `ai-e2e-${testInfo.project.name}`;
	});

	test("register user for AI config tests", async ({ page }) => {
		await page.goto("/register");

		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByLabel("Confirm Password").fill(password);
		await page.getByRole("button", { name: /register/i }).click();

		await expect(page).toHaveURL("/");
	});

	test("navigate to Settings > AI Configuration tab", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await expect(page.getByRole("heading", { level: 3, name: "AI Configuration" })).toBeVisible();
	});

	test("fill in AI config and save", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(testEndpoint);
		await page.getByLabel("API Key").fill(testApiKey);
		await page.getByLabel("Model Name").fill(testModel);

		await page.getByRole("button", { name: "Save" }).click();

		// After saving, Test Connection and Remove buttons should appear
		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
	});

	test("advanced settings are accessible", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByText("Show Advanced Settings").click();

		await expect(page.getByText("Temperature")).toBeVisible();
		await expect(page.getByText("Max Tokens")).toBeVisible();
	});

	test("test connection shows success message", async ({ page }) => {
		// Browser-mock the AI test endpoint since OpenAI SDK is not simple REST
		await page.route("/api/ai/test", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		});

		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Test Connection" }).click();

		await expect(page.getByText("Connection successful")).toBeVisible();
	});

	test("remove AI config clears fields", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Remove" }).click();

		// After removal, Test Connection and Remove should be gone
		await expect(page.getByRole("button", { name: "Test Connection" })).not.toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" })).not.toBeVisible();
	});
});
