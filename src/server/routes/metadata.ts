import { and, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { errorResponseSchema } from "../../shared/schemas/common.ts";
import {
	metadataResponseSchema,
	metadataStatusResponseSchema,
} from "../../shared/schemas/metadata.ts";
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

import type { CreditPerson, MediaMetadata } from "../services/metadata-types.ts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const METADATA_CACHE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const FIRST = 0;

const metadataSourceSchema = z.enum(["tvdb", "tmdb"]);
const creditPersonSchema = z
	.object({
		name: z.string(),
		role: z.string(),
		character: z.string().optional(),
	})
	.transform(
		(val): CreditPerson => ({
			name: val.name,
			role: val.role,
			character: val.character,
		}),
	);
const creditPersonArraySchema = z.array(creditPersonSchema);
const stringArraySchema = z.array(z.string());

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
	source: metadataSourceSchema.parse(row.source),
	title: row.title,
	overview: row.overview ?? undefined,
	posterUrl: row.posterUrl ?? undefined,
	genres: row.genres ? stringArraySchema.parse(JSON.parse(row.genres)) : [],
	rating: row.rating ?? undefined,
	year: row.year ?? undefined,
	cast: row.cast ? creditPersonArraySchema.parse(JSON.parse(row.cast)) : [],
	crew: row.crew ? creditPersonArraySchema.parse(JSON.parse(row.crew)) : [],
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

const resolveMetadata = async (rec: {
	mediaType: string;
	tmdbId: number | null;
	tvdbId: number | null;
	title: string;
	year: number | null;
}): Promise<{ metadata: MediaMetadata | undefined; resolvedTvdbId: number | undefined }> => {
	const isMovie = rec.mediaType === "movie";
	if (isMovie) {
		const metadata = await fetchMovieMetadata(
			rec.tmdbId ?? undefined,
			rec.title,
			rec.year ?? undefined,
		);
		return { metadata, resolvedTvdbId: undefined };
	}
	return fetchShowMetadata(rec.tvdbId ?? undefined, rec.title, rec.year ?? undefined);
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
				const { metadata, resolvedTvdbId } = await resolveMetadata(rec);

				// Backfill tvdbId on recommendation if resolved via search
				if (resolvedTvdbId !== undefined && rec.tvdbId === null) {
					app.db
						.update(recommendations)
						.set({ tvdbId: resolvedTvdbId })
						.where(eq(recommendations.id, recommendationId))
						.run();
					request.log.debug(
						{ recommendationId, tvdbId: resolvedTvdbId },
						"backfilled tvdbId on recommendation",
					);
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
