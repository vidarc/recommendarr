# TVDB & TMDB Metadata Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich recommendation cards with poster images, overviews, genres, ratings, and cast/crew data from TVDB (TV shows) and TMDB (movies), with optional AI prompt enrichment using cached metadata.

**Architecture:** Two API service clients (`tmdb-client.ts`, `tvdb-client.ts`) normalize external metadata into a shared `MediaMetadata` type. A `metadata_cache` SQLite table stores fetched data with 7-day TTL. A new metadata route serves enriched data to the frontend on demand. The recommendation card component fetches and displays metadata when available.

**Tech Stack:** Fastify, Drizzle ORM, Zod, React, RTK Query, Linaria, msw (tests)

---

## File Structure

### New Files

| File                                       | Responsibility                                                    |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `src/shared/schemas/metadata.ts`           | Zod schemas for metadata API request/response types               |
| `src/server/services/tmdb-client.ts`       | TMDB API client — search movies, get details + credits            |
| `src/server/services/tvdb-client.ts`       | TVDB v4 API client — auth, search series, get details + cast      |
| `src/server/services/metadata-types.ts`    | Shared `MediaMetadata` and `CreditPerson` interfaces              |
| `src/server/routes/metadata.ts`            | `GET /api/metadata/status`, `GET /api/metadata/:recommendationId` |
| `src/server/__tests__/tmdb-client.test.ts` | Unit tests for TMDB client using msw                              |
| `src/server/__tests__/tvdb-client.test.ts` | Unit tests for TVDB client using msw                              |
| `src/server/__tests__/metadata.test.ts`    | Integration tests for metadata routes                             |
| `src/client/features/metadata/api.ts`      | RTK Query endpoints for metadata                                  |
| `src/client/components/MetadataPanel.tsx`  | Metadata display sub-component for RecommendationCard             |

### Modified Files

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/server/schema.ts`                         | Add `metadataCache` table, add `tvdbId` column to `recommendations`    |
| `src/server/app.ts`                            | Register `metadataRoutes`, add TVDB/TMDB image domains to CSP `imgSrc` |
| `src/server/db.ts`                             | Add `metadataCache` to drizzle schema                                  |
| `src/shared/schemas/chat.ts`                   | Add `tvdbId` to `recommendationSchema`                                 |
| `src/client/api.ts`                            | Add `"Metadata"` to `tagTypes`                                         |
| `src/client/components/RecommendationCard.tsx` | Integrate `MetadataPanel`                                              |
| `src/server/services/prompt-builder.ts`        | Add `buildCastCrewSection` helper                                      |
| `src/server/routes/chat.ts`                    | Optionally enrich prompt with cached cast/crew metadata                |

---

## Task 1: Shared Types and Schemas

**Files:**

- Create: `src/server/services/metadata-types.ts`
- Create: `src/shared/schemas/metadata.ts`

- [ ] **Step 1: Create the shared metadata types file**

```ts
// src/server/services/metadata-types.ts

interface CreditPerson {
	name: string;
	role: string;
	character: string | undefined;
}

interface MediaMetadata {
	externalId: number;
	source: "tvdb" | "tmdb";
	title: string;
	overview: string | undefined;
	posterUrl: string | undefined;
	genres: string[];
	rating: number | undefined;
	year: number | undefined;
	cast: CreditPerson[];
	crew: CreditPerson[];
	status: string | undefined;
}

export type { CreditPerson, MediaMetadata };
```

- [ ] **Step 2: Create the shared Zod schemas for metadata API**

```ts
// src/shared/schemas/metadata.ts
import { z } from "zod";

const creditPersonSchema = z.object({
	name: z.string(),
	role: z.string(),
	character: z.string().optional(),
});

const mediaMetadataResponseSchema = z.object({
	available: z.literal(true),
	externalId: z.number(),
	source: z.enum(["tvdb", "tmdb"]),
	title: z.string(),
	overview: z.string().optional(),
	posterUrl: z.string().optional(),
	genres: z.array(z.string()),
	rating: z.number().optional(),
	year: z.number().optional(),
	cast: z.array(creditPersonSchema),
	crew: z.array(creditPersonSchema),
	status: z.string().optional(),
});

const metadataUnavailableResponseSchema = z.object({
	available: z.literal(false),
});

const metadataResponseSchema = z.discriminatedUnion("available", [
	mediaMetadataResponseSchema,
	metadataUnavailableResponseSchema,
]);

const metadataStatusResponseSchema = z.object({
	tvdb: z.boolean(),
	tmdb: z.boolean(),
});

type CreditPerson = z.infer<typeof creditPersonSchema>;
type MediaMetadataResponse = z.infer<typeof mediaMetadataResponseSchema>;
type MetadataUnavailableResponse = z.infer<typeof metadataUnavailableResponseSchema>;
type MetadataResponse = z.infer<typeof metadataResponseSchema>;
type MetadataStatusResponse = z.infer<typeof metadataStatusResponseSchema>;

export {
	creditPersonSchema,
	mediaMetadataResponseSchema,
	metadataResponseSchema,
	metadataStatusResponseSchema,
	metadataUnavailableResponseSchema,
};

export type {
	CreditPerson,
	MediaMetadataResponse,
	MetadataResponse,
	MetadataStatusResponse,
	MetadataUnavailableResponse,
};
```

- [ ] **Step 3: Run typecheck**

Run: `yarn vp check`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add src/server/services/metadata-types.ts src/shared/schemas/metadata.ts
git commit -m "feat: add shared metadata types and Zod schemas"
```

---

## Task 2: Database Schema Changes

**Files:**

- Modify: `src/server/schema.ts`
- Modify: `src/server/db.ts`
- Modify: `src/shared/schemas/chat.ts`

- [ ] **Step 1: Add `tvdbId` to `recommendations` table and add `metadataCache` table in schema.ts**

In `src/server/schema.ts`, add `tvdbId` to the `recommendations` table definition:

```ts
// Inside the recommendations table, after the tmdbId column:
tvdbId: integer("tvdb_id"),
```

Add the new `metadataCache` table after the `userSettings` table:

```ts
const metadataCache = sqliteTable(
	"metadata_cache",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		externalId: integer("external_id").notNull(),
		source: text("source").notNull(),
		mediaType: text("media_type").notNull(),
		title: text("title").notNull(),
		overview: text("overview"),
		posterUrl: text("poster_url"),
		genres: text("genres"),
		rating: real("rating"),
		year: integer("year"),
		cast: text("cast"),
		crew: text("crew"),
		status: text("status"),
		fetchedAt: integer("fetched_at").notNull(),
	},
	(table) => [uniqueIndex("metadata_external_source_idx").on(table.externalId, table.source)],
);

const selectMetadataCacheSchema = createSelectSchema(metadataCache);
const insertMetadataCacheSchema = createInsertSchema(metadataCache);
```

Export `metadataCache`, `selectMetadataCacheSchema`, and `insertMetadataCacheSchema` from the existing grouped export statement.

- [ ] **Step 2: Add `tvdbId` to the shared recommendation schema**

In `src/shared/schemas/chat.ts`, add `tvdbId` to `recommendationSchema`:

```ts
const recommendationSchema = z.object({
	id: z.string(),
	title: z.string(),
	year: z.number().optional(),
	mediaType: z.string(),
	synopsis: z.string().optional(),
	tmdbId: z.number().optional(),
	tvdbId: z.number().optional(),
	addedToArr: z.boolean(),
	feedback: recommendationFeedbackSchema.optional(),
});
```

- [ ] **Step 3: Register `metadataCache` in the db plugin**

In `src/server/db.ts`, add `metadataCache` to the import from `./schema.ts` and add it to the `drizzle()` schema object:

