import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
	chatRequestSchema,
	chatResponseSchema,
	conversationDetailSchema,
	conversationsResponseSchema,
} from "../../shared/schemas/chat.ts";
import { errorResponseSchema, successResponseSchema } from "../../shared/schemas/common.ts";
import {
	aiConfigs,
	arrConnections as arrConnectionsTable,
	conversations,
	messages,
	metadataCache,
	plexConnections,
	recommendations,
	userSettings,
} from "../schema.ts";
import { chatCompletion } from "../services/ai-client.ts";
import { decrypt } from "../services/encryption.ts";
import { buildExclusionContext, shouldAutoSync, syncLibrary } from "../services/library-sync.ts";
import { getWatchHistory } from "../services/plex-api.ts";
import { buildSystemPrompt } from "../services/prompt-builder.ts";
import {
	filterExcludedRecommendations,
	parseRecommendations,
} from "../services/response-parser.ts";

import type { ExclusionContext } from "../services/library-sync.ts";
import type { CreditPerson } from "../services/metadata-types.ts";
import type { CastCrewContextItem, FeedbackItem } from "../services/prompt-builder.ts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const creditPersonSchema = z
	.object({
		name: z.string(),
		role: z.string(),
		character: z.string().optional(),
	})
	.transform(
		(val): CreditPerson => ({
			name: val.name,
			role: val.role,
			character: val.character,
		}),
	);
const creditPersonArraySchema = z.array(creditPersonSchema);

const MAX_TITLE_WORDS = 6;
const NO_PRIOR_MESSAGES = 0;
const MAX_TITLE_MESSAGE_LENGTH = 200;
const EMPTY_ARRAY_LENGTH = 0;
const FEEDBACK_LIMIT = 50;
const STRING_START = 0;
const NO_FILTERED_ITEMS = 0;

const CAST_CREW_KEYWORDS = ["actor", "director", "cast", "starring", "crew", "writer", "acted"];

const messageRequestsCastInfo = (message: string): boolean =>
	CAST_CREW_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword));

const VALID_MEDIA_TYPES = ["movie", "show", "either"] as const;
type MediaType = (typeof VALID_MEDIA_TYPES)[number];

