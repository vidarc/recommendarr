import { randomUUID } from "node:crypto";

import { fastifyCookie } from "@fastify/cookie";
import { fastifyHelmet } from "@fastify/helmet";
import { fastifySensible } from "@fastify/sensible";
import { fastify } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { dbPlugin } from "./db.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { aiRoutes } from "./routes/ai.ts";
import { apiRoutes } from "./routes/api.ts";
import { arrRoutes } from "./routes/arr.ts";
import { authRoutes } from "./routes/auth.ts";
import { chatRoutes } from "./routes/chat.ts";
import { feedbackRoutes } from "./routes/feedback.ts";
import { healthRoutes } from "./routes/health.ts";
import { libraryRoutes } from "./routes/library.ts";
import { metadataRoutes } from "./routes/metadata.ts";
import { plexRoutes } from "./routes/plex.ts";
import { getKey } from "./services/encryption.ts";
import { ssrRoutes } from "./ssr.ts";

import type { LoggerOptions } from "pino";

interface BuildServerOptions {
	skipSSR?: boolean;
	skipDB?: boolean;
}

const buildLoggerConfig = (): false | LoggerOptions => {
	if (process.env["NODE_ENV"] === "test") {
		return false;
	}

	const level = process.env["LOG_LEVEL"] ?? "info";
	const pretty = process.env["LOG_PRETTY"] === "true";

	if (pretty) {
		return {
			level,
			transport: {
				target: "pino-pretty",
				options: {
					translateTime: "HH:MM:ss Z",
				},
			},
		};
	}

	return {
		level,
	};
};

const buildServer = async (options: BuildServerOptions = {}) => {
	getKey(); // Validates ENCRYPTION_KEY is set and correctly formatted

	const app = fastify({
		logger: buildLoggerConfig(),
		genReqId: () => randomUUID(),
		trustProxy: "loopback",
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	healthRoutes(app);

	await app.register(fastifyCookie);
	await app.register(fastifySensible);
	const isDev = process.env["NODE_ENV"] === "development";
	await app.register(fastifyHelmet, {
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				imgSrc: ["'self'", "data:", "https://image.tmdb.org", "https://artworks.thetvdb.com"],
				connectSrc: isDev ? ["'self'", "ws:"] : ["'self'"],
				// oxlint-disable-next-line unicorn/no-null
				upgradeInsecureRequests: null,
			},
		},
		crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
	});

	if (!options.skipDB) {
		await dbPlugin(app);
		authMiddleware(app);
		authRoutes(app);
		aiRoutes(app);
		apiRoutes(app);
		chatRoutes(app);
		plexRoutes(app);
		arrRoutes(app);
		libraryRoutes(app);
		feedbackRoutes(app);
		metadataRoutes(app);
	}

	if (!options.skipSSR) {
		await ssrRoutes(app);
	}

	await app.ready();

	return app;
};

export { buildServer };
