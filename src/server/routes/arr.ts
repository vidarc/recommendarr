import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { arrConnections, recommendations } from "../schema.ts";
import {
	addMedia,
	getQualityProfiles,
	getRootFolders,
	lookupMedia,
	testConnection as testArrConnection,
} from "../services/arr-client.ts";
import { decrypt, encrypt } from "../services/encryption.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const MASK_VISIBLE_CHARS = 4;
const MIN_STRING_LENGTH = 1;

const maskApiKey = (key: string): string => {
	if (key.length <= MASK_VISIBLE_CHARS) {
		return "****";
	}
	return `****${key.slice(-MASK_VISIBLE_CHARS)}`;
};

const serviceTypeSchema = z.enum(["radarr", "sonarr"]);

const errorResponseSchema = z.object({
	error: z.string(),
});

const successResponseSchema = z.object({
	success: z.boolean(),
});

const arrConnectionResponseSchema = z.object({
	id: z.string(),
	serviceType: z.string(),
	url: z.string(),
	apiKey: z.string(),
});

const arrConfigBodySchema = z.object({
	url: z.string().url(),
	apiKey: z.string().min(MIN_STRING_LENGTH),
});

const testConnectionBodySchema = z.object({
	serviceType: serviceTypeSchema,
});

const testConnectionResponseSchema = z.object({
	success: z.boolean(),
	version: z.string().optional(),
	error: z.string().optional(),
});

const rootFolderSchema = z.object({
	id: z.number(),
	path: z.string(),
	freeSpace: z.number(),
});

const qualityProfileSchema = z.object({
	id: z.number(),
	name: z.string(),
});

const optionsResponseSchema = z.object({
	rootFolders: z.array(rootFolderSchema),
	qualityProfiles: z.array(qualityProfileSchema),
});

const lookupBodySchema = z.object({
	serviceType: serviceTypeSchema,
	title: z.string().min(MIN_STRING_LENGTH),
	year: z.number().optional(),
});

const lookupResultSchema = z.object({
	title: z.string(),
	year: z.number(),
	tmdbId: z.number().optional(),
	tvdbId: z.number().optional(),
	overview: z.string(),
	existsInLibrary: z.boolean(),
	arrId: z.number(),
});

const addBodySchema = z.object({
	serviceType: serviceTypeSchema,
	recommendationId: z.string(),
	tmdbId: z.number().optional(),
	tvdbId: z.number().optional(),
	title: z.string().min(MIN_STRING_LENGTH),
	year: z.number(),
	qualityProfileId: z.number(),
	rootFolderPath: z.string().min(MIN_STRING_LENGTH),
});

const addResponseSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

const serviceTypeParamsSchema = z.object({
	serviceType: serviceTypeSchema,
});

const arrRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/api/arr/config",
		{
			schema: {
				response: {
					[StatusCodes.OK]: z.array(arrConnectionResponseSchema),
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const connections = app.db
				.select()
				.from(arrConnections)
				.where(eq(arrConnections.userId, request.user.id))
				.all();

			return reply.code(StatusCodes.OK).send(
				connections.map((conn) => ({
					id: conn.id,
					serviceType: conn.serviceType,
					url: conn.url,
					apiKey: maskApiKey(decrypt(conn.apiKey)),
				})),
			);
		},
	);

	typedApp.put(
		"/api/arr/config/:serviceType",
		{
			schema: {
				params: serviceTypeParamsSchema,
				body: arrConfigBodySchema,
				response: {
					[StatusCodes.OK]: successResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { serviceType } = request.params;
			const { url, apiKey } = request.body;
			const now = new Date().toISOString();
			const encryptedKey = encrypt(apiKey);

			const existing = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (existing) {
				app.db
					.update(arrConnections)
					.set({ url, apiKey: encryptedKey, updatedAt: now })
					.where(
						and(
							eq(arrConnections.userId, request.user.id),
							eq(arrConnections.serviceType, serviceType),
						),
					)
					.run();
			} else {
				app.db
					.insert(arrConnections)
					.values({
						id: randomUUID(),
						userId: request.user.id,
						serviceType,
						url,
						apiKey: encryptedKey,
						createdAt: now,
						updatedAt: now,
					})
					.run();
			}

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.delete(
		"/api/arr/config/:serviceType",
		{
			schema: {
				params: serviceTypeParamsSchema,
				response: {
					[StatusCodes.OK]: successResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { serviceType } = request.params;

			const existing = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (!existing) {
				return reply
					.code(StatusCodes.NOT_FOUND)
					.send({ error: "No arr connection found for this service type" });
			}

			app.db
				.delete(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.run();

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.post(
		"/api/arr/test",
		{
			schema: {
				body: testConnectionBodySchema,
				response: {
					[StatusCodes.OK]: testConnectionResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { serviceType } = request.body;

			const connection = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (!connection) {
				return reply
					.code(StatusCodes.NOT_FOUND)
					.send({ error: "No arr connection found for this service type" });
			}

			const decryptedKey = decrypt(connection.apiKey);
			const result = await testArrConnection(connection.url, decryptedKey);

			return reply.code(StatusCodes.OK).send(result);
		},
	);

	typedApp.get(
		"/api/arr/options/:serviceType",
		{
			schema: {
				params: serviceTypeParamsSchema,
				response: {
					[StatusCodes.OK]: optionsResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { serviceType } = request.params;

			const connection = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (!connection) {
				return reply
					.code(StatusCodes.NOT_FOUND)
					.send({ error: "No arr connection found for this service type" });
			}

			const decryptedKey = decrypt(connection.apiKey);
			const [rootFolders, qualityProfiles] = await Promise.all([
				getRootFolders(connection.url, decryptedKey),
				getQualityProfiles(connection.url, decryptedKey),
			]);

			return reply.code(StatusCodes.OK).send({ rootFolders, qualityProfiles });
		},
	);

	typedApp.post(
		"/api/arr/lookup",
		{
			schema: {
				body: lookupBodySchema,
				response: {
					[StatusCodes.OK]: z.array(lookupResultSchema),
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { serviceType, title, year } = request.body;

			const connection = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (!connection) {
				return reply
					.code(StatusCodes.NOT_FOUND)
					.send({ error: "No arr connection found for this service type" });
			}

			const decryptedKey = decrypt(connection.apiKey);
			const lookupOptions =
				year !== undefined
					? { url: connection.url, apiKey: decryptedKey, serviceType, title, year }
					: { url: connection.url, apiKey: decryptedKey, serviceType, title };
			const results = await lookupMedia(lookupOptions);

			return reply.code(StatusCodes.OK).send(results);
		},
	);

	typedApp.post(
		"/api/arr/add",
		{
			schema: {
				body: addBodySchema,
				response: {
					[StatusCodes.OK]: addResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const {
				serviceType,
				recommendationId,
				tmdbId,
				tvdbId,
				title,
				year,
				qualityProfileId,
				rootFolderPath,
			} = request.body;

			const connection = app.db
				.select()
				.from(arrConnections)
				.where(
					and(
						eq(arrConnections.userId, request.user.id),
						eq(arrConnections.serviceType, serviceType),
					),
				)
				.get();

			if (!connection) {
				return reply
					.code(StatusCodes.NOT_FOUND)
					.send({ error: "No arr connection found for this service type" });
			}

			const decryptedKey = decrypt(connection.apiKey);
			const params = { title, year, qualityProfileId, rootFolderPath };
			if (tmdbId !== undefined) {
				Object.assign(params, { tmdbId });
			}
			if (tvdbId !== undefined) {
				Object.assign(params, { tvdbId });
			}
			const result = await addMedia({
				url: connection.url,
				apiKey: decryptedKey,
				serviceType,
				params,
			});

			if (result.success) {
				const updateValues: { addedToArr: boolean; tmdbId?: number } = { addedToArr: true };
				if (tmdbId !== undefined) {
					updateValues.tmdbId = tmdbId;
				}
				app.db
					.update(recommendations)
					.set(updateValues)
					.where(eq(recommendations.id, recommendationId))
					.run();
			}

			return reply.code(StatusCodes.OK).send({ success: result.success, error: result.error });
		},
	);
};

export { arrRoutes };
