import * as z from "zod/mini";

import { expect, test } from "./fixtures.ts";

const chatRequestBodySchema = z.object({
	message: z.string(),
	mediaType: z.string(),
});

const mockAiEndpoint = "http://mock-services:4000";
const mockAiApiKey = "mock-openai-key";
const mockAiModel = "gpt-4";

test.describe.configure({ mode: "serial" });

test.describe("B2 chat-input filter + send flow", () => {
	test("configure AI to use mock endpoint", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "AI Configuration" }).click();
		await page.getByLabel("Endpoint URL").fill(mockAiEndpoint);
		await page.getByLabel("API Key").fill(mockAiApiKey);
		await page.getByLabel("Model Name").fill(mockAiModel);
		await page.getByRole("button", { name: "Save" }).click();
		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
	});

	test("composes genres and text into the outbound /api/chat request", async ({
		authenticatedPage: page,
	}) => {
		await page.goto("/");

		await page.getByRole("button", { name: "Filters" }).click();
		await page.getByRole("radio", { name: "TV Shows" }).click();
		await page.keyboard.press("Escape");

		await page.getByRole("button", { name: "Genres" }).click();
		await page.getByRole("button", { name: /thriller, not selected/i }).click();
		await page.getByRole("button", { name: /comedy, not selected/i }).click();
		await page.getByRole("button", { name: /comedy, currently included/i }).click();

		await page.getByRole("textbox", { name: /ask for recommendations/i }).fill("something quiet");

		const chatPromise = page.waitForRequest(
			(req) => req.url().includes("/api/chat") && req.method() === "POST",
		);
		await page.getByRole("button", { name: /apply \+ send/i }).click();
		const chatRequest = await chatPromise;

		const body = chatRequestBodySchema.parse(chatRequest.postDataJSON());
		expect(body.mediaType).toBe("tv");
		expect(body.message).toBe("Include: thriller. Exclude: comedy. something quiet");

		await expect(page.getByRole("textbox", { name: /ask for recommendations/i })).toHaveValue("");
		await expect(page.getByRole("button", { name: "Genres" })).toHaveText("# Genres");
	});

	test("clean up AI config", async ({ authenticatedPage: page }) => {
		await page.request.delete("/api/ai/config");
	});
});
