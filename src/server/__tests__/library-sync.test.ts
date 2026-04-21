import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
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
import {
	arrConnections,
	conversations,
	libraryItems,
	messages,
	plexConnections,
	recommendations,
	userSettings,
	users,
} from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import { buildExclusionContext, shouldAutoSync, syncLibrary } from "../services/library-sync.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_PLEX_SERVER = "https://plex.test.example.com";
const MOCK_RADARR_URL = "http://radarr.test.example.com";
const MOCK_SONARR_URL = "http://sonarr.test.example.com";

const MATRIX_YEAR = 1999;
const INCEPTION_YEAR = 2010;
const BREAKING_BAD_YEAR = 2008;
const INTERSTELLAR_YEAR = 2014;
const BETTER_CALL_SAUL_YEAR = 2015;
const INTERSTELLAR_TMDB_ID = 157_336;
const BETTER_CALL_SAUL_TVDB_ID = 273_181;

const PLEX_MOVIE_COUNT = 3;
const RADARR_ITEM_COUNT = 1;
const SONARR_ITEM_COUNT = 1;
const TOTAL_ALL_SOURCES = 5;
const PLEX_ONLY_COUNT = 3;
const TOTAL_MOVIE_COUNT = 3;
const TOTAL_SHOW_COUNT = 2;
const MAX_TOP_GENRES = 5;
const EMPTY_COUNT = 0;
const SYNC_CLOCK_TOLERANCE_MS = 1000;

const HOURS_25_MS = 90_000_000;
const HOURS_8_MS = 28_800_000;
const HOURS_1_MS = 3_600_000;
const DAYS_8_MS = 691_200_000;

const testDbDir = join(tmpdir(), "recommendarr-test-library-sync");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "syncuser", password: "password123" };

const mockPlexLibraries = {
	MediaContainer: {
		Directory: [
			{ key: "1", title: "Movies", type: "movie" },
			{ key: "2", title: "TV Shows", type: "show" },
		],
	},
};

const mockPlexMovies = {
	MediaContainer: {
		totalSize: 2,
		Metadata: [
			{
				title: "The Matrix",
				type: "movie",
				year: MATRIX_YEAR,
				ratingKey: "101",
				Genre: [{ tag: "Action" }, { tag: "Sci-Fi" }],
			},
			{
				title: "Inception",
				type: "movie",
				year: INCEPTION_YEAR,
				ratingKey: "102",
				Genre: [{ tag: "Action" }, { tag: "Thriller" }],
			},
		],
	},
};

const mockPlexShows = {
	MediaContainer: {
		totalSize: 1,
		Metadata: [
			{
				title: "Breaking Bad",
				type: "show",
				year: BREAKING_BAD_YEAR,
				ratingKey: "201",
				Genre: [{ tag: "Crime" }, { tag: "Drama" }],
			},
		],
	},
};

const mockRadarrMovies = [
	{
		id: 1,
		title: "Interstellar",
		year: INTERSTELLAR_YEAR,
		tmdbId: INTERSTELLAR_TMDB_ID,
		genres: ["Adventure", "Drama", "Sci-Fi"],
	},
];

const mockSonarrSeries = [
	{
		id: 1,
		title: "Better Call Saul",
		year: BETTER_CALL_SAUL_YEAR,
		tvdbId: BETTER_CALL_SAUL_TVDB_ID,
		genres: ["Crime", "Drama"],
	},
];

const handlers = [
	http.get(`${MOCK_PLEX_SERVER}/library/sections`, () => HttpResponse.json(mockPlexLibraries)),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/1/all`, () => HttpResponse.json(mockPlexMovies)),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/2/all`, () => HttpResponse.json(mockPlexShows)),
	http.get(`${MOCK_RADARR_URL}/api/v3/movie`, () => HttpResponse.json(mockRadarrMovies)),
	http.get(`${MOCK_SONARR_URL}/api/v3/series`, () => HttpResponse.json(mockSonarrSeries)),
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

const registerUser = async (app: Awaited<ReturnType<typeof buildServer>>) => {
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

const insertPlexConnection = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();
	app.db
		.insert(plexConnections)
		.values({
			id: "plex-conn-1",
			userId,
			authToken: encrypt("plex-auth-token"),
			serverUrl: MOCK_PLEX_SERVER,
			serverName: "Test Server",
			machineIdentifier: "test-machine",
			createdAt: now,
			updatedAt: now,
		})
		.run();
};

