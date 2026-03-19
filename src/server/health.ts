import { StatusCodes } from "http-status-codes";
import { uptime } from "node:process";
import { z } from "zod";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const pingResponseSchema = z.object({
	ping: z.literal("pong"),
});

const healthResponseSchema = z.object({
	status: z.literal("ok"),
	uptime: z.number(),
});

const healthRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/ping",
		{ schema: { response: { [StatusCodes.OK]: pingResponseSchema } } },
		async (_request, reply) => reply.code(StatusCodes.OK).send({ ping: "pong" as const }),
	);

	typedApp.get(
		"/health",
		{ schema: { response: { [StatusCodes.OK]: healthResponseSchema } } },
		async (_request, reply) =>
			reply.code(StatusCodes.OK).send({
				status: "ok" as const,
				uptime: uptime(),
			}),
	);
};

export { healthResponseSchema, healthRoutes, pingResponseSchema };
