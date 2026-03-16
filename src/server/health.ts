import { uptime } from "node:process";

import type { FastifyInstance } from "fastify";

const healthRoutes = (app: FastifyInstance) => {
	app.get("/ping", async () => ({ ping: "pong" }));

	app.get("/health", async () => ({
		status: "ok",
		uptime: uptime(),
	}));
};

export { healthRoutes };
