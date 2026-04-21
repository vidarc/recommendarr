import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { getMovieById, getMovieCredits, searchMovie } from "../services/tmdb-client.ts";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const MOCK_API_KEY = "test-tmdb-api-key";
const INCEPTION_TMDB_ID = 27_205;
const INCEPTION_YEAR = 2010;
const FIRST = 0;
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const GENRE_ACTION = 28;
const GENRE_SCIFI = 878;
const GENRE_ADVENTURE = 12;
const CAST_ORDER_FIRST = 0;
const CAST_ORDER_SECOND = 1;
const VOTE_AVERAGE = 8.4;
const UNKNOWN_MOVIE_ID = 999_999;

const mockSearchResults = {
	results: [
		{
			id: INCEPTION_TMDB_ID,
			title: "Inception",
			overview: "A thief who steals corporate secrets.",
			poster_path: "/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg",
			genre_ids: [GENRE_ACTION, GENRE_SCIFI, GENRE_ADVENTURE],
			vote_average: VOTE_AVERAGE,
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
		{ id: GENRE_ACTION, name: "Action" },
		{ id: GENRE_SCIFI, name: "Science Fiction" },
	],
	vote_average: VOTE_AVERAGE,
	release_date: "2010-07-16",
	status: "Released",
};

const mockMovieCredits = {
	cast: [
		{
			name: "Leonardo DiCaprio",
			known_for_department: "Acting",
			character: "Cobb",
			order: CAST_ORDER_FIRST,
		},
		{
			name: "Joseph Gordon-Levitt",
			known_for_department: "Acting",
			character: "Arthur",
			order: CAST_ORDER_SECOND,
		},
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

describe("tmdb-client", () => {
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

	describe(searchMovie, () => {
		it("returns normalized metadata for a search result", async () => {
			const results = await searchMovie("Inception", INCEPTION_YEAR);
			expect(results.length).toBeGreaterThan(FIRST);
			const result = results[FIRST];
			expect(result?.title).toBe("Inception");
			expect(result?.externalId).toBe(INCEPTION_TMDB_ID);
			expect(result?.source).toBe("tmdb");
			expect(result?.posterUrl).toContain("qmDpIHrmpJINaRKAfWQfftjCdyi.jpg");
		});

		it("returns empty array when no results", async () => {
			mswServer.use(
				http.get(`${TMDB_API_BASE}/search/movie`, () => HttpResponse.json({ results: [] })),
			);
			const results = await searchMovie("Nonexistent Movie 12345");
			expect(results).toStrictEqual([]);
		});
	});

	describe(getMovieById, () => {
		it("returns full metadata for a movie", async () => {
			const result = await getMovieById(INCEPTION_TMDB_ID);
			expect(result).toBeDefined();
			expect(result?.title).toBe("Inception");
			expect(result?.genres).toContain("Action");
			expect(result?.genres).toContain("Science Fiction");
			expect(result?.rating).toBe(VOTE_AVERAGE);
			expect(result?.source).toBe("tmdb");
			expect(result?.status).toBe("Released");
		});

		it("returns undefined for 404", async () => {
			mswServer.use(
				http.get(`${TMDB_API_BASE}/movie/*`, () => new HttpResponse(undefined, { status: 404 })),
			);
			const result = await getMovieById(UNKNOWN_MOVIE_ID);
			expect(result).toBeUndefined();
		});
	});

	describe(getMovieCredits, () => {
		it("returns cast and crew limited to configured maximums", async () => {
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
});
