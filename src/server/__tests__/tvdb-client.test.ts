import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { getSeriesById, getSeriesExtended, searchSeries } from "../services/tvdb-client.ts";

const TVDB_API_BASE = "https://api4.thetvdb.com/v4";
const MOCK_API_KEY = "test-tvdb-api-key";
const MOCK_TOKEN = "mock-bearer-token-12345";
const BREAKING_BAD_TVDB_ID = 81_189;
const BREAKING_BAD_YEAR = 2008;
const FIRST = 0;
const ZERO = 0;
const UNKNOWN_SERIES_ID = 999_999;

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

describe("src/server/tvdb-client.ts", () => {
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

	describe(searchSeries, () => {
		it("authenticates and returns normalized metadata", async () => {
			const results = await searchSeries("Breaking Bad", BREAKING_BAD_YEAR);
			expect(results.length).toBeGreaterThan(ZERO);
			const result = results[FIRST];
			expect(result?.title).toBe("Breaking Bad");
			expect(result?.externalId).toBe(BREAKING_BAD_TVDB_ID);
			expect(result?.source).toBe("tvdb");
			expect(result?.posterUrl).toContain("81189");
		});

		it("returns empty array when no results", async () => {
			mswServer.use(
				http.get(`${TVDB_API_BASE}/search`, () =>
					HttpResponse.json({ status: "success", data: [] }),
				),
			);
			const results = await searchSeries("Nonexistent Show 12345");
			expect(results).toStrictEqual([]);
		});
	});

	describe(getSeriesById, () => {
		it("returns full metadata for a series", async () => {
			const result = await getSeriesById(BREAKING_BAD_TVDB_ID);
			expect(result).toBeDefined();
			expect(result?.title).toBe("Breaking Bad");
			expect(result?.genres).toContain("Drama");
			expect(result?.genres).toContain("Thriller");
			expect(result?.status).toBe("Ended");
			expect(result?.source).toBe("tvdb");
		});

		it("returns undefined for 404", async () => {
			mswServer.use(
				http.get(`${TVDB_API_BASE}/series/*`, () => new HttpResponse(undefined, { status: 404 })),
			);
			const result = await getSeriesById(UNKNOWN_SERIES_ID);
			expect(result).toBeUndefined();
		});
	});

	describe(getSeriesExtended, () => {
		it("returns metadata with cast and crew", async () => {
			const result = await getSeriesExtended(BREAKING_BAD_TVDB_ID);
			expect(result).toBeDefined();
			expect(result?.cast.length).toBeGreaterThan(ZERO);
			expect(result?.cast[FIRST]?.name).toBe("Bryan Cranston");
			expect(result?.cast[FIRST]?.character).toBe("Walter White");
			expect(result?.crew.length).toBeGreaterThan(ZERO);
			expect(result?.crew[FIRST]?.name).toBe("Vince Gilligan");
			expect(result?.crew[FIRST]?.role).toBe("Director");
		});
	});
});
