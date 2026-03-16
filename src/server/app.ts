import { fastify } from "fastify";

import { healthRoutes } from "./health.ts";

const buildServer = async () => {
  const app = fastify({ logger: process.env["NODE_ENV"] !== "test" });

  healthRoutes(app);

  await app.ready();

  return app;
};

export { buildServer };
