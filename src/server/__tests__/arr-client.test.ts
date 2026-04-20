import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import {
	addMedia,
	getAllMovies,
	getAllSeries,
	getQualityProfiles,
	getRootFolders,
	lookupMedia,
	testConnection,
} from "../services/arr-client.ts";

const MOCK_RADARR_URL = "http://localhost:7878";
const MOCK_SONARR_URL = "http://localhost:8989";
const MOCK_API_KEY = "test-api-key-12345";

const FIRST = 0;
const SECOND = 1;
const TWO_ITEMS = 2;
const THREE_ITEMS = 3;

const INCEPTION_ARR_ID = 42;
const BREAKING_BAD_ARR_ID = 99;
const NOT_IN_LIBRARY_ARR_ID = 0;
const INCEPTION_YEAR = 2010;

const mockSystemStatus = { version: "5.3.6" };

const mockRootFolders = [
	{ id: 1, path: "/movies", freeSpace: 1_000_000_000 },
	{ id: 2, path: "/tv", freeSpace: 2_000_000_000 },
];

const mockQualityProfiles = [
	{ id: 1, name: "Any" },
	{ id: 2, name: "HD-1080p" },
	{ id: 3, name: "4K" },
];

const mockMovieLookupResults = [
	{
		id: INCEPTION_ARR_ID,
		title: "Inception",
		year: INCEPTION_YEAR,
		tmdbId: 27_205,
		overview: "A thief who steals corporate secrets.",
	},
	{
		id: NOT_IN_LIBRARY_ARR_ID,
		title: "Interstellar",
		year: 2014,
		tmdbId: 157_336,
		overview: "A team of explorers travel through a wormhole.",
	},
];

const mockSeriesLookupResults = [
	{
		id: BREAKING_BAD_ARR_ID,
		title: "Breaking Bad",
		year: 2008,
		tvdbId: 81_189,
		overview: "A chemistry teacher turned drug manufacturer.",
	},
	{
		id: NOT_IN_LIBRARY_ARR_ID,
		title: "Better Call Saul",
		year: 2015,
		tvdbId: 273_181,
		overview: "The trials of a small-time attorney.",
	},
];

const handlers = [
	http.get(`${MOCK_RADARR_URL}/api/v3/system/status`, () => HttpResponse.json(mockSystemStatus)),
	http.get(`${MOCK_SONARR_URL}/api/v3/system/status`, () => HttpResponse.json(mockSystemStatus)),
	http.get(`${MOCK_RADARR_URL}/api/v3/rootfolder`, () => HttpResponse.json(mockRootFolders)),
	http.get(`${MOCK_RADARR_URL}/api/v3/qualityprofile`, () =>
		HttpResponse.json(mockQualityProfiles),
	),
	http.get(`${MOCK_RADARR_URL}/api/v3/movie/lookup`, () =>
		HttpResponse.json(mockMovieLookupResults),
	),
	http.get(`${MOCK_SONARR_URL}/api/v3/series/lookup`, () =>
		HttpResponse.json(mockSeriesLookupResults),
	),
	http.post(`${MOCK_RADARR_URL}/api/v3/movie`, () => HttpResponse.json({ id: INCEPTION_ARR_ID })),
	http.post(`${MOCK_SONARR_URL}/api/v3/series`, () =>
		HttpResponse.json({ id: BREAKING_BAD_ARR_ID }),
	),
];

const mswServer = setupServer(...handlers);

