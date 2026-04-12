import { z } from "zod";

import type { CreditPerson, MediaMetadata } from "./metadata-types.ts";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const NOT_FOUND = 404;
const FIRST_MATCH = 0;
const YEAR_END = 4;

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
