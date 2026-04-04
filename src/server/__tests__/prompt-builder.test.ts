import { describe, expect, test } from "vite-plus/test";

import { buildSystemPrompt } from "../services/prompt-builder.ts";

describe("prompt builder", () => {
	test("builds system prompt with watch history and constraints", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [
				{ title: "Inception", year: 2010, type: "movie" },
				{ title: "Breaking Bad", year: 2008, type: "show" },
			],
			mediaType: "movie",
			resultCount: 5,
		});
		expect(prompt).toContain("Inception");
		expect(prompt).toContain("5");
		expect(prompt).toContain("movie");
		expect(prompt).toContain("JSON");
	});

	test("handles empty watch history", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "either",
			resultCount: 10,
		});
		expect(prompt).toContain("10");
		expect(prompt).toBeDefined();
	});

	test("includes media type constraint for shows", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "show",
			resultCount: 3,
		});
		expect(prompt).toContain("Only recommend shows");
	});

	test("includes either instruction for mixed media type", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "either",
			resultCount: 5,
		});
		expect(prompt).toContain("either movies or TV shows");
	});

	test("includes library taste profile when exclusion context provided", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			exclusionContext: {
				titles: [
					{ title: "The Matrix", year: 1999, mediaType: "movie" },
					{ title: "Inception", year: 2010, mediaType: "movie" },
				],
				summary: { movieCount: 50, showCount: 20, topGenres: ["Sci-Fi", "Action", "Drama"] },
				pastRecommendations: [{ title: "Blade Runner", year: 1982 }],
			},
		});
		expect(prompt).toContain("50 movies");
		expect(prompt).toContain("20 shows");
		expect(prompt).toContain("Sci-Fi");
		expect(prompt).toContain("do NOT recommend");
		expect(prompt).toContain("The Matrix (1999)");
		expect(prompt).toContain("Inception (2010)");
		expect(prompt).toContain("Blade Runner (1982)");
	});

	test("omits exclusion sections when no exclusion context", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
		});
		expect(prompt).not.toContain("do NOT recommend");
		expect(prompt).not.toContain("already been recommended");
	});

	test("handles exclusion context with no past recommendations", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			exclusionContext: {
				titles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
				summary: { movieCount: 1, showCount: 0, topGenres: ["Sci-Fi"] },
				pastRecommendations: [],
			},
		});
		expect(prompt).toContain("do NOT recommend");
		expect(prompt).not.toContain("already been recommended");
	});
});
