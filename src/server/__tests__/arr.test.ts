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
import { arrConnections, conversations, messages, recommendations, users } from "../schema.ts";
import { decrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_ARR_URL = "http://radarr.test.example.com";
const ONE = 1;
const FIRST = 0;
const INCEPTION_YEAR = 2010;
const INCEPTION_TMDB_ID = 27_205;

const testDbDir = join(tmpdir(), "recommendarr-test-arr");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };

const mockSystemStatus = { version: "5.3.6" };
const mockRootFolders = [{ id: 1, path: "/movies", freeSpace: 100_000_000_000 }];
const mockQualityProfiles = [{ id: 1, name: "Any" }];
const mockLookupResults = [
	{
		id: 0,
		title: "Inception",
		year: 2010,
		tmdbId: 27_205,
		tvdbId: undefined,
		overview: "A thief who steals corporate secrets through the use of dream-sharing technology.",
	},
];
const mockAddResponse = { id: 42 };

const handlers = [
	http.get(`${MOCK_ARR_URL}/api/v3/system/status`, () => HttpResponse.json(mockSystemStatus)),
	http.get(`${MOCK_ARR_URL}/api/v3/rootfolder`, () => HttpResponse.json(mockRootFolders)),
	http.get(`${MOCK_ARR_URL}/api/v3/qualityprofile`, () => HttpResponse.json(mockQualityProfiles)),
	http.get(`${MOCK_ARR_URL}/api/v3/movie/lookup`, () => HttpResponse.json(mockLookupResults)),
	http.post(`${MOCK_ARR_URL}/api/v3/movie`, () => HttpResponse.json(mockAddResponse)),
];

const mswServer = setupServer(...handlers);

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

describe("arr", () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	describe("gET /api/arr/config", () => {
		it("returns empty array when no connections", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "GET",
				url: "/api/arr/config",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			expect(response.json()).toStrictEqual([]);
		});

		it("returns connections with masked API keys", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "myapikey1234" },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/arr/config",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body).toHaveLength(ONE);
			expect(body[FIRST]?.serviceType).toBe("radarr");
			expect(body[FIRST]?.url).toBe(MOCK_ARR_URL);
			expect(body[FIRST]?.apiKey).toBe("****1234");
			expect(body[FIRST]?.apiKey).not.toContain("myapikey");

			const dbConn = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.get();
			expect(dbConn).toBeDefined();
			expect(decrypt(dbConn!.apiKey)).toBe("myapikey1234");
		});

		it("returns 401 without session", async () => {
			const app = await setupDb();

			const response = await app.inject({
				method: "GET",
				url: "/api/arr/config",
			});

			expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		});
	});

	describe("pUT /api/arr/config/:serviceType", () => {
		it("creates new radarr connection with encrypted API key", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testradarrkey1234" },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			expect(response.json()).toStrictEqual({ success: true });

			const dbConn = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.get();
			expect(dbConn).toBeDefined();
			expect(dbConn!.serviceType).toBe("radarr");
			expect(dbConn!.url).toBe(MOCK_ARR_URL);
			expect(dbConn!.apiKey).not.toBe("testradarrkey1234");
			expect(decrypt(dbConn!.apiKey)).toBe("testradarrkey1234");
		});

		it("updates existing connection", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "oldkey1234" },
			});

			const updatedUrl = "http://radarr-new.test.example.com";
			const response = await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: updatedUrl, apiKey: "newkey5678" },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);

			const dbConn = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.get();
			expect(dbConn!.url).toBe(updatedUrl);
			expect(decrypt(dbConn!.apiKey)).toBe("newkey5678");

			const allConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();
			expect(allConns).toHaveLength(ONE);
		});

		it("rejects invalid serviceType with 400", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "PUT",
				url: "/api/arr/config/lidarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
		});
	});

	describe("dELETE /api/arr/config/:serviceType", () => {
		it("removes a connection", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			const response = await app.inject({
				method: "DELETE",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			expect(response.json()).toStrictEqual({ success: true });

			const dbConn = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.get();
			expect(dbConn).toBeUndefined();
		});

		it("returns 404 when no connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "DELETE",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});
	});

	describe("pOST /api/arr/test", () => {
		it("returns success on valid connection", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/test",
				cookies: { session: sessionId },
				payload: { serviceType: "radarr" },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body.success).toBe(true);
			expect(body.version).toBe("5.3.6");
		});

		it("returns 404 when no connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/test",
				cookies: { session: sessionId },
				payload: { serviceType: "radarr" },
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});
	});

	describe("gET /api/arr/options/:serviceType", () => {
		it("returns root folders and quality profiles", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/arr/options/radarr",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body.rootFolders).toStrictEqual(mockRootFolders);
			expect(body.qualityProfiles).toStrictEqual(mockQualityProfiles);
		});

		it("returns 404 when no connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "GET",
				url: "/api/arr/options/radarr",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});
	});

	describe("pOST /api/arr/lookup", () => {
		it("returns lookup results", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/lookup",
				cookies: { session: sessionId },
				payload: { serviceType: "radarr", title: "Inception", year: 2010 },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body).toHaveLength(ONE);
			expect(body[FIRST]?.title).toBe("Inception");
			expect(body[FIRST]?.year).toBe(INCEPTION_YEAR);
			expect(body[FIRST]?.tmdbId).toBe(INCEPTION_TMDB_ID);
		});

		it("returns 404 when no connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/lookup",
				cookies: { session: sessionId },
				payload: { serviceType: "radarr", title: "Inception" },
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});
	});

	describe("pOST /api/arr/add", () => {
		it("adds media and updates recommendation addedToArr and tmdbId", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			await app.inject({
				method: "PUT",
				url: "/api/arr/config/radarr",
				cookies: { session: sessionId },
				payload: { url: MOCK_ARR_URL, apiKey: "testkey1234" },
			});

			const now = new Date().toISOString();
			const conversationId = "conv-test-1";
			const messageId = "msg-test-1";
			const recommendationId = "rec-test-1";

			app.db
				.insert(conversations)
				.values({
					id: conversationId,
					userId,
					mediaType: "movie",
					title: "Test conversation",
					createdAt: now,
				})
				.run();

			app.db
				.insert(messages)
				.values({
					id: messageId,
					conversationId,
					role: "assistant",
					content: "Here are some recommendations",
					createdAt: now,
				})
				.run();

			app.db
				.insert(recommendations)
				.values({
					id: recommendationId,
					messageId,
					title: "Inception",
					year: 2010,
					mediaType: "movie",
					synopsis: "A mind-bending thriller",
					addedToArr: false,
				})
				.run();

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/add",
				cookies: { session: sessionId },
				payload: {
					serviceType: "radarr",
					recommendationId,
					tmdbId: 27_205,
					title: "Inception",
					year: 2010,
					qualityProfileId: 1,
					rootFolderPath: "/movies",
				},
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			expect(response.json()).toStrictEqual({ success: true });

			const dbRec = app.db
				.select()
				.from(recommendations)
				.where(eq(recommendations.id, recommendationId))
				.get();
			expect(dbRec!.addedToArr).toBe(true);
			expect(dbRec!.tmdbId).toBe(INCEPTION_TMDB_ID);
		});

		it("returns 404 when no connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "POST",
				url: "/api/arr/add",
				cookies: { session: sessionId },
				payload: {
					serviceType: "radarr",
					recommendationId: "rec-1",
					tmdbId: 27_205,
					title: "Inception",
					year: 2010,
					qualityProfileId: 1,
					rootFolderPath: "/movies",
				},
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});
	});
});
