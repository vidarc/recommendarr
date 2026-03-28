import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { plexConnections } from "../schema.ts";
import { decrypt, encrypt } from "../services/encryption.ts";
import {
	checkPlexPin,
	createPlexPin,
	getPlexLibraries,
	getPlexServers,
} from "../services/plex-api.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const errorResponseSchema = z.object({
	error: z.string(),
});

const successResponseSchema = z.object({
	success: z.boolean(),
});

const authStartResponseSchema = z.object({
	pinId: z.number(),
	authUrl: z.string(),
});

const authCheckQuerySchema = z.object({
	pinId: z.coerce.number(),
});

const authCheckResponseSchema = z.object({
	claimed: z.boolean(),
});

const MIN_LENGTH = 1;

const manualAuthBodySchema = z.object({
	authToken: z.string().min(MIN_LENGTH),
	serverUrl: z.string().url(),
	serverName: z.string().min(MIN_LENGTH),
});

const serverSchema = z.object({
	name: z.string(),
	address: z.string(),
	port: z.number(),
	scheme: z.string(),
	uri: z.string(),
	clientIdentifier: z.string(),
	owned: z.boolean(),
});

const serversResponseSchema = z.object({
	servers: z.array(serverSchema),
});

const selectServerBodySchema = z.object({
	serverUrl: z.string(),
	serverName: z.string(),
	machineIdentifier: z.string(),
});

const librarySchema = z.object({
	key: z.string(),
	title: z.string(),
	type: z.string(),
});

const librariesResponseSchema = z.object({
	libraries: z.array(librarySchema),
});

const plexRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/api/plex/auth/start",
		{
			schema: {
				response: {
					[StatusCodes.OK]: authStartResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const pin = await createPlexPin();
			return reply.code(StatusCodes.OK).send({ pinId: pin.id, authUrl: pin.authUrl });
		},
	);

	typedApp.get(
		"/api/plex/auth/check",
		{
			schema: {
				querystring: authCheckQuerySchema,
				response: {
					[StatusCodes.OK]: authCheckResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { pinId } = request.query;
			const result = await checkPlexPin(pinId);

			if (!result.authToken) {
				return reply.code(StatusCodes.OK).send({ claimed: false });
			}

			const now = new Date().toISOString();
			const existing = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (existing) {
				app.db
					.update(plexConnections)
					.set({
						authToken: encrypt(result.authToken),
						updatedAt: now,
					})
					.where(eq(plexConnections.userId, request.user.id))
					.run();
			} else {
				app.db
					.insert(plexConnections)
					.values({
						id: randomUUID(),
						userId: request.user.id,
						authToken: encrypt(result.authToken),
						createdAt: now,
						updatedAt: now,
					})
					.run();
			}

			return reply.code(StatusCodes.OK).send({ claimed: true });
		},
	);

	typedApp.post(
		"/api/plex/auth/manual",
		{
			schema: {
				body: manualAuthBodySchema,
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

			const { authToken, serverUrl, serverName } = request.body;
			const now = new Date().toISOString();
			const encryptedToken = encrypt(authToken);

			const existing = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (existing) {
				app.db
					.update(plexConnections)
					.set({
						authToken: encryptedToken,
						serverUrl,
						serverName,
						machineIdentifier: `manual-${randomUUID()}`,
						updatedAt: now,
					})
					.where(eq(plexConnections.userId, request.user.id))
					.run();
			} else {
				app.db
					.insert(plexConnections)
					.values({
						id: randomUUID(),
						userId: request.user.id,
						authToken: encryptedToken,
						serverUrl,
						serverName,
						machineIdentifier: `manual-${randomUUID()}`,
						createdAt: now,
						updatedAt: now,
					})
					.run();
			}

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.get(
		"/api/plex/servers",
		{
			schema: {
				response: {
					[StatusCodes.OK]: serversResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const connection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (!connection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			if (connection.serverUrl && connection.serverName) {
				return reply.code(StatusCodes.OK).send({
					servers: [
						{
							name: connection.serverName,
							address: connection.serverUrl,
							port: 32_400,
							scheme: "http",
							uri: connection.serverUrl,
							clientIdentifier: connection.machineIdentifier ?? "manual",
							owned: true,
						},
					],
				});
			}

			const authToken = decrypt(connection.authToken);
			const servers = await getPlexServers(authToken);

			return reply.code(StatusCodes.OK).send({ servers });
		},
	);

	typedApp.post(
		"/api/plex/servers/select",
		{
			schema: {
				body: selectServerBodySchema,
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

			const connection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (!connection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			const { serverUrl, serverName, machineIdentifier } = request.body;

			app.db
				.update(plexConnections)
				.set({
					serverUrl,
					serverName,
					machineIdentifier,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(plexConnections.userId, request.user.id))
				.run();

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.delete(
		"/api/plex/connection",
		{
			schema: {
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

			const connection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (!connection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			app.db.delete(plexConnections).where(eq(plexConnections.userId, request.user.id)).run();

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.get(
		"/api/plex/libraries",
		{
			schema: {
				response: {
					[StatusCodes.OK]: librariesResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.BAD_REQUEST]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const connection = app.db
				.select()
				.from(plexConnections)
				.where(eq(plexConnections.userId, request.user.id))
				.get();

			if (!connection) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No Plex connection found" });
			}

			if (!connection.serverUrl) {
				return reply.code(StatusCodes.BAD_REQUEST).send({ error: "No Plex server selected" });
			}

			const authToken = decrypt(connection.authToken);
			const libraries = await getPlexLibraries(connection.serverUrl, authToken);

			return reply.code(StatusCodes.OK).send({ libraries });
		},
	);
};

export { plexRoutes };
