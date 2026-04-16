import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	onTestFinished,
	test,
	vi,
} from "vite-plus/test";

import { buildServer } from "../app.ts";
import {
	aiConfigs,
	conversations,
	libraryItems,
	messages,
	plexConnections,
	recommendations,
	userSettings,
	users,
} from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_AI_ENDPOINT = "https://api.test-ai.example.com";
const MOCK_PLEX_SERVER = "https://plex.test.example.com";
const FIRST_INDEX = 0;
const FIRST_AI_CALL = 1;
const EXPECTED_REC_COUNT = 2;
const SINGLE_CONVERSATION = 1;

const testDbDir = join(tmpdir(), "recommendarr-test-chat");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };

const mockAiResponse = `Here are some great recommendations for you!

\`\`\`json
[
  { "title": "The Matrix", "year": 1999, "mediaType": "movie", "synopsis": "A hacker discovers reality is a simulation." },
  { "title": "Blade Runner", "year": 1982, "mediaType": "movie", "synopsis": "A detective hunts rogue androids." }
]
\`\`\`

I think you'll really enjoy these!`;

const mockTitleResponse = "Sci-Fi Movie Recommendations";

const mockPlexWatchHistory = {
	MediaContainer: {
		Metadata: [
			{
				title: "Pilot",
				type: "episode",
				year: 2008,
				ratingKey: "1",
				grandparentTitle: "Breaking Bad",
				parentIndex: 1,
				index: 1,
				viewedAt: 1_700_000_000,
			},
		],
	},
};

const handlers = [
	http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () =>
		HttpResponse.json({
			id: "chatcmpl-test",
			choices: [{ message: { role: "assistant", content: mockAiResponse } }],
		}),
	),
	http.get(`${MOCK_PLEX_SERVER}/status/sessions/history/all`, () =>
		HttpResponse.json(mockPlexWatchHistory),
	),
];

const mswServer = setupServer(...handlers);

beforeAll(() => {
	mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
	mswServer.resetHandlers();
});

afterAll(() => {
	mswServer.close();
});

const setupDb = async () => {
	vi.stubEnv("DATABASE_PATH", testDbPath);
	vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		vi.unstubAllEnvs();
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true });
		}
	});

	return app;
};

const getSessionCookie = async (app: Awaited<ReturnType<typeof buildServer>>) => {
	await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: testUser,
	});

	const user = app.db.select().from(users).where(eq(users.username, testUser.username)).get();

	if (!user) {
		throw new Error("User not found after registration");
	}

	const session = createSession(app.db, user.id);
	return { sessionId: session.id, userId: user.id };
};

const setupAiAndPlex = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();

	app.db
		.insert(aiConfigs)
		.values({
			id: "ai-config-1",
			userId,
			endpointUrl: MOCK_AI_ENDPOINT,
			apiKey: encrypt("sk-test-key"),
			modelName: "gpt-4",
			temperature: 0.7,
			maxTokens: 2048,
			createdAt: now,
			updatedAt: now,
		})
		.run();

	app.db
		.insert(plexConnections)
		.values({
			id: "plex-conn-1",
			userId,
			authToken: encrypt("plex-token"),
			serverUrl: MOCK_PLEX_SERVER,
			serverName: "Test Server",
			machineIdentifier: "test-machine",
			createdAt: now,
			updatedAt: now,
		})
		.run();
};

