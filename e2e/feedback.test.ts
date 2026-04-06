import { z } from "zod";

import { expect, login, sharedPassword, test } from "./fixtures.ts";

import type { Page } from "@playwright/test";

// The AI endpoint is the OpenAI-compatible mock running in the mock-services
// Container at port 4000. This lets the server call a real HTTP endpoint and
// Persist real recommendations in the database, so the PATCH feedback route
// Operates on actual DB rows rather than phantom IDs.
const mockAiEndpoint = "http://mock-services:4000";
const mockAiApiKey = "mock-openai-key";
const mockAiModel = "gpt-4";

const RECOMMENDATION_TITLE = "Blade Runner 2049";

// Zod schemas for API response validation — avoids unsafe type assertions.
const feedbackPatchResponseSchema = z.object({
	id: z.string(),
	feedback: z.enum(["liked", "disliked"]).nullable(),
});

const conversationsResponseSchema = z.object({
	conversations: z.array(z.object({ id: z.string() })),
});

const conversationDetailSchema = z.object({
	messages: z.array(
		z.object({
			recommendations: z.array(
				z.object({
					id: z.string(),
					feedback: z.enum(["liked", "disliked"]).nullable().optional(),
				}),
			),
		}),
	),
});

// Helper: send a chat message and wait for at least one recommendation card.
// Disables "Exclude Library" so past recommendations are not filtered out on
// Repeat calls (the mock always returns the same movie).
const sendMessageAndWaitForRecommendation = async (page: Page) => {
	await page.goto("/");
	const excludeToggle = page.getByRole("checkbox", { name: /on/i });
	if (await excludeToggle.isChecked()) {
		await excludeToggle.click();
	}
	await page
		.getByRole("textbox", { name: /ask for recommendations/i })
		.fill("Recommend me some sci-fi movies");
	await page.getByRole("button", { name: /send/i }).click();
	await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toBeVisible({
		timeout: 15_000,
	});
};

// Helper: wait for the PATCH /api/recommendations/:id/feedback response.
const waitForFeedbackPatch = (page: Page) =>
	page.waitForResponse(
		(resp) => resp.url().includes("/api/recommendations/") && resp.url().includes("/feedback"),
	);

test.describe.configure({ mode: "serial" });