describe(testConnection, () => {
	beforeAll(() => {
		mswServer.listen({ onUnhandledRequest: "bypass" });
	});

	afterEach(() => {
		mswServer.resetHandlers();
	});

	afterAll(() => {
		mswServer.close();
	});

	it("returns success with version when service responds 200", async () => {
		const result = await testConnection(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(result.success).toBe(true);
		expect(result.version).toBe("5.3.6");
		expect(result.error).toBeUndefined();
	});

	it("returns failure on network error", async () => {
		mswServer.use(http.get(`${MOCK_RADARR_URL}/api/v3/system/status`, () => HttpResponse.error()));

		const result = await testConnection(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("returns failure on 401 unauthorized", async () => {
		mswServer.use(
			http.get(
				`${MOCK_RADARR_URL}/api/v3/system/status`,
				() => new HttpResponse(undefined, { status: 401 }),
			),
		);

		const result = await testConnection(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(result.success).toBe(false);
		expect(result.error).toContain("401");
	});
});

describe(getRootFolders, () => {
	it("returns root folders array on success", async () => {
		const folders = await getRootFolders(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(folders).toHaveLength(TWO_ITEMS);
		expect(folders[FIRST]).toStrictEqual({
			id: 1,
			path: "/movies",
			freeSpace: 1_000_000_000,
		});
		expect(folders[SECOND]).toStrictEqual({
			id: 2,
			path: "/tv",
			freeSpace: 2_000_000_000,
		});
	});

	it("throws on failed request (401)", async () => {
		mswServer.use(
			http.get(
				`${MOCK_RADARR_URL}/api/v3/rootfolder`,
				() => new HttpResponse(undefined, { status: 401 }),
			),
		);

		await expect(getRootFolders(MOCK_RADARR_URL, MOCK_API_KEY)).rejects.toThrow(
			"Failed to get root folders",
		);
	});
});

describe(getQualityProfiles, () => {
	it("returns quality profiles array on success", async () => {
		const profiles = await getQualityProfiles(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(profiles).toHaveLength(THREE_ITEMS);
		expect(profiles[FIRST]).toStrictEqual({ id: 1, name: "Any" });
		expect(profiles[SECOND]).toStrictEqual({ id: 2, name: "HD-1080p" });
	});
});

describe(lookupMedia, () => {
	it("searches Radarr movie/lookup with correct term", async () => {
		let capturedUrl: URL = new URL("http://placeholder");
		mswServer.use(
			http.get(`${MOCK_RADARR_URL}/api/v3/movie/lookup`, ({ request }) => {
				capturedUrl = new URL(request.url);
				return HttpResponse.json(mockMovieLookupResults);
			}),
		);

		await lookupMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			title: "Inception",
		});

		expect(capturedUrl.searchParams.get("term")).toBe("Inception");
	});

	it("searches Sonarr series/lookup with correct term", async () => {
		let capturedUrl: URL = new URL("http://placeholder");
		mswServer.use(
			http.get(`${MOCK_SONARR_URL}/api/v3/series/lookup`, ({ request }) => {
				capturedUrl = new URL(request.url);
				return HttpResponse.json(mockSeriesLookupResults);
			}),
		);

		await lookupMedia({
			url: MOCK_SONARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "sonarr",
			title: "Breaking Bad",
		});

		expect(capturedUrl.searchParams.get("term")).toBe("Breaking Bad");
	});

	it("marks items with id > 0 as existsInLibrary: true", async () => {
		const results = await lookupMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			title: "Inception",
		});

		expect(results[FIRST]!.existsInLibrary).toBe(true);
		expect(results[FIRST]!.arrId).toBe(INCEPTION_ARR_ID);
	});

	it("marks items with id: 0 as existsInLibrary: false", async () => {
		const results = await lookupMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			title: "Interstellar",
		});

		expect(results[SECOND]!.existsInLibrary).toBe(false);
		expect(results[SECOND]!.arrId).toBe(NOT_IN_LIBRARY_ARR_ID);
	});

	it("appends year to search term when provided", async () => {
		let capturedUrl: URL = new URL("http://placeholder");
		mswServer.use(
			http.get(`${MOCK_RADARR_URL}/api/v3/movie/lookup`, ({ request }) => {
				capturedUrl = new URL(request.url);
				return HttpResponse.json(mockMovieLookupResults);
			}),
		);

		await lookupMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			title: "Inception",
			year: INCEPTION_YEAR,
		});

		expect(capturedUrl.searchParams.get("term")).toBe("Inception 2010");
	});

	it("returns empty array when no matches", async () => {
		mswServer.use(http.get(`${MOCK_RADARR_URL}/api/v3/movie/lookup`, () => HttpResponse.json([])));

		const results = await lookupMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			title: "Nonexistent Movie",
		});

		expect(results).toStrictEqual([]);
	});
});

const INCEPTION_TMDB_ID = 27_205;
const BREAKING_BAD_TVDB_ID = 81_189;

const mockLibraryMovies = [
	{
		id: 1,
		title: "Inception",
		year: INCEPTION_YEAR,
		tmdbId: INCEPTION_TMDB_ID,
		genres: ["Action", "Sci-Fi", "Thriller"],
	},
	{
		id: 2,
		title: "Interstellar",
		year: 2014,
		tmdbId: 157_336,
		genres: ["Adventure", "Drama", "Sci-Fi"],
	},
];

const mockLibrarySeries = [
	{
		id: 1,
		title: "Breaking Bad",
		year: 2008,
		tvdbId: BREAKING_BAD_TVDB_ID,
		genres: ["Crime", "Drama", "Thriller"],
	},
	{
		id: 2,
		title: "Better Call Saul",
		year: 2015,
		tvdbId: 273_181,
		genres: ["Crime", "Drama"],
	},
];

