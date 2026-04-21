import { metadataStatusResponseSchema } from "../src/shared/schemas/metadata.ts";
import { expect, test } from "./fixtures.ts";

import type { Page } from "@playwright/test";

// Uses the mock OpenAI-compatible server for recommendation generation and the
// Mock TMDB/TVDB servers for metadata enrichment. Both are wired through
// Docker-compose env vars (TMDB_API_KEY/TMDB_API_BASE_URL/TVDB_API_KEY/TVDB_API_BASE_URL).
const mockAiEndpoint = "http://mock-services:4000";
const mockAiApiKey = "mock-openai-key";
const mockAiModel = "gpt-4";

const RECOMMENDATION_TITLE = "Blade Runner 2049";

test.describe.configure({ mode: "serial" });

test.describe("metadata enrichment flow", () => {
	// eslint-disable-next-line init-declarations -- initialized in beforeAll
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
		page = await context.newPage();
	});

	test.afterAll(async () => {
		if (!page) {
			return;
		}
		// Clean up AI config via API so subsequent test files start fresh
		await page.request.delete("/api/ai/config");
		await page.context().close();
	});

	test("metadata status endpoint reports both sources configured", async () => {
		const response = await page.request.get("/api/metadata/status");
		expect(response.status()).toBe(200);
		const body = metadataStatusResponseSchema.parse(await response.json());
		expect(body.tvdb).toBe(true);
		expect(body.tmdb).toBe(true);
	});

	test("configure AI to use mock endpoint", async () => {
		await page.goto("/settings");
		await page.getByRole("tab", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(mockAiEndpoint);
		await page.getByLabel("API Key").fill(mockAiApiKey);
		await page.getByLabel("Model Name").fill(mockAiModel);
		await page.getByRole("button", { name: "Save" }).click();

		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
	});

	test("send message and get recommendation with metadata available", async () => {
		await page.goto("/");
		const excludeToggle = page.getByRole("checkbox", { name: /exclude library/i });
		if (await excludeToggle.isChecked()) {
			await excludeToggle.click();
		}
		await page
			.getByRole("textbox", { name: /ask for recommendations/i })
			.fill("Recommend me some sci-fi movies");

		// Wait for the chat response so WebKit has time to render the card before asserting
		const chatResponsePromise = page.waitForResponse(
			(resp) => resp.url().includes("/api/chat") && resp.request().method() === "POST",
		);
		await page.getByRole("button", { name: /send/i }).click();
		const chatResponse = await chatResponsePromise;
		expect(chatResponse.status()).toBe(200);

		// Wait for the loading bubble to disappear before asserting the card.
		// WebKit is slow to flush React updates after the mutation resolves; this gives it
		// A deterministic signal that the messages state has been updated.
		await expect(page.getByRole("status", { name: /loading/i })).not.toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByText(RECOMMENDATION_TITLE)).toBeVisible({ timeout: 15_000 });

		// With TMDB_API_KEY configured, the "Show more info" button should render
		await expect(page.getByRole("button", { name: "Show more info" }).first()).toBeVisible();
	});

	test("clicking 'Show more info' fetches TMDB metadata and displays it", async () => {
		const showMore = page.getByRole("button", { name: "Show more info" }).first();

		// Wait for the metadata fetch so we know the panel is populated before asserting
		const metadataResponse = page.waitForResponse(
			(resp) => resp.url().includes("/api/metadata/") && resp.request().method() === "GET",
		);
		await showMore.click();
		const resp = await metadataResponse;
		expect(resp.status()).toBe(200);

		// Overview from the mock TMDB server
		await expect(page.getByText(/Thirty years after the events of the first film/i)).toBeVisible();

		// Genre badges
		await expect(page.getByText("Science Fiction", { exact: true })).toBeVisible();
		await expect(page.getByText("Drama", { exact: true })).toBeVisible();

		// Rating line (mock returns 7.5)
		await expect(page.getByText(/Rating: 7\.5/)).toBeVisible();

		// Poster <img> points at the real image CDN host (browser may 404 the
		// Asset; we only care that the element is rendered with the expected src)
		const poster = page.getByRole("img", { name: /Blade Runner 2049 poster/i });
		await expect(poster).toHaveAttribute("src", /image\.tmdb\.org/);
	});

	test("clicking 'Show cast & crew' reveals cast and crew from TMDB mock", async () => {
		await page.getByRole("button", { name: "Show cast & crew" }).first().click();

		// Cast members from the mock TMDB credits response
		await expect(page.getByText(/Ryan Gosling as K/)).toBeVisible();
		await expect(page.getByText(/Harrison Ford as Rick Deckard/)).toBeVisible();

		// Crew line combines names and roles
		await expect(page.getByText(/Denis Villeneuve \(Director\)/)).toBeVisible();
	});

	// Note: server-side cache behavior is covered by
	// Src/server/__tests__/metadata.test.ts ("returns cached metadata on second request").
	// We intentionally don't e2e-test the cache by navigating away and back, because
	// The Recommendations page doesn't yet load a conversation from the URL, so there's
	// No reliable way to re-open a conversation in-browser without reloading state we'd
	// Have to rebuild from scratch. Adding that flow is a separate follow-up.
});