const toFeedback = (value: string | null): "liked" | "disliked" | undefined =>
	value === "liked" || value === "disliked" ? value : undefined;

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

			const { message, mediaType, resultCount, conversationId, libraryIds, excludeLibrary } =
				request.body;
			const userId = request.user.id;

			request.log.info({ mediaType, conversationId, resultCount }, "chat request received");

			// Get AI config
			const aiConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();

			if (!aiConfig) {
				request.log.warn("chat request with no AI configuration");
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
			request.log.debug("fetching plex watch history");
			const watchHistory = plexConnection?.serverUrl
				? await getWatchHistoryItems(plexConnection, libraryIds)
				: [];
			request.log.debug({ watchHistoryCount: watchHistory.length }, "watch history fetched");

			// Resolve exclusion toggle
			const userSetting = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();
			const shouldExclude = excludeLibrary ?? userSetting?.excludeLibraryDefault ?? true;

			// Build exclusion context if enabled
			let exclusionContext: ExclusionContext | undefined = undefined;
			const isValidMediaType = (value: string): value is MediaType =>
				(VALID_MEDIA_TYPES as readonly string[]).includes(value);
			const resolvedMediaType: MediaType = isValidMediaType(mediaType) ? mediaType : "either";
			if (shouldExclude) {
				// Trigger background sync if stale — don't block the chat response
				if ((await shouldAutoSync(userId, app.db)) && plexConnection?.serverUrl) {
					const arrConns = app.db
						.select()
						.from(arrConnectionsTable)
						.where(eq(arrConnectionsTable.userId, userId))
						.all();
					/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- intentional fire-and-forget with error handling */
					void syncLibrary({
						userId,
						db: app.db,
						sqlite: app.sqlite,
						plexConnection,
						arrConns,
					}).catch((error: unknown) => {
						request.log.error({ error }, "background library sync failed");
					});
					/* eslint-enable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */
				}
				exclusionContext = await buildExclusionContext(userId, app.db, {
					mediaType: resolvedMediaType,
				});
			}

			// Query recent feedback (bounded, filtered at DB level)
			const feedbackRows = app.db
				.select({
					title: recommendations.title,
					year: recommendations.year,
					mediaType: recommendations.mediaType,
					feedback: recommendations.feedback,
				})
				.from(recommendations)
				.innerJoin(messages, eq(recommendations.messageId, messages.id))
				.innerJoin(conversations, eq(messages.conversationId, conversations.id))
				.where(and(eq(conversations.userId, userId), isNotNull(recommendations.feedback)))
				.orderBy(desc(messages.createdAt))
				.limit(FEEDBACK_LIMIT)
				.all();

			// Deduplicate by title — keep only the most recent feedback per title
			const seenTitles = new Set<string>();
			const feedbackContext: FeedbackItem[] = feedbackRows
				.map((row) => {
					const feedback = toFeedback(row.feedback);
					if (!feedback) {
						return undefined;
					}
					const key = row.title.toLowerCase();
					if (seenTitles.has(key)) {
						return undefined;
					}
					seenTitles.add(key);
					return {
						title: row.title,
						year: row.year ?? undefined,
						mediaType: row.mediaType,
						feedback,
					};
				})
				.filter((item): item is FeedbackItem => item !== undefined);

			// Optionally enrich with cast/crew metadata if the user's message suggests interest
			let castCrewContext: CastCrewContextItem[] = [];
			if (messageRequestsCastInfo(message)) {
				const cachedMetadata = app.db.select().from(metadataCache).all();

				castCrewContext = cachedMetadata
					.filter((row) => row.cast !== null || row.crew !== null)
					.map((row) => ({
						title: row.title,
						year: row.year ?? undefined,
						cast: row.cast ? creditPersonArraySchema.parse(JSON.parse(row.cast)) : [],
						crew: row.crew ? creditPersonArraySchema.parse(JSON.parse(row.crew)) : [],
					}))
					.filter(
						(item) =>
							item.cast.length > EMPTY_ARRAY_LENGTH || item.crew.length > EMPTY_ARRAY_LENGTH,
					);

				request.log.debug(
					{ castCrewItemCount: castCrewContext.length },
					"cast/crew metadata enrichment applied",
				);
			}

			// Build system prompt
			const systemPrompt = buildSystemPrompt({
				watchHistory,
				mediaType,
				resultCount,
				...(exclusionContext !== undefined && { exclusionContext }),
				...(feedbackContext.length > EMPTY_ARRAY_LENGTH && { feedbackContext }),
				...(castCrewContext.length > EMPTY_ARRAY_LENGTH && { castCrewContext }),
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
			request.log.debug(
				{ model: aiConfig.modelName, messageCount: aiMessages.length },
				"calling AI",
			);
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
			request.log.debug("AI response received, parsing recommendations");
			let parsed = parseRecommendations(aiResponse);

			// Post-filter: remove library-owned items and past recommendations if exclusion enabled
			if (shouldExclude && exclusionContext) {
				const filterResult = filterExcludedRecommendations(parsed.recommendations, {
					libraryTitles: exclusionContext.titles,
					pastRecommendations: exclusionContext.pastRecommendations,
				});

				if (filterResult.filtered.length > NO_FILTERED_ITEMS) {
					// Backfill request: ask AI for replacements
					request.log.info(
						{ filteredCount: filterResult.filtered.length },
						"excluded library-owned recommendations, requesting backfill",
					);
					const filteredTitles = filterResult.filtered.map((rec) => rec.title).join(", ");
					const allExcluded = [
						...exclusionContext.titles.map((item) => item.title),
						...filterResult.kept.map((item) => item.title),
					].join(", ");

					try {
						const backfillResponse = await chatCompletion(
							{
								endpointUrl: aiConfig.endpointUrl,
								apiKey: decryptedKey,
								modelName: aiConfig.modelName,
								temperature: aiConfig.temperature,
								maxTokens: aiConfig.maxTokens,
							},
							[
								...aiMessages,
								{
									role: "user",
									content: `${String(filterResult.filtered.length)} of your recommendations were items the user already owns: ${filteredTitles}. Please provide ${String(filterResult.filtered.length)} replacement recommendations. Do not suggest: ${allExcluded}`,
								},
							],
						);
						const backfillParsed = parseRecommendations(backfillResponse);
						const backfillFiltered = filterExcludedRecommendations(backfillParsed.recommendations, {
							libraryTitles: exclusionContext.titles,
							pastRecommendations: exclusionContext.pastRecommendations,
						});
						parsed = {
							conversationalText: parsed.conversationalText,
							recommendations: [...filterResult.kept, ...backfillFiltered.kept],
						};
					} catch (error) {
						request.log.warn({ error }, "backfill request failed, using kept recommendations only");
						parsed = {
							conversationalText: parsed.conversationalText,
							recommendations: filterResult.kept,
						};
					}
				} else {
					parsed = {
						conversationalText: parsed.conversationalText,
						recommendations: filterResult.kept,
					};
				}
			}

			// Save assistant message
			const assistantMessageId = randomUUID();
			const assistantCreatedAt = new Date().toISOString();
			app.db
				.insert(messages)
				.values({
					id: assistantMessageId,
					conversationId: activeConversationId,
					role: "assistant",
					content: aiResponse,
					createdAt: assistantCreatedAt,
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
					feedback: undefined,
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

			request.log.info(
				{ conversationId: activeConversationId, recommendationCount: savedRecommendations.length },
				"chat response sent",
			);
			return reply.code(StatusCodes.OK).send({
				conversationId: activeConversationId,
				message: {
					id: assistantMessageId,
					role: "assistant",
					content: parsed.conversationalText,
					createdAt: assistantCreatedAt,
					recommendations: savedRecommendations,
				},
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
						feedback: toFeedback(rec.feedback),
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

			request.log.info({ conversationId: conversation.id }, "conversation deleted");
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
