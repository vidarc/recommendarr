import type { ExclusionContext } from "./library-sync.ts";

interface WatchHistoryItem {
	title: string;
	year: number | undefined;
	type: string;
}

interface BuildSystemPromptOptions {
	watchHistory: WatchHistoryItem[];
	mediaType: string;
	resultCount: number;
	exclusionContext?: ExclusionContext;
}

const formatExclusionTitles = (titles: ExclusionContext["titles"]): string =>
	titles
		.map(
			(item) => `- ${item.title}${item.year ? ` (${String(item.year)})` : ""} [${item.mediaType}]`,
		)
		.join("\n");

const formatPastRecommendations = (recs: ExclusionContext["pastRecommendations"]): string =>
	recs.map((item) => `- ${item.title}${item.year ? ` (${String(item.year)})` : ""}`).join("\n");

const buildExclusionSection = (exclusionContext: ExclusionContext): string => {
	const sections: string[] = [];

	if (
		exclusionContext.summary.topGenres.length > EMPTY_LENGTH ||
		exclusionContext.summary.movieCount > EMPTY_LENGTH ||
		exclusionContext.summary.showCount > EMPTY_LENGTH
	) {
		const { movieCount, showCount, topGenres } = exclusionContext.summary;
		sections.push(
			`Based on the user's library of ${String(movieCount)} movies and ${String(showCount)} shows, their favorite genres are: ${topGenres.join(", ")}. Prioritize recommendations that align with these tastes. Recommend content the user is likely to enjoy based on their library.`,
		);
	}

	if (exclusionContext.titles.length > EMPTY_LENGTH) {
		sections.push(
			`The user already owns the following titles — do NOT recommend any of these:\n${formatExclusionTitles(exclusionContext.titles)}`,
		);
	}

	if (exclusionContext.pastRecommendations.length > EMPTY_LENGTH) {
		sections.push(
			`The following have already been recommended in previous conversations — avoid repeating them unless the user specifically asks:\n${formatPastRecommendations(exclusionContext.pastRecommendations)}`,
		);
	}

	return sections.join("\n\n");
};

const formatWatchHistory = (watchHistory: WatchHistoryItem[]): string => {
	const items = watchHistory
		.map((item) => {
			const yearStr = item.year ? ` (${String(item.year)})` : "";
			return `- ${item.title}${yearStr} [${item.type}]`;
		})
		.join("\n");
	return `The user has watched:\n${items}`;
};

const EMPTY_HISTORY_LENGTH = 0;
const EMPTY_LENGTH = 0;
const NO_HISTORY_MESSAGE =
	"The user has no watch history available. Make general recommendations based on popular and well-regarded titles.";

const buildSystemPrompt = (options: BuildSystemPromptOptions): string => {
	const { watchHistory, mediaType, resultCount, exclusionContext } = options;

	const mediaTypeInstruction =
		mediaType === "either"
			? "Recommend either movies or TV shows (or a mix of both)."
			: `Only recommend ${mediaType}s.`;

	const watchHistorySection =
		watchHistory.length > EMPTY_HISTORY_LENGTH
			? formatWatchHistory(watchHistory)
			: NO_HISTORY_MESSAGE;

	const exclusionSection = exclusionContext ? `\n\n${buildExclusionSection(exclusionContext)}` : "";

	return `You are a media recommendation assistant. Your job is to recommend movies and TV shows based on the user's watch history and preferences.

${watchHistorySection}

${mediaTypeInstruction}${exclusionSection}

When making recommendations, return exactly ${String(resultCount)} recommendations.

You MUST include a JSON block in your response with the recommendations in the following format:

\`\`\`json
[
  { "title": "Movie Title", "year": 2023, "mediaType": "movie", "synopsis": "Brief synopsis." },
  { "title": "Show Title", "year": 2020, "mediaType": "show", "synopsis": "Brief synopsis." }
]
\`\`\`

Include conversational text before and/or after the JSON block explaining your recommendations. The JSON block must be valid JSON wrapped in a markdown code fence.`;
};

export { buildSystemPrompt };

export type { BuildSystemPromptOptions, WatchHistoryItem };
