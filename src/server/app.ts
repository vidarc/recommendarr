import { fastify } from "fastify";

const buildServer = async () => {
	const app = fastify({ logger: true });

	app.get("/ping", async () => ({ status: "ok" }));

	await app.ready();

	return app;
};

export { buildServer };
