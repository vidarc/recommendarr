import { describe, expect, test } from "vite-plus/test";

import {
	filterExcludedRecommendations,
	parseRecommendations,
} from "../services/response-parser.ts";

const FIRST_INDEX = 0;
const EXPECTED_REC_COUNT = 2;
const SINGLE_RESULT = 1;
const TRIPLE_REC_COUNT = 3;

describe("response parser", () => {
	test("extracts recommendations from AI response with JSON block", () => {
		const response = `Here are some great movies!

\`\`\`json
[
  { "title": "The Matrix", "year": 1999, "mediaType": "movie", "synopsis": "A hacker discovers reality is a simulation." },
  { "title": "Blade Runner", "year": 1982, "mediaType": "movie", "synopsis": "A detective hunts rogue androids." }
]
\`\`\`

Enjoy!`;
		const result = parseRecommendations(response);
		expect(result.conversationalText).toContain("great movies");
		expect(result.recommendations).toHaveLength(EXPECTED_REC_COUNT);
		expect(result.recommendations[FIRST_INDEX]?.title).toBe("The Matrix");
	});

	test("returns empty recommendations when no JSON block found", () => {
		const result = parseRecommendations("Just a regular message.");
		expect(result.recommendations).toHaveLength(FIRST_INDEX);
		expect(result.conversationalText).toBe("Just a regular message.");
	});

	test("handles malformed JSON gracefully", () => {
		const response = `Here are recs:

\`\`\`json
[{ invalid json }]
\`\`\``;
		const result = parseRecommendations(response);
		expect(result.recommendations).toHaveLength(FIRST_INDEX);
	});

	test("strips JSON block from conversational text", () => {
		const response = `Before text.

\`\`\`json
[{ "title": "Test", "year": 2020, "mediaType": "movie", "synopsis": "Test." }]
\`\`\`

After text.`;
		const result = parseRecommendations(response);
		expect(result.conversationalText).toContain("Before text.");
		expect(result.conversationalText).toContain("After text.");
		expect(result.conversationalText).not.toContain("```json");
	});
});

describe("filterExcludedRecommendations", () => {
	const matrix = { title: "The Matrix", year: 1999, mediaType: "movie", synopsis: "A hacker." };
	const inception = { title: "Inception", year: 2010, mediaType: "movie", synopsis: "Dreams." };
	const blade = { title: "Blade Runner", year: 1982, mediaType: "movie", synopsis: "Androids." };

	test("filters out recs matching library by title and year", () => {
		const result = filterExcludedRecommendations([matrix, inception], {
			libraryTitles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
			pastRecommendations: [],
		});
		expect(result.kept).toHaveLength(SINGLE_RESULT);
		expect(result.kept[FIRST_INDEX]?.title).toBe("Inception");
		expect(result.filtered).toHaveLength(SINGLE_RESULT);
		expect(result.filtered[FIRST_INDEX]?.title).toBe("The Matrix");
	});

	test("uses case-insensitive title matching", () => {
		const result = filterExcludedRecommendations([matrix], {
			libraryTitles: [{ title: "the matrix", year: 1999, mediaType: "movie" }],
			pastRecommendations: [],
		});
		expect(result.kept).toHaveLength(FIRST_INDEX);
		expect(result.filtered).toHaveLength(SINGLE_RESULT);
	});

	test("matches title only when year is missing from either side", () => {
		const recNoYear = {
			title: "Blade Runner",
			year: undefined,
			mediaType: "movie",
			synopsis: undefined,
		};
		const result = filterExcludedRecommendations([recNoYear], {
			libraryTitles: [{ title: "Blade Runner", year: 1982, mediaType: "movie" }],
			pastRecommendations: [],
		});
		expect(result.kept).toHaveLength(FIRST_INDEX);
		expect(result.filtered).toHaveLength(SINGLE_RESULT);
	});

	test("filters out recs matching past recommendations", () => {
		const result = filterExcludedRecommendations([blade, inception], {
			libraryTitles: [],
			pastRecommendations: [{ title: "Blade Runner", year: 1982 }],
		});
		expect(result.kept).toHaveLength(SINGLE_RESULT);
		expect(result.kept[FIRST_INDEX]?.title).toBe("Inception");
		expect(result.filtered[FIRST_INDEX]?.title).toBe("Blade Runner");
	});

	test("keeps all recs when no matches found", () => {
		const result = filterExcludedRecommendations([matrix, inception, blade], {
			libraryTitles: [{ title: "Interstellar", year: 2014, mediaType: "movie" }],
			pastRecommendations: [{ title: "Dune", year: 2021 }],
		});
		expect(result.kept).toHaveLength(TRIPLE_REC_COUNT);
		expect(result.filtered).toHaveLength(FIRST_INDEX);
	});
});
