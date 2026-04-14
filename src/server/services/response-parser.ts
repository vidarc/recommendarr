import * as z from "zod/mini";

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
	year: z.optional(z.number()),
	mediaType: z.string(),
	synopsis: z.optional(z.string()),
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

interface FilterInput {
	libraryTitles: { title: string; year?: number; mediaType: string }[];
	pastRecommendations: { title: string; year?: number }[];
}

interface FilterResult {
	kept: ParsedRecommendation[];
	filtered: ParsedRecommendation[];
}

interface TitleMatchInput {
	titleA: string;
	titleB: string;
	yearA: number | undefined;
	yearB: number | undefined;
}

const titlesMatch = ({ titleA, titleB, yearA, yearB }: TitleMatchInput): boolean => {
	const titleMatch = titleA.trim().toLowerCase() === titleB.trim().toLowerCase();
	if (!titleMatch) {
		return false;
	}
	if (yearA === undefined || yearB === undefined) {
		return true;
	}
	return yearA === yearB;
};

const filterExcludedRecommendations = (
	recs: ParsedRecommendation[],
	filter: FilterInput,
): FilterResult => {
	const kept: ParsedRecommendation[] = [];
	const filtered: ParsedRecommendation[] = [];

	for (const rec of recs) {
		const matchesLibrary = filter.libraryTitles.some((lib) =>
			titlesMatch({ titleA: rec.title, titleB: lib.title, yearA: rec.year, yearB: lib.year }),
		);
		const matchesPast = filter.pastRecommendations.some((past) =>
			titlesMatch({ titleA: rec.title, titleB: past.title, yearA: rec.year, yearB: past.year }),
		);

		if (matchesLibrary || matchesPast) {
			filtered.push(rec);
		} else {
			kept.push(rec);
		}
	}

	return { kept, filtered };
};

export { filterExcludedRecommendations, parseRecommendations };

export type { FilterInput, FilterResult, ParsedRecommendation, ParsedResponse };
