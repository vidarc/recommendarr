import { eq } from "drizzle-orm";

import { users } from "../schema.ts";
import { getSession } from "../services/session.ts";

import type { FastifyInstance } from "fastify";

const publicRoutes = new Set([
	"/api/auth/login",
	"/api/auth/logout",
	"/api/auth/register",
	"/api/auth/setup-status",
]);

const apiPrefix = "/api/";

const authMiddleware = (app: FastifyInstance) => {
	app.addHook("preHandler", async (request, reply) => {
		if (!request.url.startsWith(apiPrefix)) {
			return;
		}

		const { pathname } = new URL(request.url, "http://localhost");
		if (publicRoutes.has(pathname)) {
			return;
		}

		const sessionId = request.cookies["session"];

		if (!sessionId) {
			request.log.debug({ url: request.url }, "no session cookie, rejecting");
			reply.clearCookie("session", { path: "/" });

			throw app.httpErrors.unauthorized("Authentication required");
		}

		const session = getSession(app.db, sessionId);

		if (!session) {
			request.log.warn({ url: request.url }, "invalid or expired session");
			reply.clearCookie("session", { path: "/" });

			throw app.httpErrors.unauthorized("Invalid or expired session");
		}

		const user = app.db.select().from(users).where(eq(users.id, session.userId)).get();

		if (!user) {
			request.log.warn({ sessionUserId: session.userId }, "session references missing user");
			reply.clearCookie("session", { path: "/" });

			throw app.httpErrors.unauthorized("User not found");
		}

		request.user = {
			id: user.id,
			username: user.username,
			isAdmin: user.isAdmin,
		};
	});
};

export { authMiddleware };
