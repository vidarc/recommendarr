import { expect, test } from "./fixtures.ts";

const testEndpoint = "https://api.openai.com/v1";
const testApiKey = "sk-test-key-1234567890abcdef";
const testModel = "gpt-4";

test.describe.configure({ mode: "serial" });

test.describe("AI configuration settings flow", () => {
	test("navigate to Settings > AI Configuration tab", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await expect(page.getByRole("heading", { level: 3, name: "AI Configuration" })).toBeVisible();
	});

	test("fill in AI config and save", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(testEndpoint);
		await page.getByLabel("API Key").fill(testApiKey);
		await page.getByLabel("Model Name").fill(testModel);

		await page.getByRole("button", { name: "Save" }).click();

		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
	});

	test("advanced settings are accessible", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByText("Show Advanced Settings").click();

		await expect(page.getByText("Temperature")).toBeVisible();
		await expect(page.getByText("Max Tokens")).toBeVisible();
	});

	test("test connection shows success message", async ({ authenticatedPage: page }) => {
		// Browser-mock the AI test endpoint since OpenAI SDK is not simple REST
		await page.route("/api/ai/test", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		});

		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Test Connection" }).click();

		await expect(page.getByText("Connection successful")).toBeVisible();
	});

	test("remove AI config clears fields", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Remove" }).click();

		await expect(page.getByRole("button", { name: "Remove" })).not.toBeVisible();
		// Save and Test Connection buttons remain visible in the disconnected state
		await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
	});
});