describe("POST /api/chat", () => {
	test("creates new conversation and returns recommendations", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some sci-fi movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.conversationId).toBeDefined();
		expect(body.message.content).toContain("great recommendations");
		expect(body.message.role).toBe("assistant");
		expect(body.message.id).toBeDefined();
		expect(body.message.createdAt).toBeDefined();
		expect(body.message.recommendations).toHaveLength(EXPECTED_REC_COUNT);
		expect(body.message.recommendations[FIRST_INDEX].title).toBe("The Matrix");
	});

	test("appends to existing conversation", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Create first message
		const firstResponse = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some sci-fi movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		const firstBody = firstResponse.json();
		const { conversationId } = firstBody;

		// Override handler for the follow-up: use a local counter so the
		// First call (recommendations) and second call (title) are distinct
		let localCallCount = 0;
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () => {
				localCallCount++;
				const content = localCallCount === FIRST_AI_CALL ? mockAiResponse : mockTitleResponse;
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content } }],
				});
			}),
		);

		// Send follow-up message
		const secondResponse = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Can you suggest more like The Matrix?",
				mediaType: "movie",
				resultCount: 5,
				conversationId,
			},
		});

		expect(secondResponse.statusCode).toBe(StatusCodes.OK);
		const secondBody = secondResponse.json();
		expect(secondBody.conversationId).toBe(conversationId);

		// Verify messages were saved
		const allMessages = app.db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.all();

		// 2 user messages + 2 assistant messages = 4
		const EXPECTED_MESSAGE_COUNT = 4;
		expect(allMessages).toHaveLength(EXPECTED_MESSAGE_COUNT);
	});

	test("returns 404 when no AI config exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			payload: {
				message: "Recommend me some movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});

	test("returns 404 for non-existent conversation", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Hello",
				mediaType: "movie",
				resultCount: 5,
				conversationId: "non-existent-id",
			},
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});
});

describe("GET /api/conversations", () => {
	test("lists user conversations", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Create a conversation
		await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/conversations",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.conversations).toHaveLength(SINGLE_CONVERSATION);
		expect(body.conversations[FIRST_INDEX].mediaType).toBe("movie");
	});

	test("returns empty list for new user", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/conversations",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		const EMPTY_LENGTH = 0;
		expect(body.conversations).toHaveLength(EMPTY_LENGTH);
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "GET",
			url: "/api/conversations",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("GET /api/conversations/:id", () => {
	test("returns conversation with messages and recommendations", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Create a conversation
		const chatResponse = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		const { conversationId } = chatResponse.json();

		const response = await app.inject({
			method: "GET",
			url: `/api/conversations/${conversationId}`,
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.id).toBe(conversationId);
		expect(body.mediaType).toBe("movie");
		expect(body.messages).toHaveLength(EXPECTED_REC_COUNT); // User + assistant

		// Check that assistant message has recommendations
		const assistantMsg = body.messages.find((msg: { role: string }) => msg.role === "assistant");
		expect(assistantMsg).toBeDefined();
		expect(assistantMsg.recommendations).toHaveLength(EXPECTED_REC_COUNT);
	});

	test("returns 404 for non-existent conversation", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/conversations/non-existent",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});
});

describe("DELETE /api/conversations/:id", () => {
	test("deletes conversation with messages and recommendations", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Create a conversation
		const chatResponse = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		const { conversationId } = chatResponse.json();

		const response = await app.inject({
			method: "DELETE",
			url: `/api/conversations/${conversationId}`,
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		// Verify cascade delete
		const remainingConversations = app.db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.all();
		const EMPTY_LENGTH = 0;
		expect(remainingConversations).toHaveLength(EMPTY_LENGTH);

		const remainingMessages = app.db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.all();
		expect(remainingMessages).toHaveLength(EMPTY_LENGTH);
	});

	test("returns 404 for non-existent conversation", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "DELETE",
			url: "/api/conversations/non-existent",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "DELETE",
			url: "/api/conversations/some-id",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("POST /api/chat with library exclusion", () => {
	test("sends exclusion context when excludeLibrary is true", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Seed a library item
		const now = new Date().toISOString();
		app.db
			.insert(libraryItems)
			.values({
				id: randomUUID(),
				userId,
				title: "Inception",
				year: 2010,
				mediaType: "movie",
				source: "plex",
				syncedAt: now,
			})
			.run();

		// Seed user settings with excludeLibraryDefault true
		app.db
			.insert(userSettings)
			.values({
				id: randomUUID(),
				userId,
				librarySyncInterval: "manual",
				excludeLibraryDefault: true,
			})
			.run();

		// Intercept the AI call to capture the system prompt
		let capturedSystemPrompt = "";
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, async ({ request }) => {
				const body: unknown = await request.json();
				if (
					body !== null &&
					typeof body === "object" &&
					"messages" in body &&
					Array.isArray(body.messages)
				) {
					const systemMsg: unknown = body.messages.find(
						(msg: unknown) =>
							msg !== null && typeof msg === "object" && "role" in msg && msg.role === "system",
					);
					if (
						systemMsg !== null &&
						typeof systemMsg === "object" &&
						"content" in systemMsg &&
						typeof systemMsg.content === "string"
					) {
						capturedSystemPrompt = systemMsg.content;
					}
				}
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content: mockAiResponse } }],
				});
			}),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some sci-fi movies",
				mediaType: "movie",
				resultCount: 5,
				excludeLibrary: true,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(capturedSystemPrompt).toContain("do NOT recommend");
		expect(capturedSystemPrompt).toContain("Inception");
	});

	test("skips exclusion when excludeLibrary is false", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Seed a library item
		const now = new Date().toISOString();
		app.db
			.insert(libraryItems)
			.values({
				id: randomUUID(),
				userId,
				title: "Inception",
				year: 2010,
				mediaType: "movie",
				source: "plex",
				syncedAt: now,
			})
			.run();

		// Intercept the AI call to capture the system prompt
		let capturedSystemPrompt = "";
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, async ({ request }) => {
				const body: unknown = await request.json();
				if (
					body !== null &&
					typeof body === "object" &&
					"messages" in body &&
					Array.isArray(body.messages)
				) {
					const systemMsg: unknown = body.messages.find(
						(msg: unknown) =>
							msg !== null && typeof msg === "object" && "role" in msg && msg.role === "system",
					);
					if (
						systemMsg !== null &&
						typeof systemMsg === "object" &&
						"content" in systemMsg &&
						typeof systemMsg.content === "string"
					) {
						capturedSystemPrompt = systemMsg.content;
					}
				}
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content: mockAiResponse } }],
				});
			}),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some sci-fi movies",
				mediaType: "movie",
				resultCount: 5,
				excludeLibrary: false,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(capturedSystemPrompt).not.toContain("do NOT recommend");
		expect(capturedSystemPrompt).not.toContain("Inception");
	});
});