```ts
// In the import:
import {
	// ... existing imports ...
	metadataCache,
} from "./schema.ts";

// In the drizzle() call, add to the schema object:
schema: {
	// ... existing entries ...
	metadataCache,
}
```

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: A new migration folder appears in `drizzle/` with SQL for the `metadata_cache` table and the `tvdb_id` column.

- [ ] **Step 5: Run typecheck and tests**

Run: `yarn vp check && yarn vp test`
Expected: PASS (existing tests should still pass)

- [ ] **Step 6: Commit**

```bash
git add src/server/schema.ts src/server/db.ts src/shared/schemas/chat.ts drizzle/
git commit -m "feat: add metadata_cache table and tvdbId to recommendations"
```

---

## Task 3: TMDB Client

**Files:**

- Create: `src/server/services/tmdb-client.ts`
- Create: `src/server/__tests__/tmdb-client.test.ts`

- [ ] **Step 1: Write the failing tests for TMDB client**

```ts
// src/server/__tests__/tmdb-client.test.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vite-plus/test";

import { getMovieById, getMovieCredits, searchMovie } from "../services/tmdb-client.ts";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const MOCK_API_KEY = "test-tmdb-api-key";
const INCEPTION_TMDB_ID = 27205;
const INCEPTION_YEAR = 2010;
const FIRST = 0;
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;

const mockSearchResults = {
	results: [
		{
			id: INCEPTION_TMDB_ID,
			title: "Inception",
			overview: "A thief who steals corporate secrets.",
			poster_path: "/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg",
			genre_ids: [28, 878, 12],
			vote_average: 8.4,
			release_date: "2010-07-16",
			status: "Released",
		},
	],
};

const mockMovieDetails = {
	id: INCEPTION_TMDB_ID,
	title: "Inception",
	overview: "A thief who steals corporate secrets.",
	poster_path: "/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg",
	genres: [
		{ id: 28, name: "Action" },
		{ id: 878, name: "Science Fiction" },
	],
	vote_average: 8.4,
	release_date: "2010-07-16",
	status: "Released",
};

const mockMovieCredits = {
	cast: [
		{ name: "Leonardo DiCaprio", known_for_department: "Acting", character: "Cobb", order: 0 },
		{ name: "Joseph Gordon-Levitt", known_for_department: "Acting", character: "Arthur", order: 1 },
	],
	crew: [
		{ name: "Christopher Nolan", department: "Directing", job: "Director" },
		{ name: "Christopher Nolan", department: "Writing", job: "Writer" },
		{ name: "Emma Thomas", department: "Production", job: "Producer" },
	],
};

const handlers = [
	http.get(`${TMDB_API_BASE}/search/movie`, ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("api_key") !== MOCK_API_KEY) {
			return HttpResponse.json({ status_message: "Invalid API key" }, { status: 401 });
		}
		return HttpResponse.json(mockSearchResults);
	}),
	http.get(`${TMDB_API_BASE}/movie/${String(INCEPTION_TMDB_ID)}`, ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("api_key") !== MOCK_API_KEY) {
			return HttpResponse.json({ status_message: "Invalid API key" }, { status: 401 });
		}
		return HttpResponse.json(mockMovieDetails);
	}),
	http.get(`${TMDB_API_BASE}/movie/${String(INCEPTION_TMDB_ID)}/credits`, ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("api_key") !== MOCK_API_KEY) {
			return HttpResponse.json({ status_message: "Invalid API key" }, { status: 401 });
		}
		return HttpResponse.json(mockMovieCredits);
	}),
];

const mswServer = setupServer(...handlers);

beforeAll(() => {
	vi.stubEnv("TMDB_API_KEY", MOCK_API_KEY);
	mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
	mswServer.resetHandlers();
});

afterAll(() => {
	mswServer.close();
	vi.unstubAllEnvs();
});

describe("searchMovie", () => {
	test("returns normalized metadata for a search result", async () => {
		const results = await searchMovie("Inception", INCEPTION_YEAR);
		expect(results.length).toBeGreaterThan(0);
		const result = results[FIRST];
		expect(result?.title).toBe("Inception");
		expect(result?.externalId).toBe(INCEPTION_TMDB_ID);
		expect(result?.source).toBe("tmdb");
		expect(result?.posterUrl).toContain("qmDpIHrmpJINaRKAfWQfftjCdyi.jpg");
	});

	test("returns empty array when no results", async () => {
		mswServer.use(
			http.get(`${TMDB_API_BASE}/search/movie`, () => HttpResponse.json({ results: [] })),
		);
		const results = await searchMovie("Nonexistent Movie 12345");
		expect(results).toEqual([]);
	});
});

describe("getMovieById", () => {
	test("returns full metadata for a movie", async () => {
		const result = await getMovieById(INCEPTION_TMDB_ID);
		expect(result).toBeDefined();
		expect(result?.title).toBe("Inception");
		expect(result?.genres).toContain("Action");
		expect(result?.genres).toContain("Science Fiction");
		expect(result?.rating).toBe(8.4);
		expect(result?.source).toBe("tmdb");
		expect(result?.status).toBe("Released");
	});

	test("returns undefined for 404", async () => {
		mswServer.use(
			http.get(`${TMDB_API_BASE}/movie/*`, () => new HttpResponse(null, { status: 404 })),
		);
		const result = await getMovieById(999999);
		expect(result).toBeUndefined();
	});
});

describe("getMovieCredits", () => {
	test("returns cast and crew limited to configured maximums", async () => {
		const result = await getMovieCredits(INCEPTION_TMDB_ID);
		expect(result).toBeDefined();
		expect(result?.cast.length).toBeLessThanOrEqual(CAST_LIMIT);
		expect(result?.crew.length).toBeLessThanOrEqual(CREW_LIMIT);
		expect(result?.cast[FIRST]?.name).toBe("Leonardo DiCaprio");
		expect(result?.cast[FIRST]?.character).toBe("Cobb");
		expect(result?.crew[FIRST]?.name).toBe("Christopher Nolan");
		expect(result?.crew[FIRST]?.role).toBe("Director");
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vp test src/server/__tests__/tmdb-client.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the TMDB client**

```ts
// src/server/services/tmdb-client.ts
import { z } from "zod";

import type { CreditPerson, MediaMetadata } from "./metadata-types.ts";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const NOT_FOUND = 404;
const FIRST_MATCH = 0;

const getApiKey = (): string | undefined => process.env["TMDB_API_KEY"];

const isAvailable = (): boolean => getApiKey() !== undefined;

const tmdbFetch = async (path: string, params: Record<string, string> = {}): Promise<Response> => {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("TMDB_API_KEY is not configured");
	}
	const url = new URL(`${TMDB_API_BASE}${path}`);
	url.searchParams.set("api_key", apiKey);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return fetch(url.toString());
};

const searchResultSchema = z.object({
	results: z.array(
		z.object({
			id: z.number(),
			title: z.string(),
			overview: z.string().optional(),
			poster_path: z.string().nullable().optional(),
			genre_ids: z.array(z.number()).optional(),
			vote_average: z.number().optional(),
			release_date: z.string().optional(),
		}),
	),
});

const movieDetailsSchema = z.object({
	id: z.number(),
	title: z.string(),
	overview: z.string().optional(),
	poster_path: z.string().nullable().optional(),
	genres: z.array(z.object({ id: z.number(), name: z.string() })),
	vote_average: z.number().optional(),
	release_date: z.string().optional(),
	status: z.string().optional(),
});

const creditsSchema = z.object({
	cast: z.array(
		z.object({
			name: z.string(),
			known_for_department: z.string().optional(),
			character: z.string().optional(),
			order: z.number().optional(),
		}),
	),
	crew: z.array(
		z.object({
			name: z.string(),
			department: z.string().optional(),
			job: z.string(),
		}),
	),
});

const extractYear = (releaseDate: string | undefined): number | undefined => {
	if (!releaseDate) {
		return undefined;
	}
	const year = Number.parseInt(releaseDate.slice(FIRST_MATCH, 4), 10);
	return Number.isNaN(year) ? undefined : year;
};

const buildPosterUrl = (posterPath: string | null | undefined): string | undefined =>
	posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : undefined;

const searchMovie = async (query: string, year?: number): Promise<MediaMetadata[]> => {
	const params: Record<string, string> = { query };
	if (year !== undefined) {
		params["year"] = String(year);
	}
	const response = await tmdbFetch("/search/movie", params);
	if (!response.ok) {
		throw new Error(`TMDB search failed with status ${String(response.status)}`);
	}
	const data = searchResultSchema.parse(await response.json());
	return data.results.map((item) => ({
		externalId: item.id,
		source: "tmdb" as const,
		title: item.title,
		overview: item.overview,
		posterUrl: buildPosterUrl(item.poster_path),
		genres: [],
		rating: item.vote_average,
		year: extractYear(item.release_date),
		cast: [],
		crew: [],
		status: undefined,
	}));
};

const getMovieById = async (tmdbId: number): Promise<MediaMetadata | undefined> => {
	const response = await tmdbFetch(`/movie/${String(tmdbId)}`);
	if (response.status === NOT_FOUND) {
		return undefined;
	}
	if (!response.ok) {
		throw new Error(`TMDB get movie failed with status ${String(response.status)}`);
	}
	const data = movieDetailsSchema.parse(await response.json());
	return {
		externalId: data.id,
		source: "tmdb",
		title: data.title,
		overview: data.overview,
		posterUrl: buildPosterUrl(data.poster_path),
		genres: data.genres.map((g) => g.name),
		rating: data.vote_average,
		year: extractYear(data.release_date),
		cast: [],
		crew: [],
		status: data.status,
	};
};

const getMovieCredits = async (
	tmdbId: number,
): Promise<{ cast: CreditPerson[]; crew: CreditPerson[] } | undefined> => {
	const response = await tmdbFetch(`/movie/${String(tmdbId)}/credits`);
	if (response.status === NOT_FOUND) {
		return undefined;
	}
	if (!response.ok) {
		throw new Error(`TMDB get credits failed with status ${String(response.status)}`);
	}
	const data = creditsSchema.parse(await response.json());
	const cast: CreditPerson[] = data.cast.slice(0, CAST_LIMIT).map((c) => ({
		name: c.name,
		role: "Actor",
		character: c.character,
	}));
	const crew: CreditPerson[] = data.crew
		.filter((c) => c.department === "Directing" || c.department === "Writing")
		.slice(0, CREW_LIMIT)
		.map((c) => ({
			name: c.name,
			role: c.job,
			character: undefined,
		}));
	return { cast, crew };
};

export { getMovieById, getMovieCredits, isAvailable, searchMovie };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vp test src/server/__tests__/tmdb-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/tmdb-client.ts src/server/__tests__/tmdb-client.test.ts
git commit -m "feat: add TMDB API client with search, details, and credits"
```

---

## Task 4: TVDB Client

**Files:**

- Create: `src/server/services/tvdb-client.ts`
- Create: `src/server/__tests__/tvdb-client.test.ts`

- [ ] **Step 1: Write the failing tests for TVDB client**

```ts
// src/server/__tests__/tvdb-client.test.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vite-plus/test";

import { getSeriesById, getSeriesExtended, searchSeries } from "../services/tvdb-client.ts";

const TVDB_API_BASE = "https://api4.thetvdb.com/v4";
const MOCK_API_KEY = "test-tvdb-api-key";
const MOCK_TOKEN = "mock-bearer-token-12345";
const BREAKING_BAD_TVDB_ID = 81189;
const BREAKING_BAD_YEAR = 2008;
const FIRST = 0;

const mockLoginResponse = {
	status: "success",
	data: { token: MOCK_TOKEN },
};

const mockSearchResults = {
	status: "success",
	data: [
		{
			tvdb_id: String(BREAKING_BAD_TVDB_ID),
			name: "Breaking Bad",
			overview: "A chemistry teacher turned drug manufacturer.",
			image_url: "https://artworks.thetvdb.com/banners/posters/81189-1.jpg",
			year: String(BREAKING_BAD_YEAR),
			type: "series",
		},
	],
};

const mockSeriesDetails = {
	status: "success",
	data: {
		id: BREAKING_BAD_TVDB_ID,
		name: "Breaking Bad",
		overview: "A chemistry teacher turned drug manufacturer.",
		image: "https://artworks.thetvdb.com/banners/posters/81189-1.jpg",
		year: String(BREAKING_BAD_YEAR),
		genres: [{ name: "Drama" }, { name: "Thriller" }],
		score: 9.5,
		status: { name: "Ended" },
	},
};

const mockSeriesExtended = {
	status: "success",
	data: {
		id: BREAKING_BAD_TVDB_ID,
		name: "Breaking Bad",
		overview: "A chemistry teacher turned drug manufacturer.",
		image: "https://artworks.thetvdb.com/banners/posters/81189-1.jpg",
		year: String(BREAKING_BAD_YEAR),
		genres: [{ name: "Drama" }, { name: "Thriller" }],
		score: 9.5,
		status: { name: "Ended" },
		characters: [
			{
				name: "Walter White",
				peopleType: "Actor",
				personName: "Bryan Cranston",
			},
			{
				name: "Jesse Pinkman",
				peopleType: "Actor",
				personName: "Aaron Paul",
			},
			{
				name: undefined,
				peopleType: "Director",
				personName: "Vince Gilligan",
			},
		],
	},
};

const handlers = [
	http.post(`${TVDB_API_BASE}/login`, () => HttpResponse.json(mockLoginResponse)),
	http.get(`${TVDB_API_BASE}/search`, ({ request }) => {
		const auth = request.headers.get("Authorization");
		if (auth !== `Bearer ${MOCK_TOKEN}`) {
			return HttpResponse.json({ status: "failure" }, { status: 401 });
		}
		return HttpResponse.json(mockSearchResults);
	}),
	http.get(`${TVDB_API_BASE}/series/${String(BREAKING_BAD_TVDB_ID)}`, ({ request }) => {
		const auth = request.headers.get("Authorization");
		if (auth !== `Bearer ${MOCK_TOKEN}`) {
			return HttpResponse.json({ status: "failure" }, { status: 401 });
		}
		return HttpResponse.json(mockSeriesDetails);
	}),
	http.get(`${TVDB_API_BASE}/series/${String(BREAKING_BAD_TVDB_ID)}/extended`, ({ request }) => {
		const auth = request.headers.get("Authorization");
		if (auth !== `Bearer ${MOCK_TOKEN}`) {
			return HttpResponse.json({ status: "failure" }, { status: 401 });
		}
		return HttpResponse.json(mockSeriesExtended);
	}),
];

const mswServer = setupServer(...handlers);

beforeAll(() => {
	vi.stubEnv("TVDB_API_KEY", MOCK_API_KEY);
	mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
	mswServer.resetHandlers();
});

afterAll(() => {
	mswServer.close();
	vi.unstubAllEnvs();
});

describe("searchSeries", () => {
	test("authenticates and returns normalized metadata", async () => {
		const results = await searchSeries("Breaking Bad", BREAKING_BAD_YEAR);
		expect(results.length).toBeGreaterThan(0);
		const result = results[FIRST];
		expect(result?.title).toBe("Breaking Bad");
		expect(result?.externalId).toBe(BREAKING_BAD_TVDB_ID);
		expect(result?.source).toBe("tvdb");
		expect(result?.posterUrl).toContain("81189");
	});

	test("returns empty array when no results", async () => {
		mswServer.use(
			http.get(`${TVDB_API_BASE}/search`, () => HttpResponse.json({ status: "success", data: [] })),
		);
		const results = await searchSeries("Nonexistent Show 12345");
		expect(results).toEqual([]);
	});
});

describe("getSeriesById", () => {
	test("returns full metadata for a series", async () => {
		const result = await getSeriesById(BREAKING_BAD_TVDB_ID);
		expect(result).toBeDefined();
		expect(result?.title).toBe("Breaking Bad");
		expect(result?.genres).toContain("Drama");
		expect(result?.genres).toContain("Thriller");
		expect(result?.status).toBe("Ended");
		expect(result?.source).toBe("tvdb");
	});

	test("returns undefined for 404", async () => {
		mswServer.use(
			http.get(`${TVDB_API_BASE}/series/*`, () => new HttpResponse(null, { status: 404 })),
		);
		const result = await getSeriesById(999999);
		expect(result).toBeUndefined();
	});
});

describe("getSeriesExtended", () => {
	test("returns metadata with cast and crew", async () => {
		const result = await getSeriesExtended(BREAKING_BAD_TVDB_ID);
		expect(result).toBeDefined();
		expect(result?.cast.length).toBeGreaterThan(0);
		expect(result?.cast[FIRST]?.name).toBe("Bryan Cranston");
		expect(result?.cast[FIRST]?.character).toBe("Walter White");
		expect(result?.crew.length).toBeGreaterThan(0);
		expect(result?.crew[FIRST]?.name).toBe("Vince Gilligan");
		expect(result?.crew[FIRST]?.role).toBe("Director");
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vp test src/server/__tests__/tvdb-client.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the TVDB client**

```ts
// src/server/services/tvdb-client.ts
import { z } from "zod";

import type { CreditPerson, MediaMetadata } from "./metadata-types.ts";

const TVDB_API_BASE = "https://api4.thetvdb.com/v4";
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const NOT_FOUND = 404;
const YEAR_RADIX = 10;

let cachedToken: string | undefined;

const getApiKey = (): string | undefined => process.env["TVDB_API_KEY"];

const isAvailable = (): boolean => getApiKey() !== undefined;

const loginResponseSchema = z.object({
	status: z.string(),
	data: z.object({ token: z.string() }),
});

const authenticate = async (): Promise<string> => {
	if (cachedToken) {
		return cachedToken;
	}
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("TVDB_API_KEY is not configured");
	}
	const response = await fetch(`${TVDB_API_BASE}/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ apikey: apiKey }),
	});
	if (!response.ok) {
		throw new Error(`TVDB login failed with status ${String(response.status)}`);
	}
	const data = loginResponseSchema.parse(await response.json());
	cachedToken = data.data.token;
	return cachedToken;
};

const tvdbFetch = async (path: string, params: Record<string, string> = {}): Promise<Response> => {
	const token = await authenticate();
	const url = new URL(`${TVDB_API_BASE}${path}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${token}` },
	});
	// If unauthorized, try re-authenticating once
	if (response.status === 401) {
		cachedToken = undefined;
		const newToken = await authenticate();
		return fetch(url.toString(), {
			headers: { Authorization: `Bearer ${newToken}` },
		});
	}
	return response;
};

const searchResponseSchema = z.object({
	data: z.array(
		z.object({
			tvdb_id: z.string(),
			name: z.string(),
			overview: z.string().nullable().optional(),
			image_url: z.string().nullable().optional(),
			year: z.string().nullable().optional(),
			type: z.string().optional(),
		}),
	),
});

const seriesDetailsSchema = z.object({
	data: z.object({
		id: z.number(),
		name: z.string(),
		overview: z.string().nullable().optional(),
		image: z.string().nullable().optional(),
		year: z.string().nullable().optional(),
		genres: z.array(z.object({ name: z.string() })).optional(),
		score: z.number().optional(),
		status: z.object({ name: z.string() }).nullable().optional(),
	}),
});

const characterSchema = z.object({
	name: z.string().nullable().optional(),
	peopleType: z.string().optional(),
	personName: z.string().optional(),
});

const seriesExtendedSchema = z.object({
	data: z.object({
		id: z.number(),
		name: z.string(),
		overview: z.string().nullable().optional(),
		image: z.string().nullable().optional(),
		year: z.string().nullable().optional(),
		genres: z.array(z.object({ name: z.string() })).optional(),
		score: z.number().optional(),
		status: z.object({ name: z.string() }).nullable().optional(),
		characters: z.array(characterSchema).optional(),
	}),
});

const parseYear = (yearStr: string | null | undefined): number | undefined => {
	if (!yearStr) {
		return undefined;
	}
	const year = Number.parseInt(yearStr, YEAR_RADIX);
	return Number.isNaN(year) ? undefined : year;
};

const searchSeries = async (query: string, year?: number): Promise<MediaMetadata[]> => {
	const params: Record<string, string> = { query, type: "series" };
	if (year !== undefined) {
		params["year"] = String(year);
	}
	const response = await tvdbFetch("/search", params);
	if (!response.ok) {
		throw new Error(`TVDB search failed with status ${String(response.status)}`);
	}
	const data = searchResponseSchema.parse(await response.json());
	return data.data.map((item) => ({
		externalId: Number.parseInt(item.tvdb_id, YEAR_RADIX),
		source: "tvdb" as const,
		title: item.name,
		overview: item.overview ?? undefined,
		posterUrl: item.image_url ?? undefined,
		genres: [],
		rating: undefined,
		year: parseYear(item.year),
		cast: [],
		crew: [],
		status: undefined,
	}));
};

const getSeriesById = async (tvdbId: number): Promise<MediaMetadata | undefined> => {
	const response = await tvdbFetch(`/series/${String(tvdbId)}`);
	if (response.status === NOT_FOUND) {
		return undefined;
	}
	if (!response.ok) {
		throw new Error(`TVDB get series failed with status ${String(response.status)}`);
	}
	const data = seriesDetailsSchema.parse(await response.json());
	const series = data.data;
	return {
		externalId: series.id,
		source: "tvdb",
		title: series.name,
		overview: series.overview ?? undefined,
		posterUrl: series.image ?? undefined,
		genres: series.genres?.map((g) => g.name) ?? [],
		rating: series.score,
		year: parseYear(series.year),
		cast: [],
		crew: [],
		status: series.status?.name ?? undefined,
	};
};

const getSeriesExtended = async (tvdbId: number): Promise<MediaMetadata | undefined> => {
	const response = await tvdbFetch(`/series/${String(tvdbId)}/extended`);
	if (response.status === NOT_FOUND) {
		return undefined;
	}
	if (!response.ok) {
		throw new Error(`TVDB get series extended failed with status ${String(response.status)}`);
	}
	const data = seriesExtendedSchema.parse(await response.json());
	const series = data.data;

	const characters = series.characters ?? [];
	const actors = characters.filter((c) => c.peopleType === "Actor");
	const directors = characters.filter(
		(c) => c.peopleType === "Director" || c.peopleType === "Writer",
	);

	const cast: CreditPerson[] = actors.slice(0, CAST_LIMIT).map((c) => ({
		name: c.personName ?? "Unknown",
		role: "Actor",
		character: c.name ?? undefined,
	}));

	const crew: CreditPerson[] = directors.slice(0, CREW_LIMIT).map((c) => ({
		name: c.personName ?? "Unknown",
		role: c.peopleType ?? "Unknown",
		character: undefined,
	}));

	return {
		externalId: series.id,
		source: "tvdb",
		title: series.name,
		overview: series.overview ?? undefined,
		posterUrl: series.image ?? undefined,
		genres: series.genres?.map((g) => g.name) ?? [],
		rating: series.score,
		year: parseYear(series.year),
		cast,
		crew,
		status: series.status?.name ?? undefined,
	};
};

// Exported for testing — allows resetting cached token between tests
const resetToken = (): void => {
	cachedToken = undefined;
};

export { getSeriesById, getSeriesExtended, isAvailable, resetToken, searchSeries };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vp test src/server/__tests__/tvdb-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/tvdb-client.ts src/server/__tests__/tvdb-client.test.ts
git commit -m "feat: add TVDB v4 API client with search, details, and extended info"
```

---

## Task 5: Metadata Route

**Files:**

- Create: `src/server/routes/metadata.ts`
- Create: `src/server/__tests__/metadata.test.ts`
- Modify: `src/server/app.ts`

- [ ] **Step 1: Write failing tests for metadata routes**

```ts
// src/server/__tests__/metadata.test.ts
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
import { conversations, messages, metadataCache, recommendations, users } from "../schema.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TVDB_API_BASE = "https://api4.thetvdb.com/v4";
const MOCK_TMDB_KEY = "test-tmdb-key";
const MOCK_TVDB_KEY = "test-tvdb-key";
const INCEPTION_TMDB_ID = 27205;

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
		{ name: "Leonardo DiCaprio", known_for_department: "Acting", character: "Cobb", order: 0 },
	],
	crew: [{ name: "Christopher Nolan", department: "Directing", job: "Director" }],
};

const mockTvdbLogin = { status: "success", data: { token: "mock-token" } };

const mockTvdbSearch = {
	status: "success",
	data: [
		{
			tvdb_id: "81189",
			name: "Breaking Bad",
			overview: "A chemistry teacher turned drug manufacturer.",
			image_url: "https://artworks.thetvdb.com/banners/posters/81189-1.jpg",
			year: "2008",
			type: "series",
		},
	],
};

const mockTvdbExtended = {
	status: "success",
	data: {
		id: 81189,
		name: "Breaking Bad",
		overview: "A chemistry teacher turned drug manufacturer.",
		image: "https://artworks.thetvdb.com/banners/posters/81189-1.jpg",
		year: "2008",
		genres: [{ name: "Drama" }],
		score: 9.5,
		status: { name: "Ended" },
		characters: [{ name: "Walter White", peopleType: "Actor", personName: "Bryan Cranston" }],
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
	http.get(`${TVDB_API_BASE}/series/81189/extended`, () => HttpResponse.json(mockTvdbExtended)),
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

	// Register + get session cookie
	const registerRes = await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: testUser,
	});
	const cookie = registerRes.headers["set-cookie"] as string;
	const userId = app.db.select().from(users).all()[0]!.id;

	return { app, cookie, userId };
};

const createRecommendation = (
	app: Awaited<ReturnType<typeof setupDb>>["app"],
	userId: string,
	overrides: { mediaType: string; tmdbId?: number; tvdbId?: number; title?: string },
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

describe("GET /api/metadata/status", () => {
	test("returns availability of both sources", async () => {
		const { app, cookie } = await setupDb();
		const res = await app.inject({
			method: "GET",
			url: "/api/metadata/status",
			headers: { cookie },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.tvdb).toBe(true);
		expect(body.tmdb).toBe(true);
	});
});

describe("GET /api/metadata/:recommendationId", () => {
	test("returns TMDB metadata for a movie recommendation with tmdbId", async () => {
		const { app, cookie, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "movie",
			tmdbId: INCEPTION_TMDB_ID,
		});

		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			headers: { cookie },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.available).toBe(true);
		expect(body.title).toBe("Inception");
		expect(body.source).toBe("tmdb");
		expect(body.cast.length).toBeGreaterThan(0);
	});

	test("returns TVDB metadata for a show recommendation via search", async () => {
		const { app, cookie, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "show",
			title: "Breaking Bad",
		});

		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			headers: { cookie },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		const body = res.json();
		expect(body.available).toBe(true);
		expect(body.source).toBe("tvdb");
		expect(body.title).toBe("Breaking Bad");
	});

	test("returns cached metadata on second request", async () => {
		const { app, cookie, userId } = await setupDb();
		const recId = createRecommendation(app, userId, {
			mediaType: "movie",
			tmdbId: INCEPTION_TMDB_ID,
		});

		// First request populates cache
		await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			headers: { cookie },
		});

		// Verify cache entry exists
		const cached = app.db.select().from(metadataCache).all();
		expect(cached.length).toBe(1);

		// Second request should use cache
		const res = await app.inject({
			method: "GET",
			url: `/api/metadata/${recId}`,
			headers: { cookie },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		expect(res.json().available).toBe(true);
	});

	test("returns unavailable when recommendation not found", async () => {
		const { app, cookie } = await setupDb();
		const res = await app.inject({
			method: "GET",
			url: "/api/metadata/nonexistent-id",
			headers: { cookie },
		});
		expect(res.statusCode).toBe(StatusCodes.OK);
		expect(res.json().available).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vp test src/server/__tests__/metadata.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the metadata route**

```ts
// src/server/routes/metadata.ts
import { and, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
	metadataResponseSchema,
	metadataStatusResponseSchema,
} from "../../shared/schemas/metadata.ts";
import { errorResponseSchema } from "../../shared/schemas/common.ts";
import { metadataCache, recommendations } from "../schema.ts";
import {
	getMovieById,
	getMovieCredits,
	isAvailable as tmdbAvailable,
	searchMovie,
} from "../services/tmdb-client.ts";
import {
	getSeriesExtended,
	isAvailable as tvdbAvailable,
	searchSeries,
} from "../services/tvdb-client.ts";

import type { MediaMetadata } from "../services/metadata-types.ts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const METADATA_CACHE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const FIRST = 0;

const isCacheExpired = (fetchedAt: number): boolean => {
	const now = Date.now();
	const age = now - fetchedAt;
	return age > METADATA_CACHE_TTL_DAYS * MS_PER_DAY;
};

const serializeMetadata = (metadata: MediaMetadata) => ({
	externalId: metadata.externalId,
	source: metadata.source,
	mediaType: metadata.source === "tmdb" ? "movie" : "show",
	title: metadata.title,
	overview: metadata.overview,
	posterUrl: metadata.posterUrl,
	genres: JSON.stringify(metadata.genres),
	rating: metadata.rating,
	year: metadata.year,
	cast: JSON.stringify(metadata.cast),
	crew: JSON.stringify(metadata.crew),
	status: metadata.status,
	fetchedAt: Date.now(),
});

const deserializeMetadata = (row: {
	externalId: number;
	source: string;
	title: string;
	overview: string | null;
	posterUrl: string | null;
	genres: string | null;
	rating: number | null;
	year: number | null;
	cast: string | null;
	crew: string | null;
	status: string | null;
}): MediaMetadata => ({
	externalId: row.externalId,
	source: row.source as "tvdb" | "tmdb",
	title: row.title,
	overview: row.overview ?? undefined,
	posterUrl: row.posterUrl ?? undefined,
	genres: row.genres ? (JSON.parse(row.genres) as string[]) : [],
	rating: row.rating ?? undefined,
	year: row.year ?? undefined,
	cast: row.cast ? (JSON.parse(row.cast) as MediaMetadata["cast"]) : [],
	crew: row.crew ? (JSON.parse(row.crew) as MediaMetadata["crew"]) : [],
	status: row.status ?? undefined,
});

const fetchMovieMetadata = async (
	tmdbId: number | undefined,
	title: string,
	year: number | undefined,
): Promise<MediaMetadata | undefined> => {
	if (tmdbId !== undefined) {
		const movie = await getMovieById(tmdbId);
		if (movie) {
			const credits = await getMovieCredits(tmdbId);
			if (credits) {
				movie.cast = credits.cast;
				movie.crew = credits.crew;
			}
			return movie;
		}
	}
	// Fallback to search
	const results = await searchMovie(title, year);
	const match = results[FIRST];
	if (!match) {
		return undefined;
	}
	// Get full details + credits for the search result
	const movie = await getMovieById(match.externalId);
	if (movie) {
		const credits = await getMovieCredits(match.externalId);
		if (credits) {
			movie.cast = credits.cast;
			movie.crew = credits.crew;
		}
	}
	return movie;
};

const fetchShowMetadata = async (
	tvdbId: number | undefined,
	title: string,
	year: number | undefined,
): Promise<{ metadata: MediaMetadata | undefined; resolvedTvdbId: number | undefined }> => {
	if (tvdbId !== undefined) {
		const series = await getSeriesExtended(tvdbId);
		return { metadata: series, resolvedTvdbId: tvdbId };
	}
	// Fallback to search
	const results = await searchSeries(title, year);
	const match = results[FIRST];
	if (!match) {
		return { metadata: undefined, resolvedTvdbId: undefined };
	}
	// Get extended details (includes cast)
	const series = await getSeriesExtended(match.externalId);
	return { metadata: series, resolvedTvdbId: match.externalId };
};

const metadataRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/api/metadata/status",
		{
			schema: {
				response: {
					[StatusCodes.OK]: metadataStatusResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}
			return reply.code(StatusCodes.OK).send({
				tvdb: tvdbAvailable(),
				tmdb: tmdbAvailable(),
			});
		},
	);

	typedApp.get(
		"/api/metadata/:recommendationId",
		{
			schema: {
				params: z.object({ recommendationId: z.string() }),
				response: {
					[StatusCodes.OK]: metadataResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { recommendationId } = request.params;

			// Look up the recommendation
			const rec = app.db
				.select()
				.from(recommendations)
				.where(eq(recommendations.id, recommendationId))
				.get();

			if (!rec) {
				request.log.debug({ recommendationId }, "recommendation not found for metadata lookup");
				return reply.code(StatusCodes.OK).send({ available: false });
			}

			const isMovie = rec.mediaType === "movie";
			const source = isMovie ? "tmdb" : "tvdb";

			// Check if the relevant API is available
			if ((isMovie && !tmdbAvailable()) || (!isMovie && !tvdbAvailable())) {
				request.log.debug({ source, mediaType: rec.mediaType }, "metadata source not configured");
				return reply.code(StatusCodes.OK).send({ available: false });
			}

			// Check cache
			const externalId = isMovie ? rec.tmdbId : rec.tvdbId;
			if (externalId !== undefined && externalId !== null) {
				const cached = app.db
					.select()
					.from(metadataCache)
					.where(and(eq(metadataCache.externalId, externalId), eq(metadataCache.source, source)))
					.get();

				if (cached && !isCacheExpired(cached.fetchedAt)) {
					request.log.debug({ externalId, source }, "returning cached metadata");
					const metadata = deserializeMetadata(cached);
					return reply.code(StatusCodes.OK).send({ available: true as const, ...metadata });
				}
			}

			// Fetch from external API
			try {
				let metadata: MediaMetadata | undefined;

				if (isMovie) {
					metadata = await fetchMovieMetadata(
						rec.tmdbId ?? undefined,
						rec.title,
						rec.year ?? undefined,
					);
				} else {
					const result = await fetchShowMetadata(
						rec.tvdbId ?? undefined,
						rec.title,
						rec.year ?? undefined,
					);
					metadata = result.metadata;

					// Backfill tvdbId on recommendation if resolved via search
					if (result.resolvedTvdbId !== undefined && rec.tvdbId === null) {
						app.db
							.update(recommendations)
							.set({ tvdbId: result.resolvedTvdbId })
							.where(eq(recommendations.id, recommendationId))
							.run();
						request.log.debug(
							{ recommendationId, tvdbId: result.resolvedTvdbId },
							"backfilled tvdbId on recommendation",
						);
					}
				}

				if (!metadata) {
					request.log.debug({ title: rec.title, source }, "no metadata found from external API");
					return reply.code(StatusCodes.OK).send({ available: false });
				}

				// Upsert into cache
				const serialized = serializeMetadata(metadata);
				app.db
					.insert(metadataCache)
					.values(serialized)
					.onConflictDoUpdate({
						target: [metadataCache.externalId, metadataCache.source],
						set: serialized,
					})
					.run();

				request.log.info(
					{ externalId: metadata.externalId, source, title: metadata.title },
					"metadata fetched and cached",
				);
				return reply.code(StatusCodes.OK).send({ available: true as const, ...metadata });
			} catch (error) {
				request.log.error({ error, title: rec.title, source }, "failed to fetch metadata");
				return reply.code(StatusCodes.OK).send({ available: false });
			}
		},
	);
};

export { metadataRoutes };
```

- [ ] **Step 4: Register the metadata routes in app.ts and update CSP**

In `src/server/app.ts`:

Add the import:

```ts
import { metadataRoutes } from "./routes/metadata.ts";
```

Register the route in the `!options.skipDB` block, after `feedbackRoutes(app)`:

```ts
metadataRoutes(app);
```

Update the CSP `imgSrc` directive to allow TMDB and TVDB image domains:

```ts
imgSrc: ["'self'", "data:", "https://image.tmdb.org", "https://artworks.thetvdb.com"],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn vp test src/server/__tests__/metadata.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `yarn vp check && yarn vp test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/metadata.ts src/server/__tests__/metadata.test.ts src/server/app.ts
git commit -m "feat: add metadata routes for fetching enriched recommendation data"
```

---

## Task 6: Frontend — RTK Query Endpoints and MetadataPanel

**Files:**

- Create: `src/client/features/metadata/api.ts`
- Create: `src/client/components/MetadataPanel.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/components/RecommendationCard.tsx`

- [ ] **Step 1: Add "Metadata" tag type to the base API**

In `src/client/api.ts`, add `"Metadata"` to the `tagTypes` array:

```ts
tagTypes: ["PlexConnection", "AiConfig", "ArrConfig", "Conversations", "Library", "Metadata"],
```

- [ ] **Step 2: Create the metadata RTK Query endpoints**

```ts
// src/client/features/metadata/api.ts
import { api } from "../../api.ts";

import type { MetadataResponse, MetadataStatusResponse } from "@shared/schemas/metadata";

const metadataApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getMetadataStatus: builder.query<MetadataStatusResponse, void>({
			query: () => "api/metadata/status",
			providesTags: ["Metadata"],
		}),
		getMetadata: builder.query<MetadataResponse, string>({
			query: (recommendationId) => `api/metadata/${recommendationId}`,
		}),
	}),
});

const { useGetMetadataStatusQuery, useGetMetadataQuery, useLazyGetMetadataQuery } = metadataApi;

export { useGetMetadataQuery, useGetMetadataStatusQuery, useLazyGetMetadataQuery };
```

- [ ] **Step 3: Create the MetadataPanel component**

```tsx
// src/client/components/MetadataPanel.tsx
import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { useLazyGetMetadataQuery } from "../features/metadata/api.ts";
import { colors, radii, spacing } from "../theme.ts";

const metadataContainer = css`
	margin-top: ${spacing.sm};
	border-top: 1px solid ${colors.border};
	padding-top: ${spacing.sm};
`;

const posterRow = css`
	display: flex;
	gap: ${spacing.md};
`;

const posterImage = css`
	width: 80px;
	height: 120px;
	object-fit: cover;
	border-radius: ${radii.sm};
	flex-shrink: 0;
`;

const metadataDetails = css`
	flex: 1;
	min-width: 0;
`;

const genreList = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
	margin-bottom: ${spacing.xs};
`;

const genreBadge = css`
	font-size: 0.7rem;
	padding: 1px ${spacing.xs};
	border-radius: ${radii.sm};
	background: rgba(130, 170, 255, 0.1);
	color: ${colors.textMuted};
`;

const overviewText = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
	line-height: 1.4;
	margin-bottom: ${spacing.xs};
`;

const ratingText = css`
	font-size: 0.8rem;
	color: ${colors.textDim};
`;

const castSection = css`
	margin-top: ${spacing.xs};
`;

const castToggle = css`
	font-size: 0.8rem;
	color: ${colors.accent};
	background: none;
	border: none;
	cursor: pointer;
	padding: 0;

	&:hover {
		text-decoration: underline;
	}
`;

const castList = css`
	font-size: 0.8rem;
	color: ${colors.textMuted};
	line-height: 1.6;
	margin-top: ${spacing.xs};
`;

const showMoreButton = css`
	font-size: 0.8rem;
	color: ${colors.accent};
	background: none;
	border: none;
	cursor: pointer;
	padding: ${spacing.xs} 0;
	margin-top: ${spacing.xs};

	&:hover {
		text-decoration: underline;
	}
`;

const loadingText = css`
	font-size: 0.8rem;
	color: ${colors.textDim};
	padding: ${spacing.xs} 0;
`;

interface MetadataPanelProps {
	recommendationId: string;
	metadataAvailable: boolean;
}

const MetadataPanel = ({ recommendationId, metadataAvailable }: MetadataPanelProps) => {
	const [expanded, setExpanded] = useState(false);
	const [castExpanded, setCastExpanded] = useState(false);
	const [fetchMetadata, { data, isLoading }] = useLazyGetMetadataQuery();

	const handleExpand = useCallback(() => {
		if (!expanded) {
			void fetchMetadata(recommendationId);
		}
		setExpanded((prev) => !prev);
	}, [expanded, fetchMetadata, recommendationId]);

	const handleToggleCast = useCallback(() => {
		setCastExpanded((prev) => !prev);
	}, []);

	if (!metadataAvailable) {
		return undefined;
	}

	if (!expanded) {
		return (
			<button type="button" className={showMoreButton} onClick={handleExpand}>
				Show more info
			</button>
		);
	}

	if (isLoading) {
		return <p className={loadingText}>Loading metadata...</p>;
	}

	if (!data || !data.available) {
		return <p className={loadingText}>No additional info available.</p>;
	}

	const metadata = data;

	return (
		<div className={metadataContainer}>
			<MetadataContent
				metadata={metadata}
				castExpanded={castExpanded}
				onToggleCast={handleToggleCast}
			/>
		</div>
	);
};

const MetadataContent = ({
	metadata,
	castExpanded,
	onToggleCast,
}: {
	metadata: Extract<import("@shared/schemas/metadata").MetadataResponse, { available: true }>;
	castExpanded: boolean;
	onToggleCast: () => void;
}) => (
	<div className={posterRow}>
		{metadata.posterUrl ? (
			<img src={metadata.posterUrl} alt={`${metadata.title} poster`} className={posterImage} />
		) : undefined}
		<div className={metadataDetails}>
			{metadata.genres.length > 0 ? (
				<div className={genreList}>
					{metadata.genres.map((genre) => (
						<span key={genre} className={genreBadge}>
							{genre}
						</span>
					))}
				</div>
			) : undefined}
			{metadata.overview ? <p className={overviewText}>{metadata.overview}</p> : undefined}
			{metadata.rating !== undefined ? (
				<p className={ratingText}>
					Rating: {String(metadata.rating.toFixed(1))}
					{metadata.status ? ` | ${metadata.status}` : ""}
				</p>
			) : undefined}
			{metadata.cast.length > 0 ? (
				<CastCrewSection
					cast={metadata.cast}
					crew={metadata.crew}
					expanded={castExpanded}
					onToggle={onToggleCast}
				/>
			) : undefined}
		</div>
	</div>
);

const CastCrewSection = ({
	cast,
	crew,
	expanded,
	onToggle,
}: {
	cast: import("@shared/schemas/metadata").CreditPerson[];
	crew: import("@shared/schemas/metadata").CreditPerson[];
	expanded: boolean;
	onToggle: () => void;
}) => (
	<div className={castSection}>
		<button type="button" className={castToggle} onClick={onToggle}>
			{expanded ? "Hide cast & crew" : "Show cast & crew"}
		</button>
		{expanded ? (
			<div className={castList}>
				{crew.length > 0 ? (
					<p>{crew.map((person) => `${person.name} (${person.role})`).join(", ")}</p>
				) : undefined}
				{cast.map((person) => (
					<p key={person.name}>
						{person.name}
						{person.character ? ` as ${person.character}` : ""}
					</p>
				))}
			</div>
		) : undefined}
	</div>
);

export { MetadataPanel };
```

- [ ] **Step 4: Integrate MetadataPanel into RecommendationCard**

In `src/client/components/RecommendationCard.tsx`:

Add imports:

```ts
import { useGetMetadataStatusQuery } from "../features/metadata/api.ts";
import { MetadataPanel } from "./MetadataPanel.tsx";
```

Inside the `RecommendationCard` component, add the metadata status query:

```ts
const { data: metadataStatus } = useGetMetadataStatusQuery();
const metadataAvailable =
	metadataStatus !== undefined &&
	((recommendation.mediaType === "movie" && metadataStatus.tmdb) ||
		(recommendation.mediaType !== "movie" && metadataStatus.tvdb));
```

After the `CardActions` closing tag and before the `AddToArrModal`, add:

```tsx
<MetadataPanel recommendationId={recommendation.id} metadataAvailable={metadataAvailable} />
```

- [ ] **Step 5: Run typecheck and tests**

Run: `yarn vp check && yarn vp test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/client/features/metadata/api.ts src/client/components/MetadataPanel.tsx src/client/api.ts src/client/components/RecommendationCard.tsx
git commit -m "feat: add metadata panel to recommendation cards"
```

---

## Task 7: AI Prompt Enrichment

**Files:**

- Modify: `src/server/services/prompt-builder.ts`
- Modify: `src/server/routes/chat.ts`
- Modify: `src/server/__tests__/prompt-builder.test.ts`

- [ ] **Step 1: Write failing test for the new cast/crew prompt section**

Read `src/server/__tests__/prompt-builder.test.ts` first to understand its structure, then add a new test:

```ts
// Add to the existing test file
describe("buildCastCrewSection", () => {
	test("formats cast and crew metadata into prompt section", () => {
		const items: CastCrewContextItem[] = [
			{
				title: "Inception",
				year: 2010,
				cast: [
					{ name: "Leonardo DiCaprio", role: "Actor", character: "Cobb" },
					{ name: "Joseph Gordon-Levitt", role: "Actor", character: "Arthur" },
				],
				crew: [{ name: "Christopher Nolan", role: "Director", character: undefined }],
			},
		];
		const result = buildCastCrewSection(items);
		expect(result).toContain("Leonardo DiCaprio");
		expect(result).toContain("Christopher Nolan");
		expect(result).toContain("Director");
		expect(result).toContain("Inception");
	});

	test("returns empty string for empty items", () => {
		const result = buildCastCrewSection([]);
		expect(result).toBe("");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vp test src/server/__tests__/prompt-builder.test.ts`
Expected: FAIL (buildCastCrewSection not exported)

- [ ] **Step 3: Add `buildCastCrewSection` to prompt-builder.ts**

Add to `src/server/services/prompt-builder.ts`:

```ts
import type { CreditPerson } from "./metadata-types.ts";

interface CastCrewContextItem {
	title: string;
	year: number | undefined;
	cast: CreditPerson[];
	crew: CreditPerson[];
}

const buildCastCrewSection = (items: CastCrewContextItem[]): string => {
	if (items.length === EMPTY_LENGTH) {
		return "";
	}

	const sections: string[] = [
		"The following cast/crew information is available for items the user has watched or been recommended:",
	];

	for (const item of items) {
		const titleStr = `${item.title}${item.year ? ` (${String(item.year)})` : ""}`;
		const crewStr =
			item.crew.length > EMPTY_LENGTH
				? item.crew.map((c) => `${c.name} (${c.role})`).join(", ")
				: "";
		const castStr =
			item.cast.length > EMPTY_LENGTH
				? item.cast.map((c) => `${c.name}${c.character ? ` as ${c.character}` : ""}`).join(", ")
				: "";

		const parts = [titleStr];
		if (crewStr) {
			parts.push(`Crew: ${crewStr}`);
		}
		if (castStr) {
			parts.push(`Cast: ${castStr}`);
		}
		sections.push(`- ${parts.join(" | ")}`);
	}

	sections.push(
		"Use this information to identify patterns in actors, directors, or writers the user enjoys, and factor that into your recommendations.",
	);

	return sections.join("\n");
};
```

Export `buildCastCrewSection` and type `CastCrewContextItem` from the module.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vp test src/server/__tests__/prompt-builder.test.ts`
Expected: PASS

- [ ] **Step 5: Add keyword detection and metadata enrichment to chat route**

In `src/server/routes/chat.ts`, add imports:

```ts
import { metadataCache } from "../schema.ts";
import { buildCastCrewSection } from "../services/prompt-builder.ts";
import type { CastCrewContextItem } from "../services/prompt-builder.ts";
import type { CreditPerson } from "../services/metadata-types.ts";
```

Add a keyword detection constant and helper near the top of the file:

```ts
const CAST_CREW_KEYWORDS = ["actor", "director", "cast", "starring", "crew", "writer", "acted"];

const messageRequestsCastInfo = (message: string): boolean =>
	CAST_CREW_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword));
```

In the chat route handler, after building `feedbackContext` and before `buildSystemPrompt`, add:

```ts
// Optionally enrich with cast/crew metadata if the user's message suggests interest
let castCrewContext: CastCrewContextItem[] = [];
if (messageRequestsCastInfo(message)) {
	const cachedMetadata = app.db.select().from(metadataCache).all();

	castCrewContext = cachedMetadata
		.filter((row) => row.cast !== null || row.crew !== null)
		.map((row) => ({
			title: row.title,
			year: row.year ?? undefined,
			cast: row.cast ? (JSON.parse(row.cast) as CreditPerson[]) : [],
			crew: row.crew ? (JSON.parse(row.crew) as CreditPerson[]) : [],
		}))
		.filter((item) => item.cast.length > 0 || item.crew.length > 0);
}
```

Then in the `buildSystemPrompt` call, pass the cast/crew context. Update `BuildSystemPromptOptions` to accept an optional `castCrewContext` field, and in `buildSystemPrompt`, append the section if present:

In `prompt-builder.ts`, update `BuildSystemPromptOptions`:

```ts
interface BuildSystemPromptOptions {
	watchHistory: WatchHistoryItem[];
	mediaType: string;
	resultCount: number;
	exclusionContext?: ExclusionContext;
	feedbackContext?: FeedbackItem[];
	castCrewContext?: CastCrewContextItem[];
}
```

In `buildSystemPrompt`, after the `feedbackSection` line:

```ts
const castCrewSection =
	castCrewContext && castCrewContext.length > EMPTY_LENGTH
		? `\n\n${buildCastCrewSection(castCrewContext)}`
		: "";
```

Append `${castCrewSection}` to the return template string, after `${feedbackSection}`.

In the chat route, update the `buildSystemPrompt` call:

```ts
const systemPrompt = buildSystemPrompt({
	watchHistory,
	mediaType,
	resultCount,
	...(exclusionContext !== undefined && { exclusionContext }),
	...(feedbackContext.length > EMPTY_ARRAY_LENGTH && { feedbackContext }),
	...(castCrewContext.length > EMPTY_ARRAY_LENGTH && { castCrewContext }),
});
```

- [ ] **Step 6: Run the full test suite**

Run: `yarn vp check && yarn vp test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/services/prompt-builder.ts src/server/routes/chat.ts src/server/__tests__/prompt-builder.test.ts
git commit -m "feat: enrich AI prompts with cast/crew metadata when user asks about actors/directors"
```

---

## Task 8: Documentation Updates

**Files:**

- Modify: `docs/` (env var reference)
- Modify: `README.md` (if env vars are listed there)

- [ ] **Step 1: Update environment variable documentation**

Read the current `docs/` directory structure and `README.md` to find where environment variables are documented. Add the following to the appropriate location:

```
| `TVDB_API_KEY` | Optional. TVDB v4 API key for enriching TV show recommendation cards with metadata (poster, overview, genres, rating, cast/crew). Get one at https://thetvdb.com/api-information |
| `TMDB_API_KEY` | Optional. TMDB API key for enriching movie recommendation cards with metadata (poster, overview, genres, rating, cast/crew). Get one at https://www.themoviedb.org/settings/api |
```

- [ ] **Step 2: Update CLAUDE.md architecture section**

Add to the routes list in CLAUDE.md:

```
- `GET /api/metadata/status` — returns `{ tvdb: boolean, tmdb: boolean }` indicating which metadata sources are configured
- `GET /api/metadata/:recommendationId` — returns enriched metadata (poster, overview, genres, rating, cast/crew) for a recommendation, fetched from TVDB (shows) or TMDB (movies) with 7-day cache
```

Add `metadata-types.ts`, `tmdb-client.ts`, `tvdb-client.ts` to the services description.

Add `TVDB_API_KEY` and `TMDB_API_KEY` to the environment variables section.

- [ ] **Step 3: Commit**

```bash
git add docs/ CLAUDE.md README.md
git commit -m "docs: add TVDB/TMDB API keys and metadata routes to documentation"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run the full check and test suite**

Run: `yarn vp check && yarn vp test`
Expected: PASS

- [ ] **Step 2: Start the dev server and verify metadata works in the browser**

Run: `yarn dev`

1. Log in
2. Generate some recommendations (at least one movie and one TV show)
3. Verify "Show more info" button appears on recommendation cards (if TVDB_API_KEY or TMDB_API_KEY is set in `.env`)
4. Click "Show more info" — verify poster, overview, genres, rating appear
5. Click "Show cast & crew" — verify cast and crew are displayed
6. If no API keys are set, verify cards look exactly as before (no "Show more info" button)

- [ ] **Step 3: Verify graceful degradation**

Test with only TMDB_API_KEY set (remove TVDB_API_KEY from `.env`):

- Movie recommendations should show metadata
- TV show recommendations should not show "Show more info"

Test with no API keys set:

- All recommendations should look exactly as before
