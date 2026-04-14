import * as z from "zod/mini";

import type { CreditPerson, MediaMetadata } from "./metadata-types.ts";

const TMDB_API_BASE_DEFAULT = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const NOT_FOUND = 404;
const FIRST_MATCH = 0;
const YEAR_END = 4;

const getApiKey = (): string | undefined => process.env["TMDB_API_KEY"];

const getApiBase = (): string => process.env["TMDB_API_BASE_URL"] ?? TMDB_API_BASE_DEFAULT;

const isAvailable = (): boolean => getApiKey() !== undefined;

const tmdbFetch = async (path: string, params: Record<string, string> = {}): Promise<Response> => {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("TMDB_API_KEY is not configured");
	}
	const url = new URL(`${getApiBase()}${path}`);
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
			overview: z.optional(z.string()),
			poster_path: z.optional(z.nullable(z.string())),
			genre_ids: z.optional(z.array(z.number())),
			vote_average: z.optional(z.number()),
			release_date: z.optional(z.string()),
		}),
	),
});

const movieDetailsSchema = z.object({
	id: z.number(),
	title: z.string(),
	overview: z.optional(z.string()),
	poster_path: z.optional(z.nullable(z.string())),
	genres: z.array(z.object({ id: z.number(), name: z.string() })),
	vote_average: z.optional(z.number()),
	release_date: z.optional(z.string()),
	status: z.optional(z.string()),
});

const creditsSchema = z.object({
	cast: z.array(
		z.object({
			name: z.string(),
			known_for_department: z.optional(z.string()),
			character: z.optional(z.string()),
			order: z.optional(z.number()),
		}),
	),
	crew: z.array(
		z.object({
			name: z.string(),
			department: z.optional(z.string()),
			job: z.string(),
		}),
	),
});

const extractYear = (releaseDate: string | undefined): number | undefined => {
	if (!releaseDate) {
		return undefined;
	}
	const year = Number.parseInt(releaseDate.slice(FIRST_MATCH, YEAR_END), 10);
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
		genres: data.genres.map((genre) => genre.name),
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
	const cast: CreditPerson[] = data.cast.slice(FIRST_MATCH, CAST_LIMIT).map((castMember) => ({
		name: castMember.name,
		role: "Actor",
		character: castMember.character,
	}));
	const crew: CreditPerson[] = data.crew
		.filter(
			(crewMember) => crewMember.department === "Directing" || crewMember.department === "Writing",
		)
		.slice(FIRST_MATCH, CREW_LIMIT)
		.map((crewMember) => ({
			name: crewMember.name,
			role: crewMember.job,
			character: undefined,
		}));
	return { cast, crew };
};

export { getMovieById, getMovieCredits, isAvailable, searchMovie };
