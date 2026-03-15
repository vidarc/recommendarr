import { fastify } from "fastify";

const buildServer = async () => {
	const app = fastify({ logger: true });

	await app.ready();

	return app;
};

export { buildServer };
