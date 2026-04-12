import { z } from "zod";

const MIN_STRING_LENGTH = 1;
const MIN_RESULT_COUNT = 1;
const MAX_RESULT_COUNT = 25;
const DEFAULT_RESULT_COUNT = 5;

const recommendationFeedbackSchema = z.enum(["liked", "disliked"]);

const recommendationSchema = z.object({
	id: z.string(),
	title: z.string(),
	year: z.number().optional(),
	mediaType: z.string(),
	synopsis: z.string().optional(),
	tmdbId: z.number().optional(),
	addedToArr: z.boolean(),
	feedback: recommendationFeedbackSchema.optional(),
});

const chatMessageSchema = z.object({
	id: z.string(),
	role: z.string(),
	content: z.string(),
	createdAt: z.string(),
	recommendations: z.array(recommendationSchema),
});

const chatRequestSchema = z.object({
	message: z.string().min(MIN_STRING_LENGTH),
	mediaType: z.string().min(MIN_STRING_LENGTH),
	resultCount: z
		.number()
		.int()
		.min(MIN_RESULT_COUNT)
		.max(MAX_RESULT_COUNT)
		.default(DEFAULT_RESULT_COUNT),
	conversationId: z.string().optional(),
	libraryIds: z.array(z.string()).optional(),
	excludeLibrary: z.boolean().optional(),
});

const chatResponseSchema = z.object({
	conversationId: z.string(),
	message: chatMessageSchema,
});

const conversationListItemSchema = z.object({
	id: z.string(),
	mediaType: z.string(),
	title: z.string().optional(),
	createdAt: z.string(),
});

const conversationsResponseSchema = z.object({
	conversations: z.array(conversationListItemSchema),
});

const conversationDetailSchema = z.object({
	id: z.string(),
	mediaType: z.string(),
	title: z.string().optional(),
	createdAt: z.string(),
	messages: z.array(chatMessageSchema),
});

const feedbackBodySchema = z.object({
	feedback: recommendationFeedbackSchema.nullable(),
});

const feedbackResponseSchema = z.object({
	id: z.string(),
	feedback: recommendationFeedbackSchema.nullable(),
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
