interface WatchHistoryItem {
	title: string;
	year: number | undefined;
	type: string;
}

interface BuildSystemPromptOptions {
	watchHistory: WatchHistoryItem[];
	mediaType: string;
	resultCount: number;
}

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
const NO_HISTORY_MESSAGE =
	"The user has no watch history available. Make general recommendations based on popular and well-regarded titles.";

const buildSystemPrompt = (options: BuildSystemPromptOptions): string => {
	const { watchHistory, mediaType, resultCount } = options;

	const mediaTypeInstruction =
		mediaType === "either"
			? "Recommend either movies or TV shows (or a mix of both)."
			: `Only recommend ${mediaType}s.`;

	const watchHistorySection =
		watchHistory.length > EMPTY_HISTORY_LENGTH
			? formatWatchHistory(watchHistory)
			: NO_HISTORY_MESSAGE;

	return `You are a media recommendation assistant. Your job is to recommend movies and TV shows based on the user's watch history and preferences.

${watchHistorySection}

${mediaTypeInstruction}

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
