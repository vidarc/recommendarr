import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth-utils.ts";
import { users } from "./schema.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const minUsernameLength = 1;
const minPasswordLength = 8;
const noUsers = 0;

const credentialsSchema = z.object({
	username: z.string().min(minUsernameLength),
	password: z.string().min(minPasswordLength),
});

const userResponseSchema = z.object({
	id: z.string(),
	username: z.string(),
	isAdmin: z.boolean(),
});

const errorResponseSchema = z.object({
	error: z.string(),
});

const setupStatusSchema = z.object({
	needsSetup: z.boolean(),
});

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
					[StatusCodes.CONFLICT]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { username, password } = request.body;

			const existing = app.db.select().from(users).where(eq(users.username, username)).get();
			if (existing) {
				return reply.code(StatusCodes.CONFLICT).send({ error: "Username already taken" });
			}

			const allUsers = app.db.select().from(users).all();
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
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Invalid username or password" });
			}

			return reply.code(StatusCodes.OK).send({
				id: user.id,
				username: user.username,
				isAdmin: user.isAdmin,
			});
		},
	);
};

export { authRoutes };
