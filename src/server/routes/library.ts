import { randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { arrConnections, libraryItems, plexConnections, userSettings } from "../schema.ts";
import { syncLibrary } from "../services/library-sync.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const errorResponseSchema = z.object({
	error: z.string(),
});

const syncResponseSchema = z.object({
	movieCount: z.number(),
	showCount: z.number(),
	totalCount: z.number(),
});

const statusResponseSchema = z.object({
	lastSynced: z.string().optional(),
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

const settingsResponseSchema = z.object({
	success: z.boolean(),
});

const libraryRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/api/library/sync",
		{
			schema: {
				response: {
					[StatusCodes.OK]: syncResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const plexConnection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (!plexConnection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			const arrConns = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, request.user.id))
				.all();

			await syncLibrary({
				userId: request.user.id,
				db: app.db,
				sqlite: app.sqlite,
				plexConnection,
				arrConns,
			});

			const items = app.db
				.select()
				.from(libraryItems)
				.where(eq(libraryItems.userId, request.user.id))
				.all();

			const movieCount = items.filter((item) => item.mediaType === "movie").length;
			const showCount = items.filter((item) => item.mediaType === "show").length;
			const totalCount = items.length;

			return reply.code(StatusCodes.OK).send({ movieCount, showCount, totalCount });
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

			const settings = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, request.user.id))
				.get();

			const counts = app.db
				.select({ mediaType: libraryItems.mediaType, total: count() })
				.from(libraryItems)
				.where(eq(libraryItems.userId, request.user.id))
				.groupBy(libraryItems.mediaType)
				.all();

			const ZERO_COUNT = 0;
			const movieCount = counts.find((row) => row.mediaType === "movie")?.total ?? ZERO_COUNT;
			const showCount = counts.find((row) => row.mediaType === "show")?.total ?? ZERO_COUNT;

			return reply.code(StatusCodes.OK).send({
				lastSynced: settings?.librarySyncLast ?? undefined,
				interval: settings?.librarySyncInterval ?? "manual",
				itemCount: movieCount + showCount,
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

			const { interval, excludeDefault } = request.body;

			const existing = app.db
				.select()
				.from(userSettings)
				.where(eq(userSettings.userId, request.user.id))
				.get();

			if (existing) {
				app.db
					.update(userSettings)
					.set({ librarySyncInterval: interval, excludeLibraryDefault: excludeDefault })
					.where(eq(userSettings.userId, request.user.id))
					.run();
			} else {
				app.db
					.insert(userSettings)
					.values({
						id: randomUUID(),
						userId: request.user.id,
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
