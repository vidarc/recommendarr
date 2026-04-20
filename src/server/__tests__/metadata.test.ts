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
import { conversations, messages, metadataCache, recommendations, users } from "../schema.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TVDB_API_BASE = "https://api4.thetvdb.com/v4";
const MOCK_TMDB_KEY = "test-tmdb-key";
const MOCK_TVDB_KEY = "test-tvdb-key";
const INCEPTION_TMDB_ID = 27_205;
const BREAKING_BAD_TVDB_ID = 81_189;
const ONE_CACHE_ENTRY = 1;
const MIN_CAST_COUNT = 1;

const testDbDir = join(tmpdir(), "recommendarr-test-metadata");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };

const mockTmdbMovie = {
	id: INCEPTION_TMDB_ID,
	title: "Inception",
	overview: "A thief who steals corporate secrets.",
	poster_path: "/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg",
	genres: [{ id: 28, name: "Action" }],
	vote_average: 8.4,
	release_date: "2010-07-16",
	status: "Released",
};

const mockTmdbCredits = {
	cast: [
		{
			name: "Leonardo DiCaprio",
			known_for_department: "Acting",
			character: "Cobb",
			order: 0,
		},
	],
	crew: [{ name: "Christopher Nolan", department: "Directing", job: "Director" }],
};

const mockTvdbLogin = { status: "success", data: { token: "mock-token" } };

const mockTvdbSearch = {
	status: "success",
	data: [
		{
			tvdb_id: String(BREAKING_BAD_TVDB_ID),
			name: "Breaking Bad",
			overview: "A chemistry teacher turned drug manufacturer.",
			image_url: `https://artworks.thetvdb.com/banners/posters/${String(BREAKING_BAD_TVDB_ID)}-1.jpg`,
			year: "2008",
			type: "series",
		},
	],
};

const mockTvdbExtended = {
	status: "success",
	data: {
		id: BREAKING_BAD_TVDB_ID,
		name: "Breaking Bad",
		overview: "A chemistry teacher turned drug manufacturer.",
		image: `https://artworks.thetvdb.com/banners/posters/${String(BREAKING_BAD_TVDB_ID)}-1.jpg`,
		year: "2008",
		genres: [{ name: "Drama" }],
		score: 9.5,
		status: { name: "Ended" },
		characters: [
			{
				name: "Walter White",
				peopleType: "Actor",
				personName: "Bryan Cranston",
			},
		],
	},
};

const handlers = [
	http.get(`${TMDB_API_BASE}/movie/${String(INCEPTION_TMDB_ID)}`, () =>
		HttpResponse.json(mockTmdbMovie),
	),
	http.get(`${TMDB_API_BASE}/movie/${String(INCEPTION_TMDB_ID)}/credits`, () =>
		HttpResponse.json(mockTmdbCredits),
	),
	http.post(`${TVDB_API_BASE}/login`, () => HttpResponse.json(mockTvdbLogin)),
	http.get(`${TVDB_API_BASE}/search`, () => HttpResponse.json(mockTvdbSearch)),
	http.get(`${TVDB_API_BASE}/series/${String(BREAKING_BAD_TVDB_ID)}/extended`, () =>
		HttpResponse.json(mockTvdbExtended),
	),
];

const mswServer = setupServer(...handlers);

const setupDb = async () => {
	vi.stubEnv("DATABASE_PATH", testDbPath);
	vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
	vi.stubEnv("TMDB_API_KEY", MOCK_TMDB_KEY);
	vi.stubEnv("TVDB_API_KEY", MOCK_TVDB_KEY);
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		vi.unstubAllEnvs();
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true, force: true });
		}
	});

	// Register + get session
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
	const sessionId = session.id;
	const userId = user.id;

	return { app, sessionId, userId };
};

const createRecommendation = (
	app: Awaited<ReturnType<typeof setupDb>>["app"],
	userId: string,
	overrides: {
		mediaType: string;
		tmdbId?: number;
		tvdbId?: number;
		title?: string;
	},
) => {
	const convId = "conv-1";
	const msgId = "msg-1";
	const recId = "rec-1";

	app.db
		.insert(conversations)
		.values({
			id: convId,
			userId,
			mediaType: overrides.mediaType,
			createdAt: new Date().toISOString(),
		})
		.onConflictDoNothing()
		.run();

	app.db
		.insert(messages)
		.values({
			id: msgId,
			conversationId: convId,
			role: "assistant",
			content: "Here are my recommendations.",
			createdAt: new Date().toISOString(),
		})
		.onConflictDoNothing()
		.run();

	app.db
		.insert(recommendations)
		.values({
			id: recId,
			messageId: msgId,
			title: overrides.title ?? "Inception",
			year: 2010,
			mediaType: overrides.mediaType,
			synopsis: "A thief who steals corporate secrets.",
			tmdbId: overrides.tmdbId,
			tvdbId: overrides.tvdbId,
		})
		.onConflictDoNothing()
		.run();

	return recId;
};

describe("gET /api/metadata/status", () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	it("returns availability of both sources", async () => {
		const { app, sessionId } = await setupDb();
		const res = await app.inject({
			method: "GET",
			url: "/api/metadata/status",
			cookies: { session: sessionId },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.tvdb).toBe(true);
		expect(body.tmdb).toBe(true);
	});
});

describe("gET /api/metadata/:recommendationId", () => {
	it("returns TMDB metadata for a movie recommendation with tmdbId", async () => {
		const { app, sessionId, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "movie",
			tmdbId: INCEPTION_TMDB_ID,
		});

		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			cookies: { session: sessionId },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.available).toBe(true);
		expect(body.title).toBe("Inception");
		expect(body.source).toBe("tmdb");
		expect(body.cast.length).toBeGreaterThanOrEqual(MIN_CAST_COUNT);
	});

	it("returns TVDB metadata for a show recommendation via search", async () => {
		const { app, sessionId, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "show",
			title: "Breaking Bad",
		});

		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			cookies: { session: sessionId },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.available).toBe(true);
		expect(body.source).toBe("tvdb");
		expect(body.title).toBe("Breaking Bad");
	});

	it("returns cached metadata on second request", async () => {
		const { app, sessionId, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "movie",
			tmdbId: INCEPTION_TMDB_ID,
		});

		// First request populates cache
		await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			cookies: { session: sessionId },
		});

		// Verify cache entry exists
		const cached = app.db.select().from(metadataCache).all();
		expect(cached).toHaveLength(ONE_CACHE_ENTRY);

		// Second request should use cache
		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			cookies: { session: sessionId },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		expect(res.json().available).toBe(true);
	});

	it("returns unavailable when recommendation not found", async () => {
		const { app, sessionId } = await setupDb();
		const res = await app.inject({
			method: "GET",
			url: "/api/metadata/nonexistent-id",
			cookies: { session: sessionId },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		expect(res.json().available).toBe(false);
	});
});
