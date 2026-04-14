import { StatusCodes } from "http-status-codes";
import * as z from "zod/mini";

import { settings } from "../schema.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const settingsResponseSchema = z.record(z.string(), z.string());

const apiRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/api/settings",
		{ schema: { response: { [StatusCodes.OK]: settingsResponseSchema } } },
		async (_request, reply) => {
			const rows = app.db.select().from(settings).all();

			const result: Record<string, string> = {};
			for (const row of rows) {
				if (row.value !== null) {
					result[row.key] = row.value;
				}
			}

			return reply.code(StatusCodes.OK).send(result);
		},
	);
};

export { apiRoutes, settingsResponseSchema };
