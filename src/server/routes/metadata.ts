import { and, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import * as z from "zod/mini";

import { errorResponseSchema } from "../../shared/schemas/common.ts";
import {
	metadataResponseSchema,
	metadataStatusResponseSchema,
} from "../../shared/schemas/metadata.ts";
import { conversations, messages, metadataCache, recommendations } from "../schema.ts";
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

const metadataSourceSchema = z.enum(["tvdb", "tmdb"]);
const creditPersonSchema = z.object({
	name: z.string(),
	role: z.string(),
	character: z.optional(z.string()),
});
const creditPersonArraySchema = z.array(creditPersonSchema);
const stringArraySchema = z.array(z.string());

// Cache rows are written by our own serialize path; parsing ensures the
// Trust boundary is enforced (e.g. tampered DB) but the shape mirrors
// CreditPerson exactly. Map to normalize character to `string | undefined`
// For exactOptionalPropertyTypes.
const normalizeCredits = (input: unknown): CreditPerson[] =>
	creditPersonArraySchema.parse(input).map((person) => ({
		name: person.name,
		role: person.role,
		character: person.character,
	}));

const isCacheExpired = (fetchedAt: number): boolean => {
	const now = Date.now();
	const age = now - fetchedAt;
	return age > METADATA_CACHE_TTL_DAYS * MS_PER_DAY;
};

const serializeMetadata = (metadata: MediaMetadata) => ({
	externalId: metadata.externalId,
	source: metadata.source,
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
	cast: row.cast ? normalizeCredits(JSON.parse(row.cast)) : [],
	crew: row.crew ? normalizeCredits(JSON.parse(row.crew)) : [],
	status: row.status ?? undefined,
});

const fetchMovieMetadata = async (
	tmdbId: number | undefined,
	title: string,
	year: number | undefined,
): Promise<{
	metadata: MediaMetadata | undefined;
	resolvedTmdbId: number | undefined;
}> => {
	if (tmdbId !== undefined) {
		const movie = await getMovieById(tmdbId);
		if (movie) {
			const credits = await getMovieCredits(tmdbId);
			if (credits) {
				movie.cast = credits.cast;
				movie.crew = credits.crew;
			}
			return { metadata: movie, resolvedTmdbId: tmdbId };
		}
	}
	// Fallback to search
	const [match] = await searchMovie(title, year);
	if (!match) {
		return { metadata: undefined, resolvedTmdbId: undefined };
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
	return { metadata: movie, resolvedTmdbId: match.externalId };
};

const fetchShowMetadata = async (
	tvdbId: number | undefined,
	title: string,
	year: number | undefined,
): Promise<{
	metadata: MediaMetadata | undefined;
	resolvedTvdbId: number | undefined;
}> => {
	if (tvdbId !== undefined) {
		const series = await getSeriesExtended(tvdbId);
		return { metadata: series, resolvedTvdbId: tvdbId };
	}
	// Fallback to search
	const [match] = await searchSeries(title, year);
	if (!match) {
		return { metadata: undefined, resolvedTvdbId: undefined };
	}
	// Get extended details (includes cast)
	const series = await getSeriesExtended(match.externalId);
	return { metadata: series, resolvedTvdbId: match.externalId };
};

interface ResolvedMetadata {
	metadata: MediaMetadata | undefined;
	resolvedTmdbId: number | undefined;
	resolvedTvdbId: number | undefined;
}

type RecommendationForMetadata = Pick<
	typeof recommendations.$inferSelect,
	"mediaType" | "tmdbId" | "tvdbId" | "title" | "year"
>;

const resolveMetadata = async (rec: RecommendationForMetadata): Promise<ResolvedMetadata> => {
	const isMovie = rec.mediaType === "movie";
	if (isMovie) {
		const { metadata, resolvedTmdbId } = await fetchMovieMetadata(
			rec.tmdbId ?? undefined,
			rec.title,
			rec.year ?? undefined,
		);
		return { metadata, resolvedTmdbId, resolvedTvdbId: undefined };
	}
	const { metadata, resolvedTvdbId } = await fetchShowMetadata(
		rec.tvdbId ?? undefined,
		rec.title,
		rec.year ?? undefined,
	);
	return { metadata, resolvedTmdbId: undefined, resolvedTvdbId };
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
					[StatusCodes.BAD_GATEWAY]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { recommendationId } = request.params;

			// Look up the recommendation and verify ownership
			// (recommendation -> message -> conversation -> user)
			const rec = app.db
				.select({
					id: recommendations.id,
					messageId: recommendations.messageId,
					title: recommendations.title,
					year: recommendations.year,
					mediaType: recommendations.mediaType,
					synopsis: recommendations.synopsis,
					tmdbId: recommendations.tmdbId,
					tvdbId: recommendations.tvdbId,
					addedToArr: recommendations.addedToArr,
					feedback: recommendations.feedback,
					userId: conversations.userId,
				})
				.from(recommendations)
				.innerJoin(messages, eq(recommendations.messageId, messages.id))
				.innerJoin(conversations, eq(messages.conversationId, conversations.id))
				.where(eq(recommendations.id, recommendationId))
				.get();

			if (!rec || rec.userId !== request.user.id) {
				request.log.debug({ recommendationId }, "recommendation not found or not owned by user");
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
				const { metadata, resolvedTmdbId, resolvedTvdbId } = await resolveMetadata(rec);

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

				// Backfill tmdbId on recommendation if resolved via search
				if (resolvedTmdbId !== undefined && rec.tmdbId === null) {
					app.db
						.update(recommendations)
						.set({ tmdbId: resolvedTmdbId })
						.where(eq(recommendations.id, recommendationId))
						.run();
					request.log.debug(
						{ recommendationId, tmdbId: resolvedTmdbId },
						"backfilled tmdbId on recommendation",
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
				const message = error instanceof Error ? error.message : String(error);
				const name = error instanceof Error ? error.name : "UnknownError";
				request.log.error(
					{
						err: error,
						errorName: name,
						errorMessage: message,
						title: rec.title,
						source,
					},
					"metadata upstream fetch failed",
				);
				return reply.code(StatusCodes.BAD_GATEWAY).send({ error: "Metadata provider unavailable" });
			}
		},
	);
};

export { metadataRoutes };
