import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { aiConfigs, conversations, messages, plexConnections, recommendations } from "../schema.ts";
import { chatCompletion } from "../services/ai-client.ts";
import { decrypt } from "../services/encryption.ts";
import { getWatchHistory } from "../services/plex-api.ts";
import { buildSystemPrompt } from "../services/prompt-builder.ts";
import { parseRecommendations } from "../services/response-parser.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const MIN_STRING_LENGTH = 1;
const MIN_RESULT_COUNT = 1;
const MAX_RESULT_COUNT = 25;
const DEFAULT_RESULT_COUNT = 5;
const MAX_TITLE_WORDS = 6;
const NO_PRIOR_MESSAGES = 0;
const MAX_TITLE_MESSAGE_LENGTH = 200;
const EMPTY_ARRAY_LENGTH = 0;
const STRING_START = 0;

const errorResponseSchema = z.object({
	error: z.string(),
});

const successResponseSchema = z.object({
	success: z.boolean(),
});

const recommendationSchema = z.object({
	id: z.string(),
	title: z.string(),
	year: z.number().optional(),
	mediaType: z.string(),
	synopsis: z.string().optional(),
	tmdbId: z.number().optional(),
	addedToArr: z.boolean(),
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
});

const chatResponseSchema = z.object({
	conversationId: z.string(),
	message: z.string(),
	recommendations: z.array(recommendationSchema),
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

const messageSchema = z.object({
	id: z.string(),
	role: z.string(),
	content: z.string(),
	createdAt: z.string(),
	recommendations: z.array(recommendationSchema),
});

const conversationDetailSchema = z.object({
	id: z.string(),
	mediaType: z.string(),
	title: z.string().optional(),
	createdAt: z.string(),
	messages: z.array(messageSchema),
});

const chatRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/api/chat",
		{
			schema: {
				body: chatRequestSchema,
				response: {
					[StatusCodes.OK]: chatResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
					[StatusCodes.INTERNAL_SERVER_ERROR]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { message, mediaType, resultCount, conversationId, libraryIds } = request.body;
			const userId = request.user.id;

			// Get AI config
			const aiConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();

			if (!aiConfig) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No AI configuration found" });
			}

			// Get Plex connection
			const plexConnection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			// Create or fetch conversation
			const now = new Date().toISOString();
			const activeConversationId = await resolveConversation({
				app,
				conversationId,
				userId,
				mediaType,
				now,
				reply,
			});

			if (!activeConversationId) {
				return;
			}

			// Save user message
			const userMessageId = randomUUID();
			app.db
				.insert(messages)
				.values({
					id: userMessageId,
					conversationId: activeConversationId,
					role: "user",
					content: message,
					createdAt: now,
				})
				.run();

			// Fetch watch history from Plex
			const watchHistory = plexConnection?.serverUrl
				? await getWatchHistoryItems(plexConnection, libraryIds)
				: [];

			// Build system prompt
			const systemPrompt = buildSystemPrompt({
				watchHistory,
				mediaType,
				resultCount,
			});

			// Fetch conversation history
			const conversationMessages = app.db
				.select()
				.from(messages)
				.where(eq(messages.conversationId, activeConversationId))
				.all();

			// Build messages for AI
			const aiMessages = [
				{ role: "system" as const, content: systemPrompt },
				...conversationMessages.map((msg) => ({
					role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
					content: msg.content,
				})),
			];

			// Call AI
			const decryptedKey = decrypt(aiConfig.apiKey);
			const aiResponse = await chatCompletion(
				{
					endpointUrl: aiConfig.endpointUrl,
					apiKey: decryptedKey,
					modelName: aiConfig.modelName,
					temperature: aiConfig.temperature,
					maxTokens: aiConfig.maxTokens,
				},
				aiMessages,
			);

			// Parse response
			const parsed = parseRecommendations(aiResponse);

			// Save assistant message
			const assistantMessageId = randomUUID();
			app.db
				.insert(messages)
				.values({
					id: assistantMessageId,
					conversationId: activeConversationId,
					role: "assistant",
					content: aiResponse,
					createdAt: new Date().toISOString(),
				})
				.run();

			// Save recommendations
			const savedRecommendations = parsed.recommendations.map((rec) => {
				const recId = randomUUID();
				app.db
					.insert(recommendations)
					.values({
						id: recId,
						messageId: assistantMessageId,
						title: rec.title,
						year: rec.year,
						mediaType: rec.mediaType,
						synopsis: rec.synopsis,
						addedToArr: false,
					})
					.run();

				return {
					id: recId,
					title: rec.title,
					year: rec.year,
					mediaType: rec.mediaType,
					synopsis: rec.synopsis,
					tmdbId: undefined,
					addedToArr: false,
				};
			});

			// Generate title if first user message in conversation
			const userMessageCount = conversationMessages.filter((msg) => msg.role === "user").length;
			if (userMessageCount === NO_PRIOR_MESSAGES && !conversationId) {
				try {
					const titleResponse = await chatCompletion(
						{
							endpointUrl: aiConfig.endpointUrl,
							apiKey: decryptedKey,
							modelName: aiConfig.modelName,
							temperature: aiConfig.temperature,
							maxTokens: aiConfig.maxTokens,
						},
						[
							{
								role: "system",
								content: `Generate a short title (${String(MAX_TITLE_WORDS)} words max) for a conversation about media recommendations. Return ONLY the title, no quotes or punctuation.`,
							},
							{
								role: "user",
								content: message
									.slice(STRING_START, MAX_TITLE_MESSAGE_LENGTH)
									.replaceAll(/[^\w\s.,!?'"-]/gu, ""),
							},
						],
					);

					const title = titleResponse.trim();
					app.db
						.update(conversations)
						.set({ title })
						.where(eq(conversations.id, activeConversationId))
						.run();
				} catch {
					// Title generation is non-critical, continue without it
				}
			}

			return reply.code(StatusCodes.OK).send({
				conversationId: activeConversationId,
				message: parsed.conversationalText,
				recommendations: savedRecommendations,
			});
		},
	);

	typedApp.get(
		"/api/conversations",
		{
			schema: {
				response: {
					[StatusCodes.OK]: conversationsResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const userConversations = app.db
				.select()
				.from(conversations)
				.where(eq(conversations.userId, request.user.id))
				.all();

			return reply.code(StatusCodes.OK).send({
				conversations: userConversations.map((conv) => ({
					id: conv.id,
					mediaType: conv.mediaType,
					title: conv.title ?? undefined,
					createdAt: conv.createdAt,
				})),
			});
		},
	);

	typedApp.get(
		"/api/conversations/:id",
		{
			schema: {
				params: z.object({ id: z.string() }),
				response: {
					[StatusCodes.OK]: conversationDetailSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const conversation = app.db
				.select()
				.from(conversations)
				.where(eq(conversations.id, request.params.id))
				.get();

			if (!conversation || conversation.userId !== request.user.id) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
			}

			const conversationMessages = app.db
				.select()
				.from(messages)
				.where(eq(messages.conversationId, conversation.id))
				.all();

			const messageIds = conversationMessages.map((msg) => msg.id);
			const allRecs =
				messageIds.length > EMPTY_ARRAY_LENGTH
					? app.db
							.select()
							.from(recommendations)
							.where(inArray(recommendations.messageId, messageIds))
							.all()
					: [];

			const recsByMessageId = new Map<string, typeof allRecs>();
			for (const rec of allRecs) {
				const existing = recsByMessageId.get(rec.messageId) ?? [];
				existing.push(rec);
				recsByMessageId.set(rec.messageId, existing);
			}

			const messagesWithRecs = conversationMessages.map((msg) => {
				const msgRecs = recsByMessageId.get(msg.id) ?? [];

				return {
					id: msg.id,
					role: msg.role,
					content: msg.content,
					createdAt: msg.createdAt,
					recommendations: msgRecs.map((rec) => ({
						id: rec.id,
						title: rec.title,
						year: rec.year ?? undefined,
						mediaType: rec.mediaType,
						synopsis: rec.synopsis ?? undefined,
						tmdbId: rec.tmdbId ?? undefined,
						addedToArr: rec.addedToArr,
					})),
				};
			});

			return reply.code(StatusCodes.OK).send({
				id: conversation.id,
				mediaType: conversation.mediaType,
				title: conversation.title ?? undefined,
				createdAt: conversation.createdAt,
				messages: messagesWithRecs,
			});
		},
	);

	typedApp.delete(
		"/api/conversations/:id",
		{
			schema: {
				params: z.object({ id: z.string() }),
				response: {
					[StatusCodes.OK]: successResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const conversation = app.db
				.select()
				.from(conversations)
				.where(eq(conversations.id, request.params.id))
				.get();

			if (!conversation || conversation.userId !== request.user.id) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
			}

			// Cascade delete: recommendations -> messages -> conversation
			app.sqlite.transaction(() => {
				const conversationMessages = app.db
					.select()
					.from(messages)
					.where(eq(messages.conversationId, conversation.id))
					.all();

				for (const msg of conversationMessages) {
					app.db.delete(recommendations).where(eq(recommendations.messageId, msg.id)).run();
				}

				app.db.delete(messages).where(eq(messages.conversationId, conversation.id)).run();
				app.db.delete(conversations).where(eq(conversations.id, conversation.id)).run();
			})();

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);
};

interface PlexConnectionRow {
	authToken: string;
	serverUrl: string | null;
}

const EMPTY_LENGTH = 0;

interface ResolveConversationOptions {
	app: FastifyInstance;
	conversationId: string | undefined;
	userId: string;
	mediaType: string;
	now: string;
	reply: { code: (code: number) => { send: (body: { error: string }) => void } };
}

const resolveConversation = async (
	options: ResolveConversationOptions,
): Promise<string | undefined> => {
	const { app, conversationId, userId, mediaType, now } = options;

	if (conversationId) {
		const existing = app.db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.get();

		if (!existing || existing.userId !== userId) {
			options.reply.code(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
			return undefined;
		}

		if (existing.mediaType !== mediaType) {
			app.db
				.update(conversations)
				.set({ mediaType })
				.where(eq(conversations.id, conversationId))
				.run();
		}

		return conversationId;
	}

	const newId = randomUUID();
	app.db
		.insert(conversations)
		.values({
			id: newId,
			userId,
			mediaType,
			createdAt: now,
		})
		.run();

	return newId;
};

const mapWatchedItem = (item: {
	title: string;
	type: string;
	year: number | undefined;
	grandparentTitle: string | undefined;
}) => ({
	title: item.grandparentTitle ?? item.title,
	year: item.year,
	type: item.type === "episode" ? "show" : item.type,
});

const getWatchHistoryItems = async (
	plexConnection: PlexConnectionRow,
	libraryIds: string[] | undefined,
): Promise<{ title: string; year: number | undefined; type: string }[]> => {
	if (!plexConnection.serverUrl) {
		return [];
	}

	const authToken = decrypt(plexConnection.authToken);

	if (libraryIds && libraryIds.length > EMPTY_LENGTH) {
		const allItems = await Promise.all(
			libraryIds.map((libraryId) =>
				getWatchHistory({
					serverUrl: plexConnection.serverUrl!,
					authToken,
					libraryId,
				}),
			),
		);

		return allItems.flat().map(mapWatchedItem);
	}

	const items = await getWatchHistory({
		serverUrl: plexConnection.serverUrl,
		authToken,
	});

	return items.map(mapWatchedItem);
};

export { chatRoutes };
