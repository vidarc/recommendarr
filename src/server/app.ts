import { randomUUID } from "node:crypto";

import { fastifyCookie } from "@fastify/cookie";
import { fastifyHelmet } from "@fastify/helmet";
import { fastify } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { dbPlugin } from "./db.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { aiRoutes } from "./routes/ai.ts";
import { apiRoutes } from "./routes/api.ts";
import { authRoutes } from "./routes/auth.ts";
import { chatRoutes } from "./routes/chat.ts";
import { healthRoutes } from "./routes/health.ts";
import { plexRoutes } from "./routes/plex.ts";
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
		trustProxy: "loopback",
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	healthRoutes(app);

	await app.register(fastifyCookie);
	const isDev = process.env["NODE_ENV"] === "development";
	await app.register(fastifyHelmet, {
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				imgSrc: ["'self'", "data:"],
				connectSrc: isDev ? ["'self'", "ws:"] : ["'self'"],
				// oxlint-disable-next-line unicorn/no-null
				upgradeInsecureRequests: null,
			},
		},
	});

	if (!options.skipDB) {
		await dbPlugin(app);
		authMiddleware(app);
		authRoutes(app);
		aiRoutes(app);
		apiRoutes(app);
		chatRoutes(app);
		plexRoutes(app);
	}

	if (!options.skipSSR) {
		await ssrRoutes(app);
	}

	await app.ready();

	return app;
};

export { buildServer };
