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
});
