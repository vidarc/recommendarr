import { z } from "zod";

interface ParsedRecommendation {
	title: string;
	year: number | undefined;
	mediaType: string;
	synopsis: string | undefined;
}

interface ParsedResponse {
	conversationalText: string;
	recommendations: ParsedRecommendation[];
}

const JSON_BLOCK_REGEX = /```json\s*\n([\s\S]*?)\n```/;
const MATCH_INDEX = 1;
const FULL_MATCH_INDEX = 0;

const recommendationItemSchema = z.object({
	title: z.string(),
	year: z.number().optional(),
	mediaType: z.string(),
	synopsis: z.string().optional(),
});

const parseRecommendations = (response: string): ParsedResponse => {
	const match = JSON_BLOCK_REGEX.exec(response);

	if (!match?.[MATCH_INDEX]) {
		return {
			conversationalText: response,
			recommendations: [],
		};
	}

	const [, jsonStr] = match;
	const conversationalText = response.replace(match[FULL_MATCH_INDEX], "").trim();

	try {
		const result = z.array(recommendationItemSchema).safeParse(JSON.parse(jsonStr));

		if (!result.success) {
			return { conversationalText: response, recommendations: [] };
		}

		const recommendations: ParsedRecommendation[] = result.data.map((item) => ({
			title: item.title,
			year: item.year,
			mediaType: item.mediaType,
			synopsis: item.synopsis,
		}));

		return { conversationalText, recommendations };
	} catch {
		return { conversationalText: response, recommendations: [] };
	}
};

export { parseRecommendations };

export type { ParsedRecommendation, ParsedResponse };
