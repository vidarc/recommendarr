import { describe, expect, test } from "vite-plus/test";

import { parseRecommendations } from "../services/response-parser.ts";

const FIRST_INDEX = 0;
const EXPECTED_REC_COUNT = 2;

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
