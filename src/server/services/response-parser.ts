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
		const parsed = JSON.parse(jsonStr) as Array<{
			title: string;
			year?: number;
			mediaType: string;
			synopsis?: string;
		}>;

		if (!Array.isArray(parsed)) {
			return { conversationalText: response, recommendations: [] };
		}

		const recommendations: ParsedRecommendation[] = parsed.map((item) => ({
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
