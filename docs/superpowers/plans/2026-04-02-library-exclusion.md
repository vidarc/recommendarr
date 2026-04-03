# Library Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude already-owned content (Plex, Radarr/Sonarr, past recommendations) from AI recommendations using prompt injection + post-parse filtering, with cached library data and user-configurable sync.

**Architecture:** New `library_items` and `user_settings` tables cache library contents. A `library-sync` service fetches from Plex/arr APIs and stores locally. The prompt builder injects taste profile + exclusion lists. A post-parse filter catches AI misses and triggers backfill. Settings UI adds a Library tab; chat UI adds an exclude toggle.

**Tech Stack:** Drizzle ORM (SQLite), Fastify routes, Plex XML/JSON API, Radarr/Sonarr v3 API, React + RTK Query, Linaria CSS-in-JS

---

### Task 1: Schema — `library_items` and `user_settings` tables

**Files:**

- Modify: `src/server/schema.ts`

- [ ] **Step 1: Add `libraryItems` table definition**

In `src/server/schema.ts`, add after the `arrConnections` definition (before the exports):

```typescript
const libraryItems = sqliteTable(
	"library_items",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		title: text("title").notNull(),
		year: integer("year"),
		mediaType: text("media_type").notNull(),
		source: text("source").notNull(),
		plexRatingKey: text("plex_rating_key"),
		externalId: text("external_id"),
		genres: text("genres"),
		syncedAt: text("synced_at").notNull(),
	},
	(table) => [
		uniqueIndex("library_user_source_title_year_idx").on(
			table.userId,
			table.source,
			table.title,
			table.year,
		),
	],
);

const selectLibraryItemSchema = createSelectSchema(libraryItems);
const insertLibraryItemSchema = createInsertSchema(libraryItems);
```

- [ ] **Step 2: Add `userSettings` table definition**

In `src/server/schema.ts`, add after `libraryItems`:

```typescript
const userSettings = sqliteTable("user_settings", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	librarySyncInterval: text("library_sync_interval").notNull().default("manual"),
	librarySyncLast: text("library_sync_last"),
	excludeLibraryDefault: integer("exclude_library_default", { mode: "boolean" })
		.notNull()
		.default(true),
});

const selectUserSettingsSchema = createSelectSchema(userSettings);
const insertUserSettingsSchema = createInsertSchema(userSettings);
```

- [ ] **Step 3: Update exports**

Add to the export block in `src/server/schema.ts`:

```typescript
libraryItems,
insertLibraryItemSchema,
selectLibraryItemSchema,
userSettings,
insertUserSettingsSchema,
selectUserSettingsSchema,
```

- [ ] **Step 4: Update db plugin schema registration**

In `src/server/db.ts`, add `libraryItems` and `userSettings` to the import and to the `schema` object in the `drizzle()` call:

```typescript
import {
	// ... existing imports
	libraryItems,
	userSettings,
} from "./schema.ts";

// In drizzle() call, add to schema:
schema: {
	// ... existing tables
	libraryItems,
	userSettings,
},
```

- [ ] **Step 5: Generate and verify migration**

Run:

```bash
yarn vp dlx drizzle-kit generate
```

Expected: A new migration folder in `drizzle/` with SQL creating `library_items` and `user_settings` tables.

- [ ] **Step 6: Verify migration SQL**

Read the generated `migration.sql` and confirm it contains:

- `CREATE TABLE library_items` with all columns and the unique index
- `CREATE TABLE user_settings` with all columns and unique constraint on `user_id`

- [ ] **Step 7: Run tests**

Run:

```bash
yarn vp test src/server/__tests__/db.test.ts
```

Expected: PASS — existing db tests still work with new tables.

- [ ] **Step 8: Commit**

```bash
git add src/server/schema.ts src/server/db.ts drizzle/
git commit -m "feat: add library_items and user_settings tables for library exclusion"
```

---

### Task 2: Plex API — `getLibraryContents` function

**Files:**

- Modify: `src/server/services/plex-api.ts`
- Create: `src/server/__tests__/plex-api-library.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/plex-api-library.test.ts`:

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import { getLibraryContents } from "../services/plex-api.ts";

const MOCK_PLEX_SERVER = "https://plex.test.example.com";

const EXPECTED_MOVIE_COUNT = 3;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const THIRD_INDEX = 2;
const PAGE_SIZE = 2;

const allMovies = [
	{
		title: "The Matrix",
		type: "movie",
		year: 1999,
		ratingKey: "1",
		Genre: [{ tag: "Sci-Fi" }, { tag: "Action" }],
	},
	{
		title: "Inception",
		type: "movie",
		year: 2010,
		ratingKey: "2",
		Genre: [{ tag: "Sci-Fi" }, { tag: "Thriller" }],
	},
	{
		title: "Interstellar",
		type: "movie",
		year: 2014,
		ratingKey: "3",
		Genre: [{ tag: "Sci-Fi" }, { tag: "Drama" }],
	},
];

