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
import { plexConnections, userSettings, users } from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_PLEX_SERVER = "https://plex.test.example.com";
const EXPECTED_MOVIE_COUNT = 2;
const EXPECTED_SHOW_COUNT = 1;
const EXPECTED_TOTAL_COUNT = 3;
const ZERO = 0;

const testDbDir = join(tmpdir(), "recommendarr-test-library");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };

const mockPlexLibrarySections = {
	MediaContainer: {
		Directory: [
			{ key: "1", title: "Movies", type: "movie" },
			{ key: "2", title: "TV Shows", type: "show" },
		],
	},
};

const mockMovieLibraryContents = {
	MediaContainer: {
		totalSize: 2,
		Metadata: [
			{
				title: "The Matrix",
				type: "movie",
				year: 1999,
				ratingKey: "101",
				Genre: [],
			},
			{
				title: "Inception",
				type: "movie",
				year: 2010,
				ratingKey: "102",
				Genre: [],
			},
		],
	},
};

const mockShowLibraryContents = {
	MediaContainer: {
		totalSize: 1,
		Metadata: [
			{
				title: "Breaking Bad",
				type: "show",
				year: 2008,
				ratingKey: "201",
				Genre: [],
			},
		],
	},
};

const handlers = [
	http.get(`${MOCK_PLEX_SERVER}/library/sections`, () =>
		HttpResponse.json(mockPlexLibrarySections),
	),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/1/all`, () =>
		HttpResponse.json(mockMovieLibraryContents),
	),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/2/all`, () =>
		HttpResponse.json(mockShowLibraryContents),
	),
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

const setupPlexConnection = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();

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

describe("library", () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	describe("pOST /api/library/sync", () => {
		it("syncs library and returns counts", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);
			setupPlexConnection(app, userId);

			const response = await app.inject({
				method: "POST",
				url: "/api/library/sync",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body.movieCount).toBe(EXPECTED_MOVIE_COUNT);
			expect(body.showCount).toBe(EXPECTED_SHOW_COUNT);
			expect(body.totalCount).toBe(EXPECTED_TOTAL_COUNT);
		});

		it("returns 404 when no Plex connection exists", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "POST",
				url: "/api/library/sync",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		});

		it("returns 401 without session", async () => {
			const app = await setupDb();

			const response = await app.inject({
				method: "POST",
				url: "/api/library/sync",
			});

			expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		});
	});

	describe("gET /api/library/status", () => {
		it("returns defaults for new user with no settings", async () => {
			const app = await setupDb();
			const { sessionId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "GET",
				url: "/api/library/status",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body.lastSynced).toBeUndefined();
			expect(body.interval).toBe("manual");
			expect(body.itemCount).toBe(ZERO);
			expect(body.movieCount).toBe(ZERO);
			expect(body.showCount).toBe(ZERO);
			expect(body.excludeDefault).toBe(true);
		});

		it("returns updated status after sync", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);
			setupPlexConnection(app, userId);

			// Perform a sync first
			await app.inject({
				method: "POST",
				url: "/api/library/sync",
				cookies: { session: sessionId },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/library/status",
				cookies: { session: sessionId },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			const body = response.json();
			expect(body.lastSynced).not.toBeNull();
			expect(body.itemCount).toBe(EXPECTED_TOTAL_COUNT);
			expect(body.movieCount).toBe(EXPECTED_MOVIE_COUNT);
			expect(body.showCount).toBe(EXPECTED_SHOW_COUNT);
		});

		it("returns 401 without session", async () => {
			const app = await setupDb();

			const response = await app.inject({
				method: "GET",
				url: "/api/library/status",
			});

			expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		});
	});

	describe("pUT /api/library/settings", () => {
		it("creates settings for new user", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			const response = await app.inject({
				method: "PUT",
				url: "/api/library/settings",
				cookies: { session: sessionId },
				payload: { interval: "24h", excludeDefault: false },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);
			expect(response.json()).toStrictEqual({ success: true });

			// Verify in DB
			const settings = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();
			expect(settings?.librarySyncInterval).toBe("24h");
			expect(settings?.excludeLibraryDefault).toBe(false);
		});

		it("updates existing settings", async () => {
			const app = await setupDb();
			const { sessionId, userId } = await getSessionCookie(app);

			// Create initial settings
			await app.inject({
				method: "PUT",
				url: "/api/library/settings",
				cookies: { session: sessionId },
				payload: { interval: "6h", excludeDefault: true },
			});

			// Update settings
			const response = await app.inject({
				method: "PUT",
				url: "/api/library/settings",
				cookies: { session: sessionId },
				payload: { interval: "7d", excludeDefault: false },
			});

			expect(response.statusCode).toBe(StatusCodes.OK);

			// Verify updated values in DB
			const settings = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();
			expect(settings?.librarySyncInterval).toBe("7d");
			expect(settings?.excludeLibraryDefault).toBe(false);
		});

		it("returns 401 without session", async () => {
			const app = await setupDb();

			const response = await app.inject({
				method: "PUT",
				url: "/api/library/settings",
				payload: { interval: "24h", excludeDefault: true },
			});

			expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		});
	});
});
