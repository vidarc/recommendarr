import { randomUUID } from "node:crypto";

import cookie from "@fastify/cookie";
import { fastify } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { dbPlugin } from "./db.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { apiRoutes } from "./routes/api.ts";
import { authRoutes } from "./routes/auth.ts";
import { healthRoutes } from "./routes/health.ts";
import { getKey } from "./services/encryption.ts";
import { ssrRoutes } from "./ssr.ts";

interface BuildServerOptions {
	skipSSR?: boolean;
	skipDB?: boolean;
}

const buildServer = async (options: BuildServerOptions = {}) => {
	getKey(); // Validates ENCRYPTION_KEY is set and correctly formatted

	const app = fastify({
		logger: process.env["NODE_ENV"] !== "test",
		genReqId: () => randomUUID(),
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	healthRoutes(app);

	await app.register(cookie);

	if (!options.skipDB) {
		await dbPlugin(app);
		authMiddleware(app);
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