const handlers = [
	http.get(`${MOCK_PLEX_SERVER}/library/sections/1/all`, ({ request }) => {
		const url = new URL(request.url);
		const start = Number(url.searchParams.get("X-Plex-Container-Start") ?? "0");
		const size = Number(url.searchParams.get("X-Plex-Container-Size") ?? "200");
		const slice = allMovies.slice(start, start + size);

		return HttpResponse.json({
			MediaContainer: {
				totalSize: allMovies.length,
				Metadata: slice,
			},
		});
	}),
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

describe("getLibraryContents", () => {
	test("fetches all items from a library", async () => {
		const items = await getLibraryContents({
			serverUrl: MOCK_PLEX_SERVER,
			authToken: "test-token",
			libraryId: "1",
		});

		expect(items).toHaveLength(EXPECTED_MOVIE_COUNT);
		expect(items[FIRST_INDEX]?.title).toBe("The Matrix");
		expect(items[FIRST_INDEX]?.genres).toBe("Sci-Fi,Action");
		expect(items[SECOND_INDEX]?.title).toBe("Inception");
		expect(items[THIRD_INDEX]?.title).toBe("Interstellar");
	});

	test("paginates through large libraries", async () => {
		const items = await getLibraryContents({
			serverUrl: MOCK_PLEX_SERVER,
			authToken: "test-token",
			libraryId: "1",
			pageSize: PAGE_SIZE,
		});

		expect(items).toHaveLength(EXPECTED_MOVIE_COUNT);
	});

	test("handles empty library", async () => {
		mswServer.use(
			http.get(`${MOCK_PLEX_SERVER}/library/sections/2/all`, () =>
				HttpResponse.json({ MediaContainer: { totalSize: 0, Metadata: [] } }),
			),
		);

		const items = await getLibraryContents({
			serverUrl: MOCK_PLEX_SERVER,
			authToken: "test-token",
			libraryId: "2",
		});

		expect(items).toHaveLength(FIRST_INDEX);
	});

	test("extracts genres from Genre array", async () => {
		const items = await getLibraryContents({
			serverUrl: MOCK_PLEX_SERVER,
			authToken: "test-token",
			libraryId: "1",
		});

		expect(items[FIRST_INDEX]?.genres).toBe("Sci-Fi,Action");
		expect(items[SECOND_INDEX]?.genres).toBe("Sci-Fi,Thriller");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/plex-api-library.test.ts
```

Expected: FAIL — `getLibraryContents` is not exported from `plex-api.ts`.

- [ ] **Step 3: Implement `getLibraryContents`**

In `src/server/services/plex-api.ts`, add the response schema, types, and function:

```typescript
const DEFAULT_PAGE_SIZE = 200;
const FIRST_PAGE = 0;

interface PlexLibraryItem {
	title: string;
	type: string;
	year: number | undefined;
	ratingKey: string;
	genres: string | undefined;
}

interface LibraryContentsOptions {
	serverUrl: string;
	authToken: string;
	libraryId: string;
	pageSize?: number;
}

const plexLibraryContentsResponseSchema = z.object({
	MediaContainer: z.object({
		totalSize: z.number(),
		Metadata: z
			.array(
				z.object({
					title: z.string(),
					type: z.string(),
					year: z.number().optional(),
					ratingKey: z.string(),
					Genre: z.array(z.object({ tag: z.string() })).optional(),
				}),
			)
			.optional(),
	}),
});

const getLibraryContents = async (options: LibraryContentsOptions): Promise<PlexLibraryItem[]> => {
	const { serverUrl, authToken, libraryId, pageSize = DEFAULT_PAGE_SIZE } = options;
	const allItems: PlexLibraryItem[] = [];
	let start = FIRST_PAGE;

	// eslint-disable-next-line no-constant-condition -- pagination loop
	while (true) {
		const params = new URLSearchParams({
			"X-Plex-Container-Start": start.toString(),
			"X-Plex-Container-Size": pageSize.toString(),
		});

		const url = `${serverUrl}/library/sections/${libraryId}/all?${params.toString()}`;
		const response = await fetch(url, {
			method: "GET",
			headers: plexHeaders(authToken),
		});

		if (!response.ok) {
			throw new Error(`Failed to get library contents: ${response.status.toString()}`);
		}

		const data = plexLibraryContentsResponseSchema.parse(await response.json());
		const metadata = data.MediaContainer.Metadata ?? [];

		for (const item of metadata) {
			allItems.push({
				title: item.title,
				type: item.type,
				year: item.year,
				ratingKey: item.ratingKey,
				genres: item.Genre?.map((genre) => genre.tag).join(","),
			});
		}

		start += metadata.length;

		if (start >= data.MediaContainer.totalSize || metadata.length === 0) {
			break;
		}
	}

	return allItems;
};
```

Update the exports to include:

```typescript
export {
	checkPlexPin,
	createPlexPin,
	getLibraryContents,
	getPlexLibraries,
	getPlexServers,
	getWatchHistory,
};

export type {
	LibraryContentsOptions,
	PlexLibrary,
	PlexLibraryItem,
	PlexPin,
	PlexPinCheck,
	PlexServer,
	PlexWatchedItem,
	WatchHistoryOptions,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/plex-api-library.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all existing plex tests**

Run:

```bash
yarn vp test src/server/__tests__/plex.test.ts
```

Expected: PASS — existing tests unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/plex-api.ts src/server/__tests__/plex-api-library.test.ts
git commit -m "feat: add getLibraryContents for paginated Plex library fetching"
```

---

### Task 3: Arr client — `getAllMovies` and `getAllSeries` functions

**Files:**

- Modify: `src/server/services/arr-client.ts`
- Modify: `src/server/__tests__/arr-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/server/__tests__/arr-client.test.ts`:

```typescript
// Add these imports if not already present
import { getAllMovies, getAllSeries } from "../services/arr-client.ts";

// Add these test constants
const EXPECTED_MOVIE_COUNT = 2;
const EXPECTED_SERIES_COUNT = 2;

describe("getAllMovies", () => {
	test("fetches all movies from Radarr", async () => {
		mswServer.use(
			http.get("https://radarr.test.example.com/api/v3/movie", () =>
				HttpResponse.json([
					{ id: 1, title: "The Matrix", year: 1999, tmdbId: 603, genres: ["Sci-Fi", "Action"] },
					{ id: 2, title: "Inception", year: 2010, tmdbId: 27205, genres: ["Sci-Fi", "Thriller"] },
				]),
			),
		);

		const movies = await getAllMovies("https://radarr.test.example.com", "test-api-key");
		expect(movies).toHaveLength(EXPECTED_MOVIE_COUNT);
		expect(movies[0]?.title).toBe("The Matrix");
		expect(movies[0]?.tmdbId).toBe(603);
		expect(movies[0]?.genres).toBe("Sci-Fi,Action");
	});

	test("handles empty library", async () => {
		mswServer.use(
			http.get("https://radarr.test.example.com/api/v3/movie", () => HttpResponse.json([])),
		);

		const movies = await getAllMovies("https://radarr.test.example.com", "test-api-key");
		expect(movies).toHaveLength(0);
	});
});

describe("getAllSeries", () => {
	test("fetches all series from Sonarr", async () => {
		mswServer.use(
			http.get("https://sonarr.test.example.com/api/v3/series", () =>
				HttpResponse.json([
					{ id: 1, title: "Breaking Bad", year: 2008, tvdbId: 81189, genres: ["Drama", "Crime"] },
					{ id: 2, title: "The Wire", year: 2002, tvdbId: 79126, genres: ["Drama", "Crime"] },
				]),
			),
		);

		const series = await getAllSeries("https://sonarr.test.example.com", "test-api-key");
		expect(series).toHaveLength(EXPECTED_SERIES_COUNT);
		expect(series[0]?.title).toBe("Breaking Bad");
		expect(series[0]?.tvdbId).toBe(81189);
		expect(series[0]?.genres).toBe("Drama,Crime");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/arr-client.test.ts
```

Expected: FAIL — `getAllMovies` and `getAllSeries` not exported.

- [ ] **Step 3: Implement `getAllMovies` and `getAllSeries`**

In `src/server/services/arr-client.ts`, add:

```typescript
interface ArrLibraryMovie {
	title: string;
	year: number;
	tmdbId: number;
	genres: string;
}

interface ArrLibrarySeries {
	title: string;
	year: number;
	tvdbId: number;
	genres: string;
}

const allMoviesSchema = z.array(
	z.object({
		title: z.string(),
		year: z.number(),
		tmdbId: z.number(),
		genres: z.array(z.string()),
	}),
);

const allSeriesSchema = z.array(
	z.object({
		title: z.string(),
		year: z.number(),
		tvdbId: z.number(),
		genres: z.array(z.string()),
	}),
);

const getAllMovies = async (url: string, apiKey: string): Promise<ArrLibraryMovie[]> => {
	const response = await arrFetch({ url, apiKey, path: "/movie" });
	if (!response.ok) {
		throw new Error(`Failed to get all movies: ${response.status.toString()}`);
	}
	const data = allMoviesSchema.parse(await response.json());
	return data.map((movie) => ({
		title: movie.title,
		year: movie.year,
		tmdbId: movie.tmdbId,
		genres: movie.genres.join(","),
	}));
};

const getAllSeries = async (url: string, apiKey: string): Promise<ArrLibrarySeries[]> => {
	const response = await arrFetch({ url, apiKey, path: "/series" });
	if (!response.ok) {
		throw new Error(`Failed to get all series: ${response.status.toString()}`);
	}
	const data = allSeriesSchema.parse(await response.json());
	return data.map((series) => ({
		title: series.title,
		year: series.year,
		tvdbId: series.tvdbId,
		genres: series.genres.join(","),
	}));
};
```

Update exports:

```typescript
export {
	addMedia,
	getAllMovies,
	getAllSeries,
	getQualityProfiles,
	getRootFolders,
	lookupMedia,
	testConnection,
};
export type {
	// ... existing types
	ArrLibraryMovie,
	ArrLibrarySeries,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/arr-client.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/arr-client.ts src/server/__tests__/arr-client.test.ts
git commit -m "feat: add getAllMovies and getAllSeries for library sync"
```

---

### Task 4: Library sync service

**Files:**

- Create: `src/server/services/library-sync.ts`
- Create: `src/server/__tests__/library-sync.test.ts`

- [ ] **Step 1: Write the failing test for `syncLibrary`**

Create `src/server/__tests__/library-sync.test.ts`:

```typescript
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
	test,
	vi,
} from "vite-plus/test";

import { buildServer } from "../app.ts";
import { arrConnections, libraryItems, plexConnections, userSettings, users } from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";
import { buildExclusionContext, shouldAutoSync, syncLibrary } from "../services/library-sync.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_PLEX_SERVER = "https://plex.test.example.com";
const MOCK_RADARR_URL = "https://radarr.test.example.com";
const MOCK_SONARR_URL = "https://sonarr.test.example.com";
const EXPECTED_PLEX_ITEMS = 2;
const EXPECTED_TOTAL_ITEMS = 4;

const testDbDir = join(tmpdir(), "recommendarr-test-library-sync");
const testDbPath = join(testDbDir, "test.db");

const plexMovies = [
	{
		title: "The Matrix",
		type: "movie",
		year: 1999,
		ratingKey: "1",
		Genre: [{ tag: "Sci-Fi" }, { tag: "Action" }],
	},
	{ title: "Inception", type: "movie", year: 2010, ratingKey: "2", Genre: [{ tag: "Sci-Fi" }] },
];

const radarrMovies = [
	{ title: "Interstellar", year: 2014, tmdbId: 157336, genres: ["Sci-Fi", "Drama"] },
];

const sonarrSeries = [
	{ title: "Breaking Bad", year: 2008, tvdbId: 81189, genres: ["Drama", "Crime"] },
];

const handlers = [
	http.get(`${MOCK_PLEX_SERVER}/library/sections`, () =>
		HttpResponse.json({
			MediaContainer: {
				Directory: [{ key: "1", title: "Movies", type: "movie" }],
			},
		}),
	),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/1/all`, () =>
		HttpResponse.json({
			MediaContainer: { totalSize: plexMovies.length, Metadata: plexMovies },
		}),
	),
	http.get(`${MOCK_RADARR_URL}/api/v3/movie`, () => HttpResponse.json(radarrMovies)),
	http.get(`${MOCK_SONARR_URL}/api/v3/series`, () => HttpResponse.json(sonarrSeries)),
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

const createTestUser = async (app: Awaited<ReturnType<typeof buildServer>>) => {
	await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: { username: "testuser", password: "password123" },
	});

	const user = app.db.select().from(users).where(eq(users.username, "testuser")).get();
	if (!user) throw new Error("User not found");
	return user.id;
};

const setupConnections = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();

	const plexConn = {
		id: "plex-1",
		userId,
		authToken: encrypt("plex-token"),
		serverUrl: MOCK_PLEX_SERVER,
		serverName: "Test Server",
		machineIdentifier: "test-machine",
		createdAt: now,
		updatedAt: now,
	};
	app.db.insert(plexConnections).values(plexConn).run();

	const radarrConn = {
		id: "radarr-1",
		userId,
		serviceType: "radarr" as const,
		url: MOCK_RADARR_URL,
		apiKey: encrypt("radarr-key"),
		createdAt: now,
		updatedAt: now,
	};
	app.db.insert(arrConnections).values(radarrConn).run();

	const sonarrConn = {
		id: "sonarr-1",
		userId,
		serviceType: "sonarr" as const,
		url: MOCK_SONARR_URL,
		apiKey: encrypt("sonarr-key"),
		createdAt: now,
		updatedAt: now,
	};
	app.db.insert(arrConnections).values(sonarrConn).run();

	return {
		plexConnection: { ...plexConn },
		arrConns: [radarrConn, sonarrConn],
	};
};

describe("syncLibrary", () => {
	test("syncs items from Plex, Radarr, and Sonarr", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection, arrConns } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, arrConns);

		const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();
		expect(items).toHaveLength(EXPECTED_TOTAL_ITEMS);

		const plexItems = items.filter((item) => item.source === "plex");
		expect(plexItems).toHaveLength(EXPECTED_PLEX_ITEMS);

		const radarrItems = items.filter((item) => item.source === "radarr");
		expect(radarrItems).toHaveLength(1);
		expect(radarrItems[0]?.title).toBe("Interstellar");

		const sonarrItems = items.filter((item) => item.source === "sonarr");
		expect(sonarrItems).toHaveLength(1);
		expect(sonarrItems[0]?.title).toBe("Breaking Bad");
	});

	test("replaces existing items on re-sync", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection, arrConns } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, arrConns);
		await syncLibrary(userId, app.db, plexConnection, arrConns);

		const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();
		expect(items).toHaveLength(EXPECTED_TOTAL_ITEMS);
	});

	test("syncs Plex only when no arr connections", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, []);

		const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();
		expect(items).toHaveLength(EXPECTED_PLEX_ITEMS);
	});

	test("updates librarySyncLast in user_settings", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection, arrConns } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, arrConns);

		const settings = app.db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId))
			.get();
		expect(settings?.librarySyncLast).toBeDefined();
	});
});

describe("buildExclusionContext", () => {
	test("returns titles, summary, and past recommendations", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection, arrConns } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, arrConns);

		const context = buildExclusionContext(userId, app.db, { mediaType: "either" });
		expect(context.titles.length).toBeGreaterThan(0);
		expect(context.summary.movieCount).toBe(3); // 2 plex + 1 radarr
		expect(context.summary.showCount).toBe(1); // 1 sonarr
		expect(context.summary.topGenres.length).toBeGreaterThan(0);
		expect(context.pastRecommendations).toHaveLength(0);
	});

	test("filters by mediaType movie", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);
		const { plexConnection, arrConns } = setupConnections(app, userId);

		await syncLibrary(userId, app.db, plexConnection, arrConns);

		const context = buildExclusionContext(userId, app.db, { mediaType: "movie" });
		const allMovies = context.titles.every((item) => item.mediaType === "movie");
		expect(allMovies).toBe(true);
	});
});

describe("shouldAutoSync", () => {
	test("returns false when interval is manual", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);

		const result = shouldAutoSync(userId, app.db);
		expect(result).toBe(false);
	});

	test("returns true when interval has elapsed", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);

		const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
		app.db
			.insert(userSettings)
			.values({
				id: "us-1",
				userId,
				librarySyncInterval: "24h",
				librarySyncLast: yesterday,
				excludeLibraryDefault: true,
			})
			.run();

		const result = shouldAutoSync(userId, app.db);
		expect(result).toBe(true);
	});

	test("returns false when interval has not elapsed", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);

		const justNow = new Date().toISOString();
		app.db
			.insert(userSettings)
			.values({
				id: "us-1",
				userId,
				librarySyncInterval: "24h",
				librarySyncLast: justNow,
				excludeLibraryDefault: true,
			})
			.run();

		const result = shouldAutoSync(userId, app.db);
		expect(result).toBe(false);
	});

	test("returns true when never synced and interval is not manual", async () => {
		const app = await setupDb();
		const userId = await createTestUser(app);

		app.db
			.insert(userSettings)
			.values({
				id: "us-1",
				userId,
				librarySyncInterval: "6h",
				excludeLibraryDefault: true,
			})
			.run();

		const result = shouldAutoSync(userId, app.db);
		expect(result).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/library-sync.test.ts
```

Expected: FAIL — module `library-sync.ts` does not exist.

- [ ] **Step 3: Implement `library-sync.ts`**

Create `src/server/services/library-sync.ts`:

```typescript
import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { arrConnections, libraryItems, recommendations, userSettings } from "../schema.ts";
import { getAllMovies, getAllSeries } from "./arr-client.ts";
import { decrypt } from "./encryption.ts";
import { getLibraryContents, getPlexLibraries } from "./plex-api.ts";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const MAX_EXCLUSION_TITLES = 500;
const TOP_GENRE_COUNT = 5;

const INTERVAL_MS: Record<string, number> = {
	"6h": 6 * 60 * 60 * 1000,
	"12h": 12 * 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
};

interface PlexConnectionRow {
	authToken: string;
	serverUrl: string | null;
}

interface ArrConnectionRow {
	serviceType: string;
	url: string;
	apiKey: string;
}

interface ExclusionTitle {
	title: string;
	year: number | undefined;
	mediaType: string;
}

interface ExclusionSummary {
	movieCount: number;
	showCount: number;
	topGenres: string[];
}

interface ExclusionContext {
	titles: ExclusionTitle[];
	summary: ExclusionSummary;
	pastRecommendations: { title: string; year: number | undefined }[];
}

const syncLibrary = async (
	userId: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
	plexConnection: PlexConnectionRow,
	arrConns: ArrConnectionRow[],
): Promise<void> => {
	const now = new Date().toISOString();
	const items: {
		id: string;
		userId: string;
		title: string;
		year: number | undefined;
		mediaType: string;
		source: string;
		plexRatingKey: string | undefined;
		externalId: string | undefined;
		genres: string | undefined;
		syncedAt: string;
	}[] = [];

	// Plex sync
	if (plexConnection.serverUrl) {
		const authToken = decrypt(plexConnection.authToken);
		const libraries = await getPlexLibraries(plexConnection.serverUrl, authToken);

		for (const library of libraries) {
			const contents = await getLibraryContents({
				serverUrl: plexConnection.serverUrl,
				authToken,
				libraryId: library.key,
			});

			for (const item of contents) {
				const mediaType = item.type === "show" ? "show" : "movie";
				items.push({
					id: randomUUID(),
					userId,
					title: item.title,
					year: item.year,
					mediaType,
					source: "plex",
					plexRatingKey: item.ratingKey,
					externalId: undefined,
					genres: item.genres,
					syncedAt: now,
				});
			}
		}
	}

	// Radarr sync
	const radarrConn = arrConns.find((conn) => conn.serviceType === "radarr");
	if (radarrConn) {
		const apiKey = decrypt(radarrConn.apiKey);
		const movies = await getAllMovies(radarrConn.url, apiKey);

		for (const movie of movies) {
			items.push({
				id: randomUUID(),
				userId,
				title: movie.title,
				year: movie.year,
				mediaType: "movie",
				source: "radarr",
				plexRatingKey: undefined,
				externalId: movie.tmdbId.toString(),
				genres: movie.genres,
				syncedAt: now,
			});
		}
	}

	// Sonarr sync
	const sonarrConn = arrConns.find((conn) => conn.serviceType === "sonarr");
	if (sonarrConn) {
		const apiKey = decrypt(sonarrConn.apiKey);
		const series = await getAllSeries(sonarrConn.url, apiKey);

		for (const show of series) {
			items.push({
				id: randomUUID(),
				userId,
				title: show.title,
				year: show.year,
				mediaType: "show",
				source: "sonarr",
				plexRatingKey: undefined,
				externalId: show.tvdbId.toString(),
				genres: show.genres,
				syncedAt: now,
			});
		}
	}

	// Upsert: delete existing, insert fresh, update timestamp
	db.delete(libraryItems).where(eq(libraryItems.userId, userId)).run();

	for (const item of items) {
		db.insert(libraryItems).values(item).run();
	}

	// Upsert user_settings with last sync time
	const existing = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
	if (existing) {
		db.update(userSettings)
			.set({ librarySyncLast: now })
			.where(eq(userSettings.userId, userId))
			.run();
	} else {
		db.insert(userSettings)
			.values({
				id: randomUUID(),
				userId,
				librarySyncInterval: "manual",
				librarySyncLast: now,
				excludeLibraryDefault: true,
			})
			.run();
	}
};

const buildExclusionContext = (
	userId: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
	options: { mediaType: "movie" | "show" | "either" },
): ExclusionContext => {
	// Get all library items for counts/genres
	const allItems = db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

	const movieCount = allItems.filter((item) => item.mediaType === "movie").length;
	const showCount = allItems.filter((item) => item.mediaType === "show").length;

	// Count genres
	const genreCounts = new Map<string, number>();
	for (const item of allItems) {
		if (item.genres) {
			for (const genre of item.genres.split(",")) {
				const trimmed = genre.trim();
				if (trimmed) {
					genreCounts.set(trimmed, (genreCounts.get(trimmed) ?? 0) + 1);
				}
			}
		}
	}

	const topGenres = [...genreCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, TOP_GENRE_COUNT)
		.map(([genre]) => genre);

	// Filter items by mediaType for the exclusion list
	const filteredItems =
		options.mediaType === "either"
			? allItems
			: allItems.filter((item) => item.mediaType === options.mediaType);

	const titles: ExclusionTitle[] = filteredItems.slice(0, MAX_EXCLUSION_TITLES).map((item) => ({
		title: item.title,
		year: item.year ?? undefined,
		mediaType: item.mediaType,
	}));

	// Get past recommendations for this user (across all conversations)
	const pastRecs = db
		.select({
			title: recommendations.title,
			year: recommendations.year,
		})
		.from(recommendations)
		.all();

	const pastRecommendations = pastRecs.map((rec) => ({
		title: rec.title,
		year: rec.year ?? undefined,
	}));

	return {
		titles,
		summary: { movieCount, showCount, topGenres },
		pastRecommendations,
	};
};

const shouldAutoSync = (
	userId: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
): boolean => {
	const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

	const interval = settings?.librarySyncInterval ?? "manual";
	if (interval === "manual") {
		return false;
	}

	const intervalMs = INTERVAL_MS[interval];
	if (!intervalMs) {
		return false;
	}

	const lastSync = settings?.librarySyncLast;
	if (!lastSync) {
		return true;
	}

	const elapsed = Date.now() - new Date(lastSync).getTime();
	return elapsed >= intervalMs;
};

export { buildExclusionContext, shouldAutoSync, syncLibrary };

export type { ArrConnectionRow, ExclusionContext, ExclusionTitle, PlexConnectionRow };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/library-sync.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/library-sync.ts src/server/__tests__/library-sync.test.ts
git commit -m "feat: add library sync service with exclusion context builder"
```

---

### Task 5: Prompt builder — exclusion context support

**Files:**

- Modify: `src/server/services/prompt-builder.ts`
- Modify: `src/server/__tests__/prompt-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/server/__tests__/prompt-builder.test.ts`:

```typescript
test("includes library taste profile when exclusion context provided", () => {
	const prompt = buildSystemPrompt({
		watchHistory: [],
		mediaType: "movie",
		resultCount: 5,
		exclusionContext: {
			titles: [
				{ title: "The Matrix", year: 1999, mediaType: "movie" },
				{ title: "Inception", year: 2010, mediaType: "movie" },
			],
			summary: { movieCount: 50, showCount: 20, topGenres: ["Sci-Fi", "Action", "Drama"] },
			pastRecommendations: [{ title: "Blade Runner", year: 1982 }],
		},
	});

	expect(prompt).toContain("50 movies");
	expect(prompt).toContain("20 shows");
	expect(prompt).toContain("Sci-Fi");
	expect(prompt).toContain("do NOT recommend");
	expect(prompt).toContain("The Matrix (1999)");
	expect(prompt).toContain("Inception (2010)");
	expect(prompt).toContain("Blade Runner (1982)");
});

test("omits exclusion sections when no exclusion context", () => {
	const prompt = buildSystemPrompt({
		watchHistory: [],
		mediaType: "movie",
		resultCount: 5,
	});

	expect(prompt).not.toContain("do NOT recommend");
	expect(prompt).not.toContain("already been recommended");
});

test("handles exclusion context with no past recommendations", () => {
	const prompt = buildSystemPrompt({
		watchHistory: [],
		mediaType: "movie",
		resultCount: 5,
		exclusionContext: {
			titles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
			summary: { movieCount: 1, showCount: 0, topGenres: ["Sci-Fi"] },
			pastRecommendations: [],
		},
	});

	expect(prompt).toContain("do NOT recommend");
	expect(prompt).not.toContain("already been recommended");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/prompt-builder.test.ts
```

Expected: FAIL — `exclusionContext` not recognized / no exclusion sections in output.

- [ ] **Step 3: Update prompt builder**

In `src/server/services/prompt-builder.ts`, update the interface and function:

```typescript
interface ExclusionContext {
	titles: { title: string; year?: number; mediaType: string }[];
	summary: { movieCount: number; showCount: number; topGenres: string[] };
	pastRecommendations: { title: string; year?: number }[];
}

interface BuildSystemPromptOptions {
	watchHistory: WatchHistoryItem[];
	mediaType: string;
	resultCount: number;
	exclusionContext?: ExclusionContext;
}

const formatExclusionTitles = (
	titles: { title: string; year?: number; mediaType: string }[],
): string => {
	const items = titles
		.map((item) => {
			const yearStr = item.year ? ` (${String(item.year)})` : "";
			return `- ${item.title}${yearStr} [${item.mediaType}]`;
		})
		.join("\n");
	return items;
};

const formatPastRecommendations = (recs: { title: string; year?: number }[]): string => {
	const items = recs
		.map((rec) => {
			const yearStr = rec.year ? ` (${String(rec.year)})` : "";
			return `- ${rec.title}${yearStr}`;
		})
		.join("\n");
	return items;
};

const EMPTY_ARRAY_LENGTH = 0;

const buildExclusionSection = (exclusionContext: ExclusionContext): string => {
	const sections: string[] = [];

	// Taste profile
	const { movieCount, showCount, topGenres } = exclusionContext.summary;
	if (topGenres.length > EMPTY_ARRAY_LENGTH) {
		sections.push(
			`Based on the user's library of ${String(movieCount)} movies and ${String(showCount)} shows, their favorite genres are: ${topGenres.join(", ")}. Prioritize recommendations that align with these tastes. Recommend content the user is likely to enjoy based on their library.`,
		);
	}

	// Exclusion list
	if (exclusionContext.titles.length > EMPTY_ARRAY_LENGTH) {
		sections.push(
			`The user already owns the following titles — do NOT recommend any of these:\n${formatExclusionTitles(exclusionContext.titles)}`,
		);
	}

	// Past recommendations
	if (exclusionContext.pastRecommendations.length > EMPTY_ARRAY_LENGTH) {
		sections.push(
			`The following have already been recommended in previous conversations — avoid repeating them unless the user specifically asks:\n${formatPastRecommendations(exclusionContext.pastRecommendations)}`,
		);
	}

	return sections.join("\n\n");
};
```

Update `buildSystemPrompt` to include the exclusion section:

```typescript
const buildSystemPrompt = (options: BuildSystemPromptOptions): string => {
	const { watchHistory, mediaType, resultCount, exclusionContext } = options;

	const mediaTypeInstruction =
		mediaType === "either"
			? "Recommend either movies or TV shows (or a mix of both)."
			: `Only recommend ${mediaType}s.`;

	const watchHistorySection =
		watchHistory.length > EMPTY_HISTORY_LENGTH
			? formatWatchHistory(watchHistory)
			: NO_HISTORY_MESSAGE;

	const exclusionSection = exclusionContext ? `\n\n${buildExclusionSection(exclusionContext)}` : "";

	return `You are a media recommendation assistant. Your job is to recommend movies and TV shows based on the user's watch history and preferences.

${watchHistorySection}

${mediaTypeInstruction}${exclusionSection}

When making recommendations, return exactly ${String(resultCount)} recommendations.

You MUST include a JSON block in your response with the recommendations in the following format:

\`\`\`json
[
  { "title": "Movie Title", "year": 2023, "mediaType": "movie", "synopsis": "Brief synopsis." },
  { "title": "Show Title", "year": 2020, "mediaType": "show", "synopsis": "Brief synopsis." }
]
\`\`\`

Include conversational text before and/or after the JSON block explaining your recommendations. The JSON block must be valid JSON wrapped in a markdown code fence.`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/prompt-builder.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/prompt-builder.ts src/server/__tests__/prompt-builder.test.ts
git commit -m "feat: add exclusion context support to prompt builder"
```

---

### Task 6: Post-parse filter — `filterExcludedRecommendations`

**Files:**

- Modify: `src/server/services/response-parser.ts`
- Modify: `src/server/__tests__/response-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/server/__tests__/response-parser.test.ts`:

```typescript
import { filterExcludedRecommendations } from "../services/response-parser.ts";

describe("filterExcludedRecommendations", () => {
	const SINGLE_ITEM = 1;

	test("filters out recommendations matching library items by title and year", () => {
		const result = filterExcludedRecommendations(
			[
				{ title: "The Matrix", year: 1999, mediaType: "movie", synopsis: "A hacker..." },
				{ title: "Blade Runner", year: 1982, mediaType: "movie", synopsis: "A detective..." },
			],
			{
				libraryTitles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
				pastRecommendations: [],
			},
		);

		expect(result.kept).toHaveLength(SINGLE_ITEM);
		expect(result.kept[FIRST_INDEX]?.title).toBe("Blade Runner");
		expect(result.filtered).toHaveLength(SINGLE_ITEM);
		expect(result.filtered[FIRST_INDEX]?.title).toBe("The Matrix");
	});

	test("matches case-insensitively", () => {
		const result = filterExcludedRecommendations(
			[{ title: "the matrix", year: 1999, mediaType: "movie", synopsis: "..." }],
			{
				libraryTitles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
				pastRecommendations: [],
			},
		);

		expect(result.kept).toHaveLength(FIRST_INDEX);
		expect(result.filtered).toHaveLength(SINGLE_ITEM);
	});

	test("falls back to title-only match when year is missing", () => {
		const result = filterExcludedRecommendations(
			[{ title: "The Matrix", mediaType: "movie", synopsis: "...", year: undefined }],
			{
				libraryTitles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
				pastRecommendations: [],
			},
		);

		expect(result.kept).toHaveLength(FIRST_INDEX);
		expect(result.filtered).toHaveLength(SINGLE_ITEM);
	});

	test("filters past recommendations", () => {
		const result = filterExcludedRecommendations(
			[
				{ title: "Inception", year: 2010, mediaType: "movie", synopsis: "..." },
				{ title: "Blade Runner", year: 1982, mediaType: "movie", synopsis: "..." },
			],
			{
				libraryTitles: [],
				pastRecommendations: [{ title: "Inception", year: 2010 }],
			},
		);

		expect(result.kept).toHaveLength(SINGLE_ITEM);
		expect(result.kept[FIRST_INDEX]?.title).toBe("Blade Runner");
	});

	test("keeps all when no matches", () => {
		const result = filterExcludedRecommendations(
			[{ title: "Blade Runner", year: 1982, mediaType: "movie", synopsis: "..." }],
			{
				libraryTitles: [{ title: "The Matrix", year: 1999, mediaType: "movie" }],
				pastRecommendations: [],
			},
		);

		expect(result.kept).toHaveLength(SINGLE_ITEM);
		expect(result.filtered).toHaveLength(FIRST_INDEX);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/response-parser.test.ts
```

Expected: FAIL — `filterExcludedRecommendations` not exported.

- [ ] **Step 3: Implement `filterExcludedRecommendations`**

Add to `src/server/services/response-parser.ts`:

```typescript
interface FilterInput {
	libraryTitles: { title: string; year?: number; mediaType: string }[];
	pastRecommendations: { title: string; year?: number }[];
}

interface FilterResult {
	kept: ParsedRecommendation[];
	filtered: ParsedRecommendation[];
}

const titlesMatch = (
	a: string,
	b: string,
	yearA: number | undefined,
	yearB: number | undefined,
): boolean => {
	const titleMatch = a.trim().toLowerCase() === b.trim().toLowerCase();
	if (!titleMatch) return false;

	// If either year is missing, match on title alone
	if (yearA === undefined || yearB === undefined) return true;

	return yearA === yearB;
};

const filterExcludedRecommendations = (
	recs: ParsedRecommendation[],
	filter: FilterInput,
): FilterResult => {
	const kept: ParsedRecommendation[] = [];
	const filtered: ParsedRecommendation[] = [];

	for (const rec of recs) {
		const inLibrary = filter.libraryTitles.some((lib) =>
			titlesMatch(rec.title, lib.title, rec.year, lib.year),
		);
		const inPast = filter.pastRecommendations.some((past) =>
			titlesMatch(rec.title, past.title, rec.year, past.year),
		);

		if (inLibrary || inPast) {
			filtered.push(rec);
		} else {
			kept.push(rec);
		}
	}

	return { kept, filtered };
};
```

Update exports:

```typescript
export { filterExcludedRecommendations, parseRecommendations };

export type { FilterInput, FilterResult, ParsedRecommendation, ParsedResponse };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/response-parser.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/response-parser.ts src/server/__tests__/response-parser.test.ts
git commit -m "feat: add post-parse filter for excluding owned/recommended titles"
```

---

### Task 7: Library routes — sync, status, settings

**Files:**

- Create: `src/server/routes/library.ts`
- Create: `src/server/__tests__/library.test.ts`
- Modify: `src/server/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/server/__tests__/library.test.ts`:

```typescript
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
import { arrConnections, plexConnections, userSettings, users } from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_PLEX_SERVER = "https://plex.test.example.com";

const testDbDir = join(tmpdir(), "recommendarr-test-library-routes");
const testDbPath = join(testDbDir, "test.db");

const handlers = [
	http.get(`${MOCK_PLEX_SERVER}/library/sections`, () =>
		HttpResponse.json({
			MediaContainer: {
				Directory: [{ key: "1", title: "Movies", type: "movie" }],
			},
		}),
	),
	http.get(`${MOCK_PLEX_SERVER}/library/sections/1/all`, () =>
		HttpResponse.json({
			MediaContainer: {
				totalSize: 2,
				Metadata: [
					{
						title: "The Matrix",
						type: "movie",
						year: 1999,
						ratingKey: "1",
						Genre: [{ tag: "Sci-Fi" }],
					},
					{
						title: "Inception",
						type: "movie",
						year: 2010,
						ratingKey: "2",
						Genre: [{ tag: "Sci-Fi" }],
					},
				],
			},
		}),
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
		payload: { username: "testuser", password: "password123" },
	});

	const user = app.db.select().from(users).where(eq(users.username, "testuser")).get();
	if (!user) throw new Error("User not found");

	const session = createSession(app.db, user.id);
	return { sessionId: session.id, userId: user.id };
};

describe("POST /api/library/sync", () => {
	test("syncs library and returns counts", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		const now = new Date().toISOString();
		app.db
			.insert(plexConnections)
			.values({
				id: "plex-1",
				userId,
				authToken: encrypt("plex-token"),
				serverUrl: MOCK_PLEX_SERVER,
				serverName: "Test",
				machineIdentifier: "test",
				createdAt: now,
				updatedAt: now,
			})
			.run();

		const response = await app.inject({
			method: "POST",
			url: "/api/library/sync",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.movieCount).toBe(2);
		expect(body.showCount).toBe(0);
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/library/sync",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("GET /api/library/status", () => {
	test("returns library status", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/library/status",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.interval).toBe("manual");
		expect(body.excludeDefault).toBe(true);
		expect(body.itemCount).toBe(0);
	});
});

describe("PUT /api/library/settings", () => {
	test("updates library settings", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "PUT",
			url: "/api/library/settings",
			cookies: { session: sessionId },
			payload: {
				interval: "24h",
				excludeDefault: false,
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);

		const settings = app.db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, userId))
			.get();
		expect(settings?.librarySyncInterval).toBe("24h");
		expect(settings?.excludeLibraryDefault).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/library.test.ts
```

Expected: FAIL — routes don't exist.

- [ ] **Step 3: Implement library routes**

Create `src/server/routes/library.ts`:

```typescript
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { arrConnections, libraryItems, plexConnections, userSettings } from "../schema.ts";
import { syncLibrary } from "../services/library-sync.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const errorResponseSchema = z.object({ error: z.string() });

const syncResponseSchema = z.object({
	movieCount: z.number(),
	showCount: z.number(),
	totalCount: z.number(),
});

const statusResponseSchema = z.object({
	lastSynced: z.string().nullable(),
	interval: z.string(),
	itemCount: z.number(),
	movieCount: z.number(),
	showCount: z.number(),
	excludeDefault: z.boolean(),
});

const settingsBodySchema = z.object({
	interval: z.enum(["manual", "6h", "12h", "24h", "7d"]),
	excludeDefault: z.boolean(),
});

const settingsResponseSchema = z.object({ success: z.boolean() });

const libraryRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/api/library/sync",
		{
			schema: {
				response: {
					[StatusCodes.OK]: syncResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const userId = request.user.id;

			const plexConnection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, userId))
				.get();

			if (!plexConnection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, userId))
				.all();

			await syncLibrary(userId, app.db, plexConnection, arrConns);

			const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

			const movieCount = items.filter((item) => item.mediaType === "movie").length;
			const showCount = items.filter((item) => item.mediaType === "show").length;

			return reply.code(StatusCodes.OK).send({
				movieCount,
				showCount,
				totalCount: items.length,
			});
		},
	);

	typedApp.get(
		"/api/library/status",
		{
			schema: {
				response: {
					[StatusCodes.OK]: statusResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const userId = request.user.id;

			const settings = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();

			const items = app.db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

			const movieCount = items.filter((item) => item.mediaType === "movie").length;
			const showCount = items.filter((item) => item.mediaType === "show").length;

			return reply.code(StatusCodes.OK).send({
				lastSynced: settings?.librarySyncLast ?? null,
				interval: settings?.librarySyncInterval ?? "manual",
				itemCount: items.length,
				movieCount,
				showCount,
				excludeDefault: settings?.excludeLibraryDefault ?? true,
			});
		},
	);

	typedApp.put(
		"/api/library/settings",
		{
			schema: {
				body: settingsBodySchema,
				response: {
					[StatusCodes.OK]: settingsResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const userId = request.user.id;
			const { interval, excludeDefault } = request.body;

			const existing = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, userId))
				.get();

			if (existing) {
				app.db
					.update(userSettings)
					.set({
						librarySyncInterval: interval,
						excludeLibraryDefault: excludeDefault,
					})
					.where(eq(userSettings.userId, userId))
					.run();
			} else {
				app.db
					.insert(userSettings)
					.values({
						id: randomUUID(),
						userId,
						librarySyncInterval: interval,
						excludeLibraryDefault: excludeDefault,
					})
					.run();
			}

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);
};

export { libraryRoutes };
```

- [ ] **Step 4: Register routes in app.ts**

In `src/server/app.ts`, add import and register:

```typescript
import { libraryRoutes } from "./routes/library.ts";

// In buildServer, inside the if (!options.skipDB) block, add:
libraryRoutes(app);
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/library.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/library.ts src/server/__tests__/library.test.ts src/server/app.ts
git commit -m "feat: add library sync, status, and settings API routes"
```

---

### Task 8: Chat route — integrate exclusion

**Files:**

- Modify: `src/server/routes/chat.ts`
- Modify: `src/server/__tests__/chat.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/server/__tests__/chat.test.ts`:

```typescript
import { libraryItems, userSettings } from "../schema.ts";

// Add to imports at top if not present
import { randomUUID } from "node:crypto";

describe("POST /api/chat with library exclusion", () => {
	test("sends exclusion context when excludeLibrary is true", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		// Seed library items
		const now = new Date().toISOString();
		app.db
			.insert(libraryItems)
			.values({
				id: randomUUID(),
				userId,
				title: "The Matrix",
				year: 1999,
				mediaType: "movie",
				source: "plex",
				syncedAt: now,
			})
			.run();

		app.db
			.insert(userSettings)
			.values({
				id: randomUUID(),
				userId,
				librarySyncInterval: "manual",
				librarySyncLast: now,
				excludeLibraryDefault: true,
			})
			.run();

		// Track what AI receives
		let receivedPrompt = "";
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, async ({ request }) => {
				const body = (await request.json()) as { messages: { role: string; content: string }[] };
				const systemMsg = body.messages.find((msg) => msg.role === "system");
				if (systemMsg) {
					receivedPrompt = systemMsg.content;
				}
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content: mockAiResponse } }],
				});
			}),
		);

		await app.inject({
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

		expect(receivedPrompt).toContain("do NOT recommend");
		expect(receivedPrompt).toContain("The Matrix");
	});

	test("skips exclusion when excludeLibrary is false", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		setupAiAndPlex(app, userId);

		let receivedPrompt = "";
		mswServer.use(
			http.post(`${MOCK_AI_ENDPOINT}/v1/chat/completions`, async ({ request }) => {
				const body = (await request.json()) as { messages: { role: string; content: string }[] };
				const systemMsg = body.messages.find((msg) => msg.role === "system");
				if (systemMsg) {
					receivedPrompt = systemMsg.content;
				}
				return HttpResponse.json({
					id: "chatcmpl-test",
					choices: [{ message: { role: "assistant", content: mockAiResponse } }],
				});
			}),
		);

		await app.inject({
			method: "POST",
			url: "/api/chat",
			cookies: { session: sessionId },
			payload: {
				message: "Recommend me some movies",
				mediaType: "movie",
				resultCount: 5,
				excludeLibrary: false,
			},
		});

		expect(receivedPrompt).not.toContain("do NOT recommend");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn vp test src/server/__tests__/chat.test.ts
```

Expected: FAIL — `excludeLibrary` not recognized in schema, exclusion context not injected.

- [ ] **Step 3: Update chat route**

In `src/server/routes/chat.ts`:

1. Add imports:

```typescript
import { arrConnections as arrConnectionsTable, userSettings } from "../schema.ts";
import { buildExclusionContext, shouldAutoSync, syncLibrary } from "../services/library-sync.ts";
import { filterExcludedRecommendations } from "../services/response-parser.ts";
```

2. Update `chatRequestSchema` to include `excludeLibrary`:

```typescript
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
```

3. In the POST `/api/chat` handler, after getting the Plex connection and before building the system prompt, add exclusion logic:

```typescript
const { message, mediaType, resultCount, conversationId, libraryIds, excludeLibrary } =
	request.body;

// ... existing code through watch history fetch ...

// Resolve exclusion toggle
const userSetting = app.db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
const shouldExclude = excludeLibrary ?? userSetting?.excludeLibraryDefault ?? true;

let exclusionContext;
if (shouldExclude) {
	// Check auto-sync
	if (shouldAutoSync(userId, app.db) && plexConnection?.serverUrl) {
		const arrConns = app.db
			.select()
			.from(arrConnectionsTable)
			.where(eq(arrConnectionsTable.userId, userId))
			.all();
		await syncLibrary(userId, app.db, plexConnection, arrConns);
	}

	exclusionContext = buildExclusionContext(userId, app.db, {
		mediaType: mediaType as "movie" | "show" | "either",
	});
}

// Build system prompt
const systemPrompt = buildSystemPrompt({
	watchHistory,
	mediaType,
	resultCount,
	exclusionContext,
});
```

4. After parsing the AI response, add post-filter logic:

```typescript
// Parse response
let parsed = parseRecommendations(aiResponse);

// Post-parse filter
if (shouldExclude && exclusionContext) {
	const filterResult = filterExcludedRecommendations(parsed.recommendations, {
		libraryTitles: exclusionContext.titles,
		pastRecommendations: exclusionContext.pastRecommendations,
	});

	if (filterResult.filtered.length > 0) {
		// Backfill: request replacements
		const filteredTitles = filterResult.filtered.map((rec) => rec.title).join(", ");
		const allExcluded = [
			...exclusionContext.titles.map((t) => t.title),
			...filterResult.kept.map((t) => t.title),
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
					{ role: "system", content: systemPrompt },
					...aiMessages.slice(1),
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
		} catch {
			// Backfill failed — use whatever survived the filter
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
yarn vp test src/server/__tests__/chat.test.ts
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

Run:

```bash
yarn vp test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/chat.ts src/server/__tests__/chat.test.ts
git commit -m "feat: integrate library exclusion into chat route with backfill"
```

---

### Task 9: Frontend — Library API endpoints (RTK Query)

**Files:**

- Create: `src/client/features/library/api.ts`
- Modify: `src/client/api.ts`
- Modify: `src/client/features/chat/api.ts`

- [ ] **Step 1: Add `Library` tag type to base API**

In `src/client/api.ts`, add `"Library"` to the `tagTypes` array:

```typescript
tagTypes: ["PlexConnection", "AiConfig", "ArrConfig", "Conversations", "Library"],
```

- [ ] **Step 2: Create library API endpoints**

Create `src/client/features/library/api.ts`:

```typescript
import { api } from "../../api.ts";

interface LibraryStatus {
	lastSynced: string | null;
	interval: string;
	itemCount: number;
	movieCount: number;
	showCount: number;
	excludeDefault: boolean;
}

interface SyncResponse {
	movieCount: number;
	showCount: number;
	totalCount: number;
}

interface LibrarySettingsBody {
	interval: string;
	excludeDefault: boolean;
}

const libraryApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getLibraryStatus: builder.query<LibraryStatus, void>({
			query: () => "api/library/status",
			providesTags: ["Library"],
		}),
		syncLibrary: builder.mutation<SyncResponse, void>({
			query: () => ({
				url: "api/library/sync",
				method: "POST",
			}),
			invalidatesTags: ["Library"],
		}),
		updateLibrarySettings: builder.mutation<{ success: boolean }, LibrarySettingsBody>({
			query: (body) => ({
				url: "api/library/settings",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["Library"],
		}),
	}),
});

const { useGetLibraryStatusQuery, useSyncLibraryMutation, useUpdateLibrarySettingsMutation } =
	libraryApi;

export { useGetLibraryStatusQuery, useSyncLibraryMutation, useUpdateLibrarySettingsMutation };
```

- [ ] **Step 3: Update chat API to include `excludeLibrary`**

In `src/client/features/chat/api.ts`, add to `SendChatMessageBody`:

```typescript
interface SendChatMessageBody {
	message: string;
	mediaType: string;
	resultCount: number;
	conversationId?: string | undefined;
	libraryIds?: string[] | undefined;
	excludeLibrary?: boolean | undefined;
}
```

- [ ] **Step 4: Run lint check**

Run:

```bash
yarn vp check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/api.ts src/client/features/library/api.ts src/client/features/chat/api.ts
git commit -m "feat: add RTK Query endpoints for library sync and settings"
```

---

### Task 10: Frontend — Library Settings tab

**Files:**

- Create: `src/client/pages/settings/LibraryTab.tsx`
- Create: `src/client/hooks/use-library-settings.ts`
- Modify: `src/client/pages/Settings.tsx`

- [ ] **Step 1: Create the `useLibrarySettings` hook**

Create `src/client/hooks/use-library-settings.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";

import {
	useGetLibraryStatusQuery,
	useSyncLibraryMutation,
	useUpdateLibrarySettingsMutation,
} from "../features/library/api.ts";

import type { ChangeEvent } from "react";

const useLibrarySettings = () => {
	const { data: status, isLoading: isLoadingStatus } = useGetLibraryStatusQuery();
	const [syncLibrary, { isLoading: isSyncing }] = useSyncLibraryMutation();
	const [updateSettings, { isLoading: isSaving }] = useUpdateLibrarySettingsMutation();

	const [interval, setInterval_] = useState("manual");
	const [excludeDefault, setExcludeDefault] = useState(true);
	const [syncResult, setSyncResult] = useState("");

	useEffect(() => {
		if (status) {
			setInterval_(status.interval);
			setExcludeDefault(status.excludeDefault);
		}
	}, [status]);

	const handleIntervalChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setInterval_(event.target.value);
	}, []);

	const handleExcludeToggle = useCallback(() => {
		setExcludeDefault((prev) => !prev);
	}, []);

	const handleSync = useCallback(async () => {
		setSyncResult("");
		const result = await syncLibrary();
		if ("data" in result && result.data) {
			setSyncResult(
				`Synced ${String(result.data.movieCount)} movies and ${String(result.data.showCount)} shows`,
			);
		} else {
			setSyncResult("Sync failed");
		}
	}, [syncLibrary]);

	const handleSave = useCallback(async () => {
		await updateSettings({ interval, excludeDefault });
	}, [updateSettings, interval, excludeDefault]);

	return {
		status,
		isLoadingStatus,
		isSyncing,
		isSaving,
		interval,
		excludeDefault,
		syncResult,
		handleIntervalChange,
		handleExcludeToggle,
		handleSync,
		handleSave,
	};
};

export { useLibrarySettings };
```

- [ ] **Step 2: Create the `LibraryTab` component**

Create `src/client/pages/settings/LibraryTab.tsx`:

```typescript
import { css } from "@linaria/atomic";

import { useLibrarySettings } from "../../hooks/use-library-settings.ts";
import { colors, spacing } from "../../theme.ts";
import {
	buttonRow,
	primaryButton,
	secondaryButton,
	sectionCard,
	sectionTitle,
	selectStyle,
	statusText,
	successText,
} from "./settings-styles.ts";

const toggleRow = css`
	display: flex;
	align-items: center;
	gap: ${spacing.md};
	margin-bottom: ${spacing.md};
`;

const toggleLabel = css`
	font-size: 0.95rem;
	color: ${colors.text};
	cursor: pointer;
`;

const toggleSwitch = css`
	width: 44px;
	height: 24px;
	accent-color: ${colors.accent};
	cursor: pointer;
`;

const syncInfo = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
	margin-bottom: ${spacing.md};
`;

const fieldLabel = css`
	display: block;
	font-size: 0.85rem;
	font-weight: 500;
	color: ${colors.textMuted};
	margin-bottom: ${spacing.xs};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const fieldGroup = css`
	margin-bottom: ${spacing.md};
`;

const formatTimestamp = (iso: string | null): string => {
	if (!iso) return "Never synced";
	return `Last synced: ${new Date(iso).toLocaleString()}`;
};

const SyncStatus = ({
	status,
}: {
	status: { lastSynced: string | null; movieCount: number; showCount: number } | undefined;
}) => {
	if (!status) return <p className={syncInfo}>Loading...</p>;

	return (
		<div className={syncInfo}>
			<p>{formatTimestamp(status.lastSynced)}</p>
			{status.lastSynced ? (
				<p>
					{String(status.movieCount)} movies, {String(status.showCount)} shows cached
				</p>
			) : undefined}
		</div>
	);
};

const LibraryTab = () => {
	const settings = useLibrarySettings();

	return (
		<div>
			<div className={sectionCard}>
				<h3 className={sectionTitle}>Library Sync</h3>
				<SyncStatus status={settings.status ?? undefined} />
				<div className={buttonRow}>
					<button
						type="button"
						className={secondaryButton}
						onClick={settings.handleSync}
						disabled={settings.isSyncing}
					>
						{settings.isSyncing ? "Syncing..." : "Sync Now"}
					</button>
				</div>
				{settings.syncResult ? (
					<p className={successText}>{settings.syncResult}</p>
				) : undefined}
			</div>

			<div className={sectionCard}>
				<h3 className={sectionTitle}>Preferences</h3>
				<div className={fieldGroup}>
					<label className={fieldLabel} htmlFor="syncInterval">
						Auto-Refresh Interval
					</label>
					<select
						id="syncInterval"
						className={selectStyle}
						value={settings.interval}
						onChange={settings.handleIntervalChange}
					>
						<option value="manual">Manual only</option>
						<option value="6h">Every 6 hours</option>
						<option value="12h">Every 12 hours</option>
						<option value="24h">Every 24 hours</option>
						<option value="7d">Weekly</option>
					</select>
				</div>
				<div className={toggleRow}>
					<input
						type="checkbox"
						id="excludeLibrary"
						className={toggleSwitch}
						checked={settings.excludeDefault}
						onChange={settings.handleExcludeToggle}
					/>
					<label className={toggleLabel} htmlFor="excludeLibrary">
						Exclude library from recommendations
					</label>
				</div>
				<div className={buttonRow}>
					<button
						type="button"
						className={primaryButton}
						onClick={settings.handleSave}
						disabled={settings.isSaving}
					>
						{settings.isSaving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
};

export { LibraryTab };
```

- [ ] **Step 3: Register the tab in Settings.tsx**

In `src/client/pages/Settings.tsx`:

1. Add the lazy import:

```typescript
const LibraryTab = lazy(async () => {
	const mod = await import("./settings/LibraryTab.tsx");
	return { default: mod.LibraryTab };
});
```

2. Update `SettingsTab` type and `TABS` array:

```typescript
type SettingsTab = "account" | "ai" | "integrations" | "library" | "plex";

const TABS: { id: SettingsTab; label: string }[] = [
	{ id: "plex", label: "Plex Connection" },
	{ id: "ai", label: "AI Configuration" },
	{ id: "library", label: "Library" },
	{ id: "account", label: "Account" },
	{ id: "integrations", label: "Integrations" },
];
```

3. Add to `TabContent`:

```typescript
{tab === "library" && <LibraryTab />}
```

- [ ] **Step 4: Run lint check**

Run:

```bash
yarn vp check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/settings/LibraryTab.tsx src/client/hooks/use-library-settings.ts src/client/pages/Settings.tsx
git commit -m "feat: add Library settings tab with sync and preferences"
```

---

### Task 11: Frontend — Chat exclude toggle

**Files:**

- Modify: `src/client/components/ChatControls.tsx`
- Modify: `src/client/hooks/use-chat.ts`
- Modify: `src/client/pages/Recommendations.tsx`

- [ ] **Step 1: Add `excludeLibrary` state to `useChat`**

In `src/client/hooks/use-chat.ts`:

1. Add import:

```typescript
import { useGetLibraryStatusQuery } from "../features/library/api.ts";
```

2. Add state and hook:

```typescript
const { data: libraryStatus } = useGetLibraryStatusQuery();
const [excludeLibrary, setExcludeLibrary] = useState<boolean | undefined>(undefined);

// Resolve: use explicit toggle if set, otherwise global default
const resolvedExclude = excludeLibrary ?? libraryStatus?.excludeDefault ?? true;
```

3. Update `handleSend` to include `excludeLibrary`:

```typescript
const result = await sendChatMessage({
	message,
	mediaType,
	resultCount,
	conversationId,
	libraryIds: libraryId ? [libraryId] : undefined,
	excludeLibrary: resolvedExclude,
});
```

4. Add `handleExcludeLibraryChange`:

```typescript
const handleExcludeLibraryChange = useCallback((value: boolean) => {
	setExcludeLibrary(value);
}, []);
```

5. Add to return:

```typescript
return {
	// ... existing
	excludeLibrary: resolvedExclude,
	handleExcludeLibraryChange,
};
```

- [ ] **Step 2: Add toggle to `ChatControls`**

In `src/client/components/ChatControls.tsx`:

1. Add styles:

```typescript
const checkboxStyle = css`
	accent-color: ${colors.accent};
	cursor: pointer;
`;

const checkboxLabel = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
	cursor: pointer;
`;
```

2. Update `ChatControlsProps`:

```typescript
interface ChatControlsProps {
	mediaType: MediaType;
	onMediaTypeChange: (value: MediaType) => void;
	libraryId: string;
	onLibraryIdChange: (value: string) => void;
	resultCount: number;
	onResultCountChange: (value: number) => void;
	excludeLibrary: boolean;
	onExcludeLibraryChange: (value: boolean) => void;
}
```

3. Add toggle to the JSX, after the Results control group:

```typescript
<div className={controlGroup}>
	<span className={controlLabel}>Exclude Library</span>
	<label className={checkboxLabel}>
		<input
			type="checkbox"
			className={checkboxStyle}
			checked={excludeLibrary}
			onChange={(event) => { onExcludeLibraryChange(event.target.checked); }}
		/>
		{" "}On
	</label>
</div>
```

- [ ] **Step 3: Wire up in Recommendations.tsx**

In `src/client/pages/Recommendations.tsx`, update `ChatControls` usage:

```typescript
<ChatControls
	mediaType={chat.mediaType}
	onMediaTypeChange={chat.handleMediaTypeChange}
	libraryId={chat.libraryId}
	onLibraryIdChange={chat.handleLibraryIdChange}
	resultCount={chat.resultCount}
	onResultCountChange={chat.handleResultCountChange}
	excludeLibrary={chat.excludeLibrary}
	onExcludeLibraryChange={chat.handleExcludeLibraryChange}
/>
```

- [ ] **Step 4: Run lint check**

Run:

```bash
yarn vp check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/components/ChatControls.tsx src/client/hooks/use-chat.ts src/client/pages/Recommendations.tsx
git commit -m "feat: add exclude library toggle to chat controls"
```

---

### Task 12: Documentation updates

**Files:**

- Modify: `docs/README.md` (or main docs file — update route listing)

- [ ] **Step 1: Update route documentation**

Add the three new routes to the API documentation:

```markdown
- `POST /api/library/sync` — triggers manual library sync, returns movie/show counts
- `GET /api/library/status` — returns sync status, interval, item counts, exclude default
- `PUT /api/library/settings` — updates sync interval and exclude-library default
```

- [ ] **Step 2: Update CLAUDE.md route list**

In the CLAUDE.md "Current routes" section, add:

```markdown
- `POST /api/library/sync` — triggers manual library sync, returns item counts
- `GET /api/library/status` — returns last synced time, interval, item counts, and exclude default
- `PUT /api/library/settings` — updates sync interval and exclude-library default
```

Also update the table count in the db section to mention `library_items` and `user_settings`.

- [ ] **Step 3: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: add library exclusion routes and tables to documentation"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

Run:

```bash
yarn vp test
```

Expected: ALL PASS

- [ ] **Step 2: Run full lint/type check**

Run:

```bash
yarn vp check
```

Expected: PASS

- [ ] **Step 3: Build**

Run:

```bash
yarn build
```

Expected: PASS — no build errors.

- [ ] **Step 4: Final commit if any fixes needed**

If any fixes were required, commit them:

```bash
git add -A
git commit -m "fix: address lint/type/build issues from library exclusion feature"
```
