import { fastify } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { apiRoutes } from "./api.ts";
import { authRoutes } from "./auth.ts";
import { dbPlugin } from "./db.ts";
import { healthRoutes } from "./health.ts";
import { ssrRoutes } from "./ssr.ts";

interface BuildServerOptions {
	skipSSR?: boolean;
	skipDB?: boolean;
}

const buildServer = async (options: BuildServerOptions = {}) => {
	const app = fastify({
		logger: process.env["NODE_ENV"] !== "test",
		genReqId: () => randomUUID(),
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	healthRoutes(app);

	if (!options.skipDB) {
		dbPlugin(app);
		authRoutes(app);
		apiRoutes(app);
	}

	if (!options.skipSSR) {
		await ssrRoutes(app);
	}

	await app.ready();

	return app;
};

export { buildServer };
