import type { ExclusionContext } from "./library-sync.ts";

interface WatchHistoryItem {
	title: string;
	year: number | undefined;
	type: string;
}

interface FeedbackItem {
	title: string;
	year: number | undefined;
	mediaType: string;
	feedback: "liked" | "disliked";
}

interface BuildSystemPromptOptions {
	watchHistory: WatchHistoryItem[];
	mediaType: string;
	resultCount: number;
	exclusionContext?: ExclusionContext;
	feedbackContext?: FeedbackItem[];
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

const formatFeedbackTitle = (item: FeedbackItem): string =>
	`${item.title}${item.year ? ` (${String(item.year)})` : ""}`;

const buildFeedbackSection = (feedbackContext: FeedbackItem[]): string => {
	if (feedbackContext.length === EMPTY_LENGTH) {
		return "";
	}

	const liked = feedbackContext.filter((item) => item.feedback === "liked");
	const disliked = feedbackContext.filter((item) => item.feedback === "disliked");

	const sections: string[] = ["The user has provided feedback on past recommendations:"];

	if (liked.length > EMPTY_LENGTH) {
		sections.push(`Liked: ${liked.map(formatFeedbackTitle).join(", ")}`);
	}

	if (disliked.length > EMPTY_LENGTH) {
		sections.push(`Disliked: ${disliked.map(formatFeedbackTitle).join(", ")}`);
	}

	sections.push(
		"Use this feedback to inform your recommendations. Suggest more content similar to liked items and avoid content similar to disliked items.",
	);

	return sections.join("\n");
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
	const { watchHistory, mediaType, resultCount, exclusionContext, feedbackContext } = options;

	const mediaTypeInstruction =
		mediaType === "either"
			? "Recommend either movies or TV shows (or a mix of both)."
			: `Only recommend ${mediaType}s.`;

	const watchHistorySection =
		watchHistory.length > EMPTY_HISTORY_LENGTH
			? formatWatchHistory(watchHistory)
			: NO_HISTORY_MESSAGE;

	const exclusionSection = exclusionContext ? `\n\n${buildExclusionSection(exclusionContext)}` : "";
	const feedbackSection =
		feedbackContext && feedbackContext.length > EMPTY_LENGTH
			? `\n\n${buildFeedbackSection(feedbackContext)}`
			: "";

	return `You are a media recommendation assistant. Your job is to recommend movies and TV shows based on the user's watch history and preferences.

${watchHistorySection}

${mediaTypeInstruction}${exclusionSection}${feedbackSection}

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

export type { BuildSystemPromptOptions, FeedbackItem, WatchHistoryItem };
