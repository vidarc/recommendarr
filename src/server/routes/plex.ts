import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import { errorResponseSchema, successResponseSchema } from "../../shared/schemas/common.ts";
import {
	plexAuthCheckQuerySchema,
	plexAuthCheckResponseSchema,
	plexAuthStartResponseSchema,
	plexLibrariesResponseSchema,
	plexManualAuthBodySchema,
	plexSelectServerBodySchema,
	plexServersResponseSchema,
} from "../../shared/schemas/plex.ts";
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

const DEFAULT_PLEX_PORT = 32_400;

const plexRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/api/plex/auth/start",
		{
			schema: {
				response: {
					[StatusCodes.OK]: plexAuthStartResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const pin = await createPlexPin();
			request.log.info({ pinId: pin.id }, "plex OAuth flow started");
			return reply.code(StatusCodes.OK).send({ pinId: pin.id, authUrl: pin.authUrl });
		},
	);

	typedApp.get(
		"/api/plex/auth/check",
		{
			schema: {
				querystring: plexAuthCheckQuerySchema,
				response: {
					[StatusCodes.OK]: plexAuthCheckResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { pinId } = request.query;
			request.log.debug({ pinId }, "checking plex pin status");
			const result = await checkPlexPin(pinId);

			if (!result.authToken) {
				request.log.debug({ pinId }, "plex pin not yet claimed");
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

			request.log.info("plex OAuth token claimed and stored");
			return reply.code(StatusCodes.OK).send({ claimed: true });
		},
	);

	typedApp.post(
		"/api/plex/auth/manual",
		{
			schema: {
				body: plexManualAuthBodySchema,
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

			request.log.info({ serverName }, "plex manual connection saved");
			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.get(
		"/api/plex/servers",
		{
			schema: {
				response: {
					[StatusCodes.OK]: plexServersResponseSchema,
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
				const parsed = new URL(connection.serverUrl);
				return reply.code(StatusCodes.OK).send({
					servers: [
						{
							name: connection.serverName,
							address: connection.serverUrl,
							port: Number(parsed.port) || DEFAULT_PLEX_PORT,
							scheme: parsed.protocol.replace(":", ""),
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
				body: plexSelectServerBodySchema,
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

			request.log.info({ serverName, serverUrl }, "plex server selected");
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

			request.log.info("plex connection removed");
			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.get(
		"/api/plex/libraries",
		{
			schema: {
				response: {
					[StatusCodes.OK]: plexLibrariesResponseSchema,
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
			request.log.debug({ serverUrl: connection.serverUrl }, "fetching plex libraries");
			const libraries = await getPlexLibraries(connection.serverUrl, authToken);

			request.log.debug({ count: libraries.length }, "plex libraries fetched");
			return reply.code(StatusCodes.OK).send({ libraries });
		},
	);
};

export { plexRoutes };
