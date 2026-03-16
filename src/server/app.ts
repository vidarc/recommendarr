import { fastify } from "fastify";

import { healthRoutes } from "./health.ts";
import { ssrRoutes } from "./ssr.ts";

interface BuildServerOptions {
	skipSSR?: boolean;
}

const buildServer = async (options: BuildServerOptions = {}) => {
	const app = fastify({ logger: process.env["NODE_ENV"] !== "test" });

	healthRoutes(app);

	if (!options.skipSSR) {
		await ssrRoutes(app);
	}

	await app.ready();

	return app;
};

export { buildServer };