const insertArrConnections = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();
	app.db
		.insert(arrConnections)
		.values([
			{
				id: "radarr-conn-1",
				userId,
				serviceType: "radarr",
				url: MOCK_RADARR_URL,
				apiKey: encrypt("radarr-api-key"),
				createdAt: now,
				updatedAt: now,
			},
			{
				id: "sonarr-conn-1",
				userId,
				serviceType: "sonarr",
				url: MOCK_SONARR_URL,
				apiKey: encrypt("sonarr-api-key"),
				createdAt: now,
				updatedAt: now,
			},
		])
		.run();
};

describe("library-sync", () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	describe(syncLibrary, () => {
		it("syncs items from all sources (Plex movies, Plex shows, Radarr, Sonarr)", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

			expect(items).toHaveLength(TOTAL_ALL_SOURCES);

			const plexItems = items.filter((item) => item.source === "plex");
			const radarrItems = items.filter((item) => item.source === "radarr");
			const sonarrItems = items.filter((item) => item.source === "sonarr");

			expect(plexItems).toHaveLength(PLEX_MOVIE_COUNT);
			expect(radarrItems).toHaveLength(RADARR_ITEM_COUNT);
			expect(sonarrItems).toHaveLength(SONARR_ITEM_COUNT);
		});

		it("replaces existing items on re-sync", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			// Sync twice
			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});
			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

			// Should still be 5, not 10
			expect(items).toHaveLength(TOTAL_ALL_SOURCES);
		});

		it("syncs Plex-only when no arr connections provided", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns: [],
			});

			const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

			expect(items).toHaveLength(PLEX_ONLY_COUNT);
			expect(items.every((item) => item.source === "plex")).toBe(true);
		});

		it("updates userSettings librarySyncLast timestamp after sync", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			const before = new Date();
			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns: [],
			});

			const settings = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();

			expect(settings).toBeDefined();
			expect(settings!.librarySyncLast).toBeDefined();

			const syncTime = new Date(settings!.librarySyncLast!);
			expect(syncTime.getTime()).toBeGreaterThanOrEqual(before.getTime() - SYNC_CLOCK_TOLERANCE_MS);
		});

		it("stores genres, mediaType, and plexRatingKey for Plex items", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns: [],
			});

			const matrix = app.db
				.select()
				.from(libraryItems)
				.where(eq(libraryItems.userId, userId))
				.all()
				.find((item) => item.title === "The Matrix");

			expect(matrix).toBeDefined();
			expect(matrix!.year).toBe(MATRIX_YEAR);
			expect(matrix!.mediaType).toBe("movie");
			expect(matrix!.plexRatingKey).toBe("101");
			expect(matrix!.genres).toContain("Action");
		});

		it("stores externalId for Radarr and Sonarr items", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const interstellar = app.db
				.select()
				.from(libraryItems)
				.where(eq(libraryItems.userId, userId))
				.all()
				.find((item) => item.title === "Interstellar");

			expect(interstellar).toBeDefined();
			expect(interstellar!.externalId).toBe(String(INTERSTELLAR_TMDB_ID));
			expect(interstellar!.mediaType).toBe("movie");
			expect(interstellar!.source).toBe("radarr");
		});
	});

	describe(buildExclusionContext, () => {
		it("returns titles, summary, and pastRecommendations", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "either",
			});

			expect(context.titles.length).toBeGreaterThan(EMPTY_COUNT);
			expect(context.summary.movieCount).toBeGreaterThan(EMPTY_COUNT);
			expect(context.summary.showCount).toBeGreaterThan(EMPTY_COUNT);
			expect(context.summary.topGenres).toBeDefined();
			expect(Array.isArray(context.summary.topGenres)).toBe(true);
			expect(Array.isArray(context.pastRecommendations)).toBe(true);
		});

		it("filters titles by mediaType=movie", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "movie",
			});

			expect(context.titles.every((title) => title.mediaType === "movie")).toBe(true);
		});

		it("filters titles by mediaType=show", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "show",
			});

			expect(context.titles.every((title) => title.mediaType === "show")).toBe(true);
		});

		it("counts movies and shows correctly in summary", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "either",
			});

			// Plex: 2 movies + 1 show; Radarr: 1 movie; Sonarr: 1 show → 3 movies, 2 shows
			expect(context.summary.movieCount).toBe(TOTAL_MOVIE_COUNT);
			expect(context.summary.showCount).toBe(TOTAL_SHOW_COUNT);
		});

		it("returns top 5 genres from all items", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);
			insertArrConnections(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();
			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns,
			});

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "either",
			});

			expect(context.summary.topGenres.length).toBeLessThanOrEqual(MAX_TOP_GENRES);
		});

		it("includes past recommendation titles", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			insertPlexConnection(app, userId);

			const plexConn = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			await syncLibrary({
				userId,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection: plexConn!,
				arrConns: [],
			});

			// Insert a conversation, message, and recommendation for this user
			const now = new Date().toISOString();
			const REC_YEAR = 2020;
			app.db
				.insert(conversations)
				.values({
					id: "conv-1",
					userId,
					mediaType: "movie",
					createdAt: now,
				})
				.run();

			app.db
				.insert(messages)
				.values({
					id: "msg-1",
					conversationId: "conv-1",
					role: "assistant",
					content: "Here are my picks",
					createdAt: now,
				})
				.run();

			app.db
				.insert(recommendations)
				.values({
					id: "rec-1",
					messageId: "msg-1",
					title: "Past Recommendation",
					year: REC_YEAR,
					mediaType: "movie",
					synopsis: "A great film",
				})
				.run();

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "either",
			});

			const found = context.pastRecommendations.find((rec) => rec.title === "Past Recommendation");
			expect(found).toBeDefined();
			expect(found!.year).toBe(REC_YEAR);
		});

		it("returns empty context when no library items", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			const context = await buildExclusionContext(userId, app.db, {
				mediaType: "either",
			});

			expect(context.titles).toHaveLength(EMPTY_COUNT);
			expect(context.summary.movieCount).toBe(EMPTY_COUNT);
			expect(context.summary.showCount).toBe(EMPTY_COUNT);
			expect(context.summary.topGenres).toHaveLength(EMPTY_COUNT);
			expect(context.pastRecommendations).toHaveLength(EMPTY_COUNT);
		});
	});

	describe(shouldAutoSync, () => {
		it("returns false when interval is manual", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			const now = new Date().toISOString();
			app.db
				.insert(userSettings)
				.values({
					id: "settings-1",
					userId,
					librarySyncInterval: "manual",
					librarySyncLast: now,
				})
				.run();

			const result = await shouldAutoSync(userId, app.db);

			expect(result).toBe(false);
		});

		it("returns true when interval has elapsed since last sync", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			// Last synced 25 hours ago, interval is 24h
			const oneDayAgo = new Date(Date.now() - HOURS_25_MS).toISOString();

			app.db
				.insert(userSettings)
				.values({
					id: "settings-1",
					userId,
					librarySyncInterval: "24h",
					librarySyncLast: oneDayAgo,
				})
				.run();

			const result = await shouldAutoSync(userId, app.db);

			expect(result).toBe(true);
		});

		it("returns false when interval has not elapsed", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			// Last synced 1 hour ago, interval is 24h
			const oneHourAgo = new Date(Date.now() - HOURS_1_MS).toISOString();

			app.db
				.insert(userSettings)
				.values({
					id: "settings-1",
					userId,
					librarySyncInterval: "24h",
					librarySyncLast: oneHourAgo,
				})
				.run();

			const result = await shouldAutoSync(userId, app.db);

			expect(result).toBe(false);
		});

		it("returns true when interval is set and never synced", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			app.db
				.insert(userSettings)
				.values({
					id: "settings-1",
					userId,
					librarySyncInterval: "6h",
					librarySyncLast: undefined,
				})
				.run();

			const result = await shouldAutoSync(userId, app.db);

			expect(result).toBe(true);
		});

		it("returns false when no userSettings row exists (defaults to manual)", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			const result = await shouldAutoSync(userId, app.db);

			expect(result).toBe(false);
		});

		it("handles 6h, 12h, 7d intervals", async () => {
			const app = await setupDb();
			const { userId } = await registerUser(app);

			// Last synced 8 hours ago, interval 6h — should sync
			const eightHoursAgo = new Date(Date.now() - HOURS_8_MS).toISOString();

			app.db
				.insert(userSettings)
				.values({
					id: "settings-1",
					userId,
					librarySyncInterval: "6h",
					librarySyncLast: eightHoursAgo,
				})
				.run();

			const result6h = await shouldAutoSync(userId, app.db);
			expect(result6h).toBe(true);

			// Update to 12h interval — 8 hours ago should not trigger yet
			app.db
				.update(userSettings)
				.set({ librarySyncInterval: "12h" })
				.where(eq(userSettings.userId, userId))
				.run();

			const result12h = await shouldAutoSync(userId, app.db);
			expect(result12h).toBe(false);

			// 8 days ago with 7d interval — should sync
			const eightDaysAgo = new Date(Date.now() - DAYS_8_MS).toISOString();
			app.db
				.update(userSettings)
				.set({ librarySyncInterval: "7d", librarySyncLast: eightDaysAgo })
				.where(eq(userSettings.userId, userId))
				.run();

			const result7d = await shouldAutoSync(userId, app.db);
			expect(result7d).toBe(true);
		});
	});
});