test.describe("recommendation feedback flow", () => {
	// Set up AI config pointing at the mock OpenAI-compatible server.
	// Plex is intentionally skipped — the chat route works without it (returns empty watch history).
	test("configure AI to use mock endpoint", async ({ authenticatedPage: page }) => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(mockAiEndpoint);
		await page.getByLabel("API Key").fill(mockAiApiKey);
		await page.getByLabel("Model Name").fill(mockAiModel);
		await page.getByRole("button", { name: "Save" }).click();

		// Test Connection and Remove buttons appear only after a successful save
		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
	});

	test("thumbs up and thumbs down buttons appear on recommendation cards", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Thumbs down" }).first()).toBeVisible();
	});

	test("recommendation card shows the expected title from the AI mock", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		await expect(page.getByText(RECOMMENDATION_TITLE)).toBeVisible();
	});

	test("thumbs up button starts with aria-pressed false", async ({ authenticatedPage: page }) => {
		await sendMessageAndWaitForRecommendation(page);

		await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	test("thumbs down button starts with aria-pressed false", async ({ authenticatedPage: page }) => {
		await sendMessageAndWaitForRecommendation(page);

		await expect(page.getByRole("button", { name: "Thumbs down" }).first()).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	test("clicking thumbs up sends PATCH with feedback liked", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		const patchPromise = waitForFeedbackPatch(page);
		await page.getByRole("button", { name: "Thumbs up" }).first().click();
		const resp = await patchPromise;

		expect(resp.status()).toBe(200);
		const parsed = feedbackPatchResponseSchema.parse(await resp.json());
		expect(parsed.feedback).toBe("liked");
	});

	test("clicking thumbs up again sends PATCH with null (toggle off)", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		const thumbsUp = page.getByRole("button", { name: "Thumbs up" }).first();

		// First click — like
		const firstPatch = waitForFeedbackPatch(page);
		await thumbsUp.click();
		await firstPatch;

		// Second click on the same button — should clear feedback (null)
		const secondPatch = waitForFeedbackPatch(page);
		await thumbsUp.click();
		const resp = await secondPatch;

		expect(resp.status()).toBe(200);
		const parsed = feedbackPatchResponseSchema.parse(await resp.json());
		expect(parsed.feedback).toBeNull();
	});

	test("clicking thumbs down after thumbs up switches feedback to disliked", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		const thumbsUp = page.getByRole("button", { name: "Thumbs up" }).first();
		const thumbsDown = page.getByRole("button", { name: "Thumbs down" }).first();

		// Like first
		const likePatch = waitForFeedbackPatch(page);
		await thumbsUp.click();
		const likeRespRaw = await likePatch;
		const likeResp = feedbackPatchResponseSchema.parse(await likeRespRaw.json());
		expect(likeResp.feedback).toBe("liked");

		// Then dislike — switches from liked to disliked
		const dislikePatch = waitForFeedbackPatch(page);
		await thumbsDown.click();
		const resp = await dislikePatch;

		expect(resp.status()).toBe(200);
		const parsed = feedbackPatchResponseSchema.parse(await resp.json());
		expect(parsed.feedback).toBe("disliked");
	});

	test("feedback persists in the database after navigating to History", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		// Click thumbs up and capture the recommendation ID from the PATCH response
		const patchPromise = waitForFeedbackPatch(page);
		await page.getByRole("button", { name: "Thumbs up" }).first().click();
		const patchResp = await patchPromise;

		expect(patchResp.status()).toBe(200);
		const { id: recommendationId, feedback: patchedFeedback } = feedbackPatchResponseSchema.parse(
			await patchResp.json(),
		);
		expect(patchedFeedback).toBe("liked");

		// Navigate to History to trigger a page transition
		await page.goto("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();

		// Query the API using the authenticated session cookie to verify DB persistence
		const convListResp = await page.request.get("/api/conversations");
		expect(convListResp.status()).toBe(200);
		const { conversations } = conversationsResponseSchema.parse(await convListResp.json());
		expect(conversations.length).toBeGreaterThan(0);

		const latestConvId = conversations.at(-1)?.id;
		expect(latestConvId).toBeDefined();

		const detailResp = await page.request.get(`/api/conversations/${String(latestConvId)}`);
		expect(detailResp.status()).toBe(200);
		const detail = conversationDetailSchema.parse(await detailResp.json());

		const allRecs = detail.messages.flatMap((msg) => msg.recommendations);
		const likedRec = allRecs.find((rec) => rec.id === recommendationId);
		expect(likedRec).toBeDefined();
		expect(likedRec?.feedback).toBe("liked");
	});

	test("history page lists the conversation after getting recommendations", async ({
		authenticatedPage: page,
	}) => {
		await sendMessageAndWaitForRecommendation(page);

		// Ensure the conversation is created by waiting for a feedback action
		const patchPromise = waitForFeedbackPatch(page);
		await page.getByRole("button", { name: "Thumbs up" }).first().click();
		await patchPromise;

		await page.goto("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();

		// The conversation should appear in the list (title is generated by the AI mock)
		const convRow = page.getByRole("button", {
			name: /Sci-Fi Recommendations|Untitled/i,
		});
		await expect(convRow.first()).toBeVisible({ timeout: 5000 });
	});

	// Clean up AI config so other test suites start with a clean slate.
	// Uses afterAll so cleanup runs even when earlier tests fail.
	test.afterAll(async ({ browser }, workerInfo) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		const username = `admin-${workerInfo.project.name}`;
		await login(page, username, sharedPassword);

		await page.goto("/settings");
		await page.getByRole("tab", { name: "AI Configuration" }).click();

		const removeButton = page.getByRole("button", { name: "Remove" });
		if (await removeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
			await removeButton.click();
		}

		await context.close();
	});
});
