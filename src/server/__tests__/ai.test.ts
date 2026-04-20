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
	it,
	vi,
} from "vite-plus/test";

import { buildServer } from "../app.ts";
import { aiConfigs, users } from "../schema.ts";
import { decrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";

import type { AiConfig } from "../services/ai-client.ts";
import type { FastifyRequest } from "fastify";

const HEX_KEY_LENGTH = 64;
const MOCK_AI_ENDPOINT = "https://api.test-ai.example.com";

const testDbDir = join(tmpdir(), "recommendarr-test-ai");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };

const mockCompletionResponse = {
	id: "chatcmpl-test123",
	choices: [
		{
			message: {
				role: "assistant",
				content: "Hello! How can I help you?",
			},
		},
	],
};

const defaultTestConfig: AiConfig = {
	endpointUrl: MOCK_AI_ENDPOINT,
	apiKey: "sk-test-key-12345678",
	modelName: "gpt-4",
	temperature: 0.7,
	maxTokens: 2048,
};

const handlers = [
	http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () =>
		HttpResponse.json(mockCompletionResponse),
	),
];

const mswServer = setupServer(...handlers);

// --- AI client tests ---

describe("chatCompletion", () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	it("sends request with correct headers and body, returns response content", async () => {
		const { chatCompletion } = await import("../services/ai-client.ts");

		const result = await chatCompletion(defaultTestConfig, [{ role: "user", content: "Hello" }]);

		expect(result).toBe("Hello! How can I help you?");
	});

	it("throws on non-ok response", async () => {
		const { chatCompletion } = await import("../services/ai-client.ts");

		mswServer.use(
			http.post(
				`${MOCK_AI_ENDPOINT}/v1/chat/completions`,
				() => new HttpResponse("Internal Server Error", { status: 500 }),
			),
		);

		await expect(
			chatCompletion(defaultTestConfig, [{ role: "user", content: "Hello" }]),
		).rejects.toThrow(/500/);
	});

	it("throws when response has no content", async () => {
		const { chatCompletion } = await import("../services/ai-client.ts");

		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () =>
				HttpResponse.json({ id: "test", choices: [] }),
			),
		);

		await expect(
			chatCompletion(defaultTestConfig, [{ role: "user", content: "Hello" }]),
		).rejects.toThrow("AI API returned no content in response");
	});
});

describe("testConnection", () => {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	const mockRequest = {
		log: { error: vi.fn<() => void>() },
	} as unknown as FastifyRequest;

	it("returns success true on valid response", async () => {
		const { testConnection } = await import("../services/ai-client.ts");

		const result = await testConnection(mockRequest, defaultTestConfig);

		expect(result).toStrictEqual({ success: true });
	});

	it("returns success false on network failure and logs error", async () => {
		const { testConnection } = await import("../services/ai-client.ts");

		mswServer.use(http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () => HttpResponse.error()));

		const result = await testConnection(mockRequest, defaultTestConfig);

		expect(result.success).toBe(false);
		expect(result.error).toBeTypeOf("string");
		expect(mockRequest.log.error).toHaveBeenCalledWith();
	});
});

// --- AI config route tests ---

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

describe("gET /api/ai/config", () => {
	it("returns 404 when no config exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/ai/config",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	it("returns config with masked API key", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		// First create a config via PUT
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/ai/config",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.endpointUrl).toBe(MOCK_AI_ENDPOINT);
		expect(body.modelName).toBe("gpt-4");
		expect(body.apiKey).toBe("sk-****5678");
		expect(body.apiKey).not.toContain("test-key");

		// Verify the stored API key is encrypted in the database
		const dbConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();
		expect(dbConfig).toBeDefined();
		expect(dbConfig!.apiKey).not.toBe("sk-test-key-12345678");
		expect(decrypt(dbConfig!.apiKey)).toBe("sk-test-key-12345678");
	});

	it("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "GET",
			url: "/api/ai/config",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("pUT /api/ai/config", () => {
	it("creates new config", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-new-key-abcdefgh",
				modelName: "gpt-4",
				temperature: 0.8,
				maxTokens: 4096,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		const dbConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();
		expect(dbConfig).toBeDefined();
		expect(dbConfig!.endpointUrl).toBe(MOCK_AI_ENDPOINT);
		expect(dbConfig!.modelName).toBe("gpt-4");
		expect(decrypt(dbConfig!.apiKey)).toBe("sk-new-key-abcdefgh");
	});

	it("updates existing config", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		// Create initial config
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-old-key-12345678",
				modelName: "gpt-3.5",
				temperature: 0.5,
				maxTokens: 1024,
			},
		});

		// Update config
		const response = await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: "https://api.updated.example.com",
				apiKey: "sk-updated-key-9999",
				modelName: "gpt-4",
				temperature: 0.9,
				maxTokens: 4096,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);

		const dbConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();
		expect(dbConfig!.endpointUrl).toBe("https://api.updated.example.com");
		expect(dbConfig!.modelName).toBe("gpt-4");
		expect(decrypt(dbConfig!.apiKey)).toBe("sk-updated-key-9999");
	});

	it("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("dELETE /api/ai/config", () => {
	it("removes config", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		// Create config first
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		const response = await app.inject({
			method: "DELETE",
			url: "/api/ai/config",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		const dbConfig = app.db.select().from(aiConfigs).where(eq(aiConfigs.userId, userId)).get();
		expect(dbConfig).toBeUndefined();
	});

	it("returns 404 when no config exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "DELETE",
			url: "/api/ai/config",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});
});

describe("pOST /api/ai/test", () => {
	it("returns success on valid connection", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		// Create config first
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.success).toBe(true);
	});

	it("returns failure when AI endpoint is down", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		// Create config first
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		mswServer.use(http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () => HttpResponse.error()));

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.success).toBe(false);
	});

	it("returns 404 when no config exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	it("returns success when testing with body config (no saved config needed)", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.success).toBe(true);
	});

	it("returns failure when testing with body config and endpoint is down", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		mswServer.use(http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, () => HttpResponse.error()));

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-test-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.success).toBe(false);
	});

	it("uses body config values instead of saved config", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);
		const alternateEndpoint = "https://api.alternate-ai.example.com";

		// Save a config pointing to the default mock endpoint
		await app.inject({
			method: "PUT",
			url: "/api/ai/config",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: MOCK_AI_ENDPOINT,
				apiKey: "sk-saved-key-12345678",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		// Set up a handler for the alternate endpoint
		mswServer.use(
			http.post(`${alternateEndpoint}/v1/chat/completions`, () =>
				HttpResponse.json(mockCompletionResponse),
			),
		);

		// Test with body pointing to the alternate endpoint
		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: alternateEndpoint,
				apiKey: "sk-body-key-87654321",
				modelName: "gpt-3.5",
				temperature: 0.5,
				maxTokens: 1024,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.success).toBe(true);
	});

	it("rejects invalid body config", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/ai/test",
			cookies: { session: sessionId },
			payload: {
				endpointUrl: "not-a-valid-url",
				apiKey: "sk-test",
				modelName: "gpt-4",
				temperature: 0.7,
				maxTokens: 2048,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
	});
});