describe("POST /api/chat with feedback context", () => {
	test("includes feedback context in system prompt", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Seed a conversation with a recommendation that has feedback
		const now = new Date().toISOString();
		const convId = randomUUID();
		const msgId = randomUUID();
		const recId = randomUUID();

		app.db
			.insert(conversations)
			.values({ id: convId, userId, mediaType: "movie", createdAt: now })
			.run();
		app.db
			.insert(messages)
			.values({
				id: msgId,
				conversationId: convId,
				role: "assistant",
				content: "Here are recommendations",
				createdAt: now,
			})
			.run();
		app.db
			.insert(recommendations)
			.values({
				id: recId,
				messageId: msgId,
				title: "Inception",
				year: 2010,
				mediaType: "movie",
				synopsis: "Dreams within dreams.",
				addedToArr: false,
				feedback: "liked",
			})
			.run();

		// Capture the system prompt
		let capturedSystemPrompt = "";
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, async ({ request }) => {
				const body: unknown = await request.json();
				if (
					body !== null &&
					typeof body === "object" &&
					"messages" in body &&
					Array.isArray(body.messages)
				) {
					const systemMsg: unknown = body.messages.find(
						(msg: unknown) =>
							msg !== null && typeof msg === "object" && "role" in msg && msg.role === "system",
					);
					if (
						systemMsg !== null &&
						typeof systemMsg === "object" &&
						"content" in systemMsg &&
						typeof systemMsg.content === "string"
					) {
						capturedSystemPrompt = systemMsg.content;
					}
				}
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content: mockAiResponse } }],
				});
			}),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend more movies",
				mediaType: "movie",
				resultCount: 5,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(capturedSystemPrompt).toContain("Liked:");
		expect(capturedSystemPrompt).toContain("Inception (2010)");
	});
});
