import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import {
	credentialsSchema,
	setupStatusSchema,
	userResponseSchema,
} from "../../shared/schemas/auth.ts";
import { errorResponseSchema, successResponseSchema } from "../../shared/schemas/common.ts";
import { users } from "../schema.ts";
import { hashPassword, verifyPassword } from "../services/auth-utils.ts";
import { createSession, deleteSession } from "../services/session.ts";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const noUsers = 0;

const setSessionCookie = (request: FastifyRequest, reply: FastifyReply, sessionId: string) => {
	reply.setCookie("session", sessionId, {
		path: "/",
		httpOnly: true,
		secure: request.protocol === "https",
		sameSite: "strict",
	});
};

const authRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/api/auth/setup-status",
		{ schema: { response: { [StatusCodes.OK]: setupStatusSchema } } },
		async (_request, reply) => {
			const allUsers = app.db.select().from(users).all();
			return reply.code(StatusCodes.OK).send({ needsSetup: allUsers.length === noUsers });
		},
	);

	typedApp.post(
		"/api/auth/register",
		{
			schema: {
				body: credentialsSchema,
				response: {
					[StatusCodes.CREATED]: userResponseSchema,
					[StatusCodes.FORBIDDEN]: errorResponseSchema,
					[StatusCodes.CONFLICT]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { username, password } = request.body;

			const allUsers = app.db.select().from(users).all();

			if (allUsers.length > noUsers) {
				request.log.warn({ username }, "registration attempted but disabled");
				return reply.code(StatusCodes.FORBIDDEN).send({ error: "Registration is disabled" });
			}

			const existing = app.db.select().from(users).where(eq(users.username, username)).get();
			if (existing) {
				request.log.warn({ username }, "registration attempted with existing username");
				return reply.code(StatusCodes.CONFLICT).send({ error: "Username already taken" });
			}

			const isAdmin = allUsers.length === noUsers;

			const id = randomUUID();
			app.db
				.insert(users)
				.values({
					id,
					username,
					passwordHash: await hashPassword(password),
					isAdmin,
					createdAt: new Date().toISOString(),
				})
				.run();

			const session = createSession(app.db, id);
			setSessionCookie(request, reply, session.id);

			request.log.info({ username, isAdmin }, "user registered");
			return reply.code(StatusCodes.CREATED).send({ id, username, isAdmin });
		},
	);

	typedApp.post(
		"/api/auth/login",
		{
			schema: {
				body: credentialsSchema,
				response: {
					[StatusCodes.OK]: userResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { username, password } = request.body;

			const user = app.db.select().from(users).where(eq(users.username, username)).get();

			if (!user || !(await verifyPassword(password, user.passwordHash))) {
				request.log.warn({ username }, "login failed");
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Invalid username or password" });
			}

			const session = createSession(app.db, user.id);
			setSessionCookie(request, reply, session.id);

			request.log.info({ username }, "user logged in");
			return reply.code(StatusCodes.OK).send({
				id: user.id,
				username: user.username,
				isAdmin: user.isAdmin,
			});
		},
	);

	typedApp.get(
		"/api/auth/me",
		{
			schema: {
				response: {
					[StatusCodes.OK]: userResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			return reply.code(StatusCodes.OK).send({
				id: request.user.id,
				username: request.user.username,
				isAdmin: request.user.isAdmin,
			});
		},
	);

	typedApp.post(
		"/api/auth/logout",
		{
			schema: {
				response: {
					[StatusCodes.OK]: successResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const sessionId = request.cookies["session"];
			if (sessionId) {
				deleteSession(app.db, sessionId);
			}

			request.log.info("user logged out");
			reply.clearCookie("session", { path: "/" });
			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);
};

export { authRoutes };