describe(getAllMovies, () => {
	it("returns ArrLibraryMovie[] with genres joined as comma-separated string", async () => {
		mswServer.use(
			http.get(`${MOCK_RADARR_URL}/api/v3/movie`, () => HttpResponse.json(mockLibraryMovies)),
		);

		const movies = await getAllMovies(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(movies).toHaveLength(TWO_ITEMS);
		expect(movies[FIRST]).toStrictEqual({
			title: "Inception",
			year: INCEPTION_YEAR,
			tmdbId: INCEPTION_TMDB_ID,
			genres: "Action, Sci-Fi, Thriller",
		});
		expect(movies[SECOND]).toStrictEqual({
			title: "Interstellar",
			year: 2014,
			tmdbId: 157_336,
			genres: "Adventure, Drama, Sci-Fi",
		});
	});

	it("returns empty array for empty library", async () => {
		mswServer.use(http.get(`${MOCK_RADARR_URL}/api/v3/movie`, () => HttpResponse.json([])));

		const movies = await getAllMovies(MOCK_RADARR_URL, MOCK_API_KEY);

		expect(movies).toStrictEqual([]);
	});

	it("throws on failed request (401)", async () => {
		mswServer.use(
			http.get(
				`${MOCK_RADARR_URL}/api/v3/movie`,
				() => new HttpResponse(undefined, { status: 401 }),
			),
		);

		await expect(getAllMovies(MOCK_RADARR_URL, MOCK_API_KEY)).rejects.toThrow(
			"Failed to get movies",
		);
	});
});

describe(getAllSeries, () => {
	it("returns ArrLibrarySeries[] with genres joined as comma-separated string", async () => {
		mswServer.use(
			http.get(`${MOCK_SONARR_URL}/api/v3/series`, () => HttpResponse.json(mockLibrarySeries)),
		);

		const series = await getAllSeries(MOCK_SONARR_URL, MOCK_API_KEY);

		expect(series).toHaveLength(TWO_ITEMS);
		expect(series[FIRST]).toStrictEqual({
			title: "Breaking Bad",
			year: 2008,
			tvdbId: BREAKING_BAD_TVDB_ID,
			genres: "Crime, Drama, Thriller",
		});
		expect(series[SECOND]).toStrictEqual({
			title: "Better Call Saul",
			year: 2015,
			tvdbId: 273_181,
			genres: "Crime, Drama",
		});
	});

	it("returns empty array for empty library", async () => {
		mswServer.use(http.get(`${MOCK_SONARR_URL}/api/v3/series`, () => HttpResponse.json([])));

		const result = await getAllSeries(MOCK_SONARR_URL, MOCK_API_KEY);

		expect(result).toStrictEqual([]);
	});

	it("throws on failed request (401)", async () => {
		mswServer.use(
			http.get(
				`${MOCK_SONARR_URL}/api/v3/series`,
				() => new HttpResponse(undefined, { status: 401 }),
			),
		);

		await expect(getAllSeries(MOCK_SONARR_URL, MOCK_API_KEY)).rejects.toThrow(
			"Failed to get series",
		);
	});
});

describe(addMedia, () => {
	it("adds movie to Radarr with correct body", async () => {
		let capturedBody: unknown = undefined;
		mswServer.use(
			http.post(`${MOCK_RADARR_URL}/api/v3/movie`, async ({ request }) => {
				capturedBody = await request.json();
				return HttpResponse.json({ id: INCEPTION_ARR_ID });
			}),
		);

		const result = await addMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			params: {
				tmdbId: 27_205,
				title: "Inception",
				year: INCEPTION_YEAR,
				qualityProfileId: 1,
				rootFolderPath: "/movies",
			},
		});

		expect(result.success).toBe(true);
		expect(result.id).toBe(INCEPTION_ARR_ID);
		expect(capturedBody).toMatchObject({
			tmdbId: 27_205,
			minimumAvailability: "released",
			monitored: true,
			addOptions: { searchForMovie: true },
		});
	});

	it("adds series to Sonarr with correct body", async () => {
		let capturedBody: unknown = undefined;
		mswServer.use(
			http.post(`${MOCK_SONARR_URL}/api/v3/series`, async ({ request }) => {
				capturedBody = await request.json();
				return HttpResponse.json({ id: BREAKING_BAD_ARR_ID });
			}),
		);

		const result = await addMedia({
			url: MOCK_SONARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "sonarr",
			params: {
				tvdbId: 81_189,
				title: "Breaking Bad",
				year: 2008,
				qualityProfileId: 2,
				rootFolderPath: "/tv",
			},
		});

		expect(result.success).toBe(true);
		expect(result.id).toBe(BREAKING_BAD_ARR_ID);
		expect(capturedBody).toMatchObject({
			tvdbId: 81_189,
			seasonFolder: true,
			seriesType: "standard",
			addOptions: { searchForMissingEpisodes: true },
		});
	});

	it("returns failure when service rejects (400)", async () => {
		mswServer.use(
			http.post(
				`${MOCK_RADARR_URL}/api/v3/movie`,
				() => new HttpResponse("Movie already exists", { status: 400 }),
			),
		);

		const result = await addMedia({
			url: MOCK_RADARR_URL,
			apiKey: MOCK_API_KEY,
			serviceType: "radarr",
			params: {
				tmdbId: 27_205,
				title: "Inception",
				year: INCEPTION_YEAR,
				qualityProfileId: 1,
				rootFolderPath: "/movies",
			},
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});
