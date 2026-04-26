import * as z from "zod/mini";

import { expect, test } from "./fixtures.ts";

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
	feedback: z.nullable(z.enum(["liked", "disliked"])),
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
					feedback: z.optional(z.nullable(z.enum(["liked", "disliked"]))),
				}),
			),
		}),
	),
});

// Helper: wait for the PATCH /api/recommendations/:id/feedback response.
const waitForFeedbackPatch = (page: Page) =>
	page.waitForResponse(
		(resp) => resp.url().includes("/api/recommendations/") && resp.url().includes("/feedback"),
	);

test.describe.configure({ mode: "serial" });

test.describe("recommendation feedback flow", () => {
	// Shared page across all serial tests — avoids re-sending the chat message
	// For every test (previously 8 AI round-trips, now just 1).
	// eslint-disable-next-line init-declarations -- initialized in beforeAll
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
		page = await context.newPage();
	});

	test.afterAll(async () => {
		// Guard against beforeAll failure leaving page uninitialized
		if (!page) {
			return;
		}

		// Clean up AI config via API (faster and more reliable than UI navigation).
		// The shared page has valid session cookies from storageState.
		await page.request.delete("/api/ai/config");
		await page.context().close();
	});

	// Set up AI config pointing at the mock OpenAI-compatible server.
	// Plex is intentionally skipped — the chat route works without it (returns empty watch history).
	test("configure AI to use mock endpoint", async () => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(mockAiEndpoint);
		await page.getByLabel("API Key").fill(mockAiApiKey);
		await page.getByLabel("Model Name").fill(mockAiModel);
		await page.getByRole("button", { name: "Save" }).click();

		// Test Connection and Remove buttons appear only after a successful save
		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
	});

	// Send one chat message — all subsequent tests reuse this page with the recommendation visible.
	test("send message and get recommendation", async () => {
		await page.goto("/");
		await page.getByRole("button", { name: "Filters" }).click();
		const excludeToggle = page.getByRole("switch", { name: /exclude watched/i });
		if (await excludeToggle.isChecked()) {
			await excludeToggle.click();
		}
		await page.keyboard.press("Escape");
		await page
			.getByRole("textbox", { name: /ask for recommendations/i })
			.fill("Recommend me some sci-fi movies");
		await page.getByRole("button", { name: /send/i }).click();
		await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toBeVisible({
			timeout: 15_000,
		});
	});

	test("recommendation card shows the expected title from the AI mock", async () => {
		await expect(page.getByText(RECOMMENDATION_TITLE)).toBeVisible();
	});

	test("thumbs up and thumbs down buttons appear on recommendation cards", async () => {
		await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Thumbs down" }).first()).toBeVisible();
	});

	test("thumbs up button starts with aria-pressed false", async () => {
		await expect(page.getByRole("button", { name: "Thumbs up" }).first()).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	test("thumbs down button starts with aria-pressed false", async () => {
		await expect(page.getByRole("button", { name: "Thumbs down" }).first()).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	test("clicking thumbs up sends PATCH with feedback liked", async () => {
		const patchPromise = waitForFeedbackPatch(page);
		await page.getByRole("button", { name: "Thumbs up" }).first().click();
		const resp = await patchPromise;

		expect(resp.status()).toBe(200);
		const parsed = feedbackPatchResponseSchema.parse(await resp.json());
		expect(parsed.feedback).toBe("liked");
	});

	test("clicking thumbs up again sends PATCH with null (toggle off)", async () => {
		// Previous test left thumbs-up active — clicking again should clear it
		const patchPromise = waitForFeedbackPatch(page);
		await page.getByRole("button", { name: "Thumbs up" }).first().click();
		const resp = await patchPromise;

		expect(resp.status()).toBe(200);
		const parsed = feedbackPatchResponseSchema.parse(await resp.json());
		expect(parsed.feedback).toBeNull();
	});

	test("clicking thumbs down after thumbs up switches feedback to disliked", async () => {
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

	test("feedback persists in the database after navigating to History", async () => {
		// Previous test left feedback as "disliked" — click thumbs up to set "liked"
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

	test("history page lists the conversation after getting recommendations", async () => {
		await page.goto("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();

		// The conversation should appear in the list (title is generated by the AI mock)
		const convRow = page.getByRole("button", {
			name: /Sci-Fi Recommendations|Untitled/i,
		});
		await expect(convRow.first()).toBeVisible({ timeout: 5000 });
	});
});
