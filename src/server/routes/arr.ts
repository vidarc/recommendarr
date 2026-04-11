import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
	arrAddBodySchema,
	arrAddResponseSchema,
	arrConfigBodySchema,
	arrConnectionResponseSchema,
	arrLookupBodySchema,
	arrLookupResultSchema,
	arrOptionsResponseSchema,
	arrServiceTypeParamsSchema,
	arrServiceTypeSchema,
	arrTestConnectionBodySchema,
	arrTestConnectionResponseSchema,
} from "../../shared/schemas/arr.ts";
import { errorResponseSchema, successResponseSchema } from "../../shared/schemas/common.ts";
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

const maskApiKey = (key: string): string => {
	if (key.length <= MASK_VISIBLE_CHARS) {
		return "****";
	}
	return `****${key.slice(-MASK_VISIBLE_CHARS)}`;
};

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
					serviceType: arrServiceTypeSchema.parse(conn.serviceType),
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
				params: arrServiceTypeParamsSchema,
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
				params: arrServiceTypeParamsSchema,
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
				body: arrTestConnectionBodySchema,
				response: {
					[StatusCodes.OK]: arrTestConnectionResponseSchema,
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
				params: arrServiceTypeParamsSchema,
				response: {
					[StatusCodes.OK]: arrOptionsResponseSchema,
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
				body: arrLookupBodySchema,
				response: {
					[StatusCodes.OK]: z.array(arrLookupResultSchema),
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
				body: arrAddBodySchema,
				response: {
					[StatusCodes.OK]: arrAddResponseSchema,
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
