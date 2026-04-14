import * as z from "zod/mini";

const MIN_STRING_LENGTH = 1;
const MIN_RESULT_COUNT = 1;
const MAX_RESULT_COUNT = 25;
const DEFAULT_RESULT_COUNT = 5;

const recommendationFeedbackSchema = z.enum(["liked", "disliked"]);

const recommendationSchema = z.object({
	id: z.string(),
	title: z.string(),
	year: z.optional(z.number()),
	mediaType: z.string(),
	synopsis: z.optional(z.string()),
	tmdbId: z.optional(z.number()),
	tvdbId: z.optional(z.number()),
	addedToArr: z.boolean(),
	feedback: z.optional(recommendationFeedbackSchema),
});

const chatMessageSchema = z.object({
	id: z.string(),
	role: z.string(),
	content: z.string(),
	createdAt: z.string(),
	recommendations: z.array(recommendationSchema),
});

const chatRequestSchema = z.object({
	message: z.string().check(z.minLength(MIN_STRING_LENGTH)),
	mediaType: z.string().check(z.minLength(MIN_STRING_LENGTH)),
	resultCount: z._default(
		z.int().check(z.gte(MIN_RESULT_COUNT), z.lte(MAX_RESULT_COUNT)),
		DEFAULT_RESULT_COUNT,
	),
	conversationId: z.optional(z.string()),
	libraryIds: z.optional(z.array(z.string())),
	excludeLibrary: z.optional(z.boolean()),
});

const chatResponseSchema = z.object({
	conversationId: z.string(),
	message: chatMessageSchema,
});

const conversationListItemSchema = z.object({
	id: z.string(),
	mediaType: z.string(),
	title: z.optional(z.string()),
	createdAt: z.string(),
});

const conversationsResponseSchema = z.object({
	conversations: z.array(conversationListItemSchema),
});

const conversationDetailSchema = z.object({
	id: z.string(),
	mediaType: z.string(),
	title: z.optional(z.string()),
	createdAt: z.string(),
	messages: z.array(chatMessageSchema),
});

const feedbackBodySchema = z.object({
	feedback: z.nullable(recommendationFeedbackSchema),
});

const feedbackResponseSchema = z.object({
	id: z.string(),
	feedback: z.nullable(recommendationFeedbackSchema),
});

type RecommendationFeedback = z.infer<typeof recommendationFeedbackSchema>;
type Recommendation = z.infer<typeof recommendationSchema>;
type ChatMessage = z.infer<typeof chatMessageSchema>;
type ChatRequest = z.infer<typeof chatRequestSchema>;
type ChatResponse = z.infer<typeof chatResponseSchema>;
type ConversationListItem = z.infer<typeof conversationListItemSchema>;
type ConversationsResponse = z.infer<typeof conversationsResponseSchema>;
type ConversationDetail = z.infer<typeof conversationDetailSchema>;
type FeedbackBody = z.infer<typeof feedbackBodySchema>;
type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

export {
	chatMessageSchema,
	chatRequestSchema,
	chatResponseSchema,
	conversationDetailSchema,
	conversationListItemSchema,
	conversationsResponseSchema,
	feedbackBodySchema,
	feedbackResponseSchema,
	recommendationFeedbackSchema,
	recommendationSchema,
};

export type {
	ChatMessage,
	ChatRequest,
	ChatResponse,
	ConversationDetail,
	ConversationListItem,
	ConversationsResponse,
	FeedbackBody,
	FeedbackResponse,
	Recommendation,
	RecommendationFeedback,
};
