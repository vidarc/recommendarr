import { describe, expect, it } from "vite-plus/test";

import { buildCastCrewSection, buildSystemPrompt } from "../services/prompt-builder.ts";

import type { CastCrewContextItem } from "../services/prompt-builder.ts";

describe("prompt builder", () => {
	it("builds system prompt with watch history and constraints", () => {
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

	it("handles empty watch history", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "either",
			resultCount: 10,
		});
		expect(prompt).toContain("10");
		expect(prompt).toBeDefined();
	});

	it("includes media type constraint for shows", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "show",
			resultCount: 3,
		});
		expect(prompt).toContain("Only recommend shows");
	});

	it("includes either instruction for mixed media type", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "either",
			resultCount: 5,
		});
		expect(prompt).toContain("either movies or TV shows");
	});

	it("includes library taste profile when exclusion context provided", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			exclusionContext: {
				titles: [
					{ title: "The Matrix", year: 1999, mediaType: "movie" },
					{ title: "Inception", year: 2010, mediaType: "movie" },
				],
				summary: {
					movieCount: 50,
					showCount: 20,
					topGenres: ["Sci-Fi", "Action", "Drama"],
				},
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

	it("omits exclusion sections when no exclusion context", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
		});
		expect(prompt).not.toContain("do NOT recommend");
		expect(prompt).not.toContain("already been recommended");
	});

	it("handles exclusion context with no past recommendations", () => {
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

	it("includes feedback context when provided", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			feedbackContext: [
				{
					title: "The Matrix",
					year: 1999,
					mediaType: "movie",
					feedback: "liked",
				},
				{
					title: "Twilight",
					year: 2008,
					mediaType: "movie",
					feedback: "disliked",
				},
				{
					title: "Inception",
					year: 2010,
					mediaType: "movie",
					feedback: "liked",
				},
			],
		});
		expect(prompt).toContain("The Matrix (1999)");
		expect(prompt).toContain("Inception (2010)");
		expect(prompt).toContain("Twilight (2008)");
		expect(prompt).toContain("Liked:");
		expect(prompt).toContain("Disliked:");
		expect(prompt).toContain("feedback");
	});

	it("omits feedback section when feedbackContext is empty", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			feedbackContext: [],
		});
		expect(prompt).not.toContain("Liked:");
		expect(prompt).not.toContain("Disliked:");
	});

	it("omits feedback section when feedbackContext is undefined", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
		});
		expect(prompt).not.toContain("Liked:");
	});

	it("handles feedback context with only liked items", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			feedbackContext: [
				{
					title: "The Matrix",
					year: 1999,
					mediaType: "movie",
					feedback: "liked",
				},
			],
		});
		expect(prompt).toContain("Liked:");
		expect(prompt).not.toContain("Disliked:");
	});

	it("handles feedback context with only disliked items", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "movie",
			resultCount: 5,
			feedbackContext: [
				{
					title: "Twilight",
					year: 2008,
					mediaType: "movie",
					feedback: "disliked",
				},
			],
		});
		expect(prompt).not.toContain("Liked:");
		expect(prompt).toContain("Disliked:");
	});
});

describe(buildCastCrewSection, () => {
	it("formats cast and crew metadata into prompt section", () => {
		const items: CastCrewContextItem[] = [
			{
				title: "Inception",
				year: 2010,
				cast: [
					{ name: "Leonardo DiCaprio", role: "Actor", character: "Cobb" },
					{ name: "Joseph Gordon-Levitt", role: "Actor", character: "Arthur" },
				],
				crew: [{ name: "Christopher Nolan", role: "Director", character: undefined }],
			},
		];
		const result = buildCastCrewSection(items);
		expect(result).toContain("Leonardo DiCaprio");
		expect(result).toContain("Christopher Nolan");
		expect(result).toContain("Director");
		expect(result).toContain("Inception");
	});

	it("returns empty string for empty items", () => {
		const result = buildCastCrewSection([]);
		expect(result).toBe("");
	});
});
