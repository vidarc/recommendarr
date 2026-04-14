import * as z from "zod/mini";

import type { CreditPerson, MediaMetadata } from "./metadata-types.ts";

const TVDB_API_BASE_DEFAULT = "https://api4.thetvdb.com/v4";

const getApiBase = (): string => process.env["TVDB_API_BASE_URL"] ?? TVDB_API_BASE_DEFAULT;
const CAST_LIMIT = 10;
const CREW_LIMIT = 5;
const NOT_FOUND = 404;
const UNAUTHORIZED = 401;
const YEAR_RADIX = 10;
const SLICE_START = 0;

let cachedToken: string | undefined = undefined;

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
	const response = await fetch(`${getApiBase()}/login`, {
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
	const url = new URL(`${getApiBase()}${path}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	const response = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${token}` },
	});
	// If unauthorized, try re-authenticating once
	if (response.status === UNAUTHORIZED) {
		cachedToken = undefined;
		const newToken = await authenticate();
		return fetch(url.toString(), {
			headers: { Authorization: `Bearer ${newToken}` },
		});
	}
	return response;
};

const nullishString = z.optional(z.nullable(z.string()));

const searchResponseSchema = z.object({
	data: z.array(
		z.object({
			tvdb_id: z.string(),
			name: z.string(),
			overview: nullishString,
			image_url: nullishString,
			year: nullishString,
			type: z.optional(z.string()),
		}),
	),
});

const seriesDetailsSchema = z.object({
	data: z.object({
		id: z.number(),
		name: z.string(),
		overview: nullishString,
		image: nullishString,
		year: nullishString,
		genres: z.optional(z.array(z.object({ name: z.string() }))),
		score: z.optional(z.number()),
		status: z.optional(z.nullable(z.object({ name: z.string() }))),
	}),
});

const characterSchema = z.object({
	name: nullishString,
	peopleType: z.optional(z.string()),
	personName: z.optional(z.string()),
});

const seriesExtendedSchema = z.object({
	data: z.object({
		id: z.number(),
		name: z.string(),
		overview: nullishString,
		image: nullishString,
		year: nullishString,
		genres: z.optional(z.array(z.object({ name: z.string() }))),
		score: z.optional(z.number()),
		status: z.optional(z.nullable(z.object({ name: z.string() }))),
		characters: z.optional(z.array(characterSchema)),
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
		genres: series.genres?.map((genre) => genre.name) ?? [],
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
	const actors = characters.filter((char) => char.peopleType === "Actor");
	const directors = characters.filter(
		(char) => char.peopleType === "Director" || char.peopleType === "Writer",
	);

	const cast: CreditPerson[] = actors.slice(SLICE_START, CAST_LIMIT).map((char) => ({
		name: char.personName ?? "Unknown",
		role: "Actor",
		character: char.name ?? undefined,
	}));

	const crew: CreditPerson[] = directors.slice(SLICE_START, CREW_LIMIT).map((char) => ({
		name: char.personName ?? "Unknown",
		role: char.peopleType ?? "Unknown",
		character: undefined,
	}));

	return {
		externalId: series.id,
		source: "tvdb",
		title: series.name,
		overview: series.overview ?? undefined,
		posterUrl: series.image ?? undefined,
		genres: series.genres?.map((genre) => genre.name) ?? [],
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
