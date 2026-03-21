import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import { users } from "../schema.ts";
import { getSession } from "../services/session.ts";

import type { FastifyInstance } from "fastify";

const publicRoutes = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/setup-status"]);

const apiPrefix = "/api/";

const authMiddleware = (app: FastifyInstance) => {
	app.addHook("preHandler", async (request, reply) => {
		if (!request.url.startsWith(apiPrefix)) {
			return;
		}

		if (publicRoutes.has(request.url)) {
			return;
		}

		const sessionId = request.cookies["session"];

		if (!sessionId) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
		}

		const session = getSession(app.db, sessionId);

		if (!session) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Invalid or expired session" });
		}

		const user = app.db.select().from(users).where(eq(users.id, session.userId)).get();

		if (!user) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "User not found" });
		}

		request.user = {
			id: user.id,
			username: user.username,
			isAdmin: user.isAdmin,
		};
	});
};

export { authMiddleware };
