import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import {
	aiConfigBodySchema,
	aiConfigResponseSchema,
	aiTestResultSchema,
} from "../../shared/schemas/ai.ts";
import { errorResponseSchema, successResponseSchema } from "../../shared/schemas/common.ts";
import { aiConfigs } from "../schema.ts";
import { testConnection } from "../services/ai-client.ts";
import { decrypt, encrypt } from "../services/encryption.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const MASK_VISIBLE_CHARS = 4;
const PREFIX_START = 0;
const SEPARATOR_OFFSET = 1;

const testConnectionBodySchema = aiConfigBodySchema.or(z.null()).or(z.undefined());

const maskApiKey = (key: string): string => {
	if (key.length <= MASK_VISIBLE_CHARS) {
		return "****";
	}
	const prefix = key.slice(PREFIX_START, key.indexOf("-") + SEPARATOR_OFFSET) || "";
	const suffix = key.slice(-MASK_VISIBLE_CHARS);
	return `${prefix}****${suffix}`;
};

const aiRoutes = (app: FastifyInstance) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.get(
		"/api/ai/config",
		{
			schema: {
				response: {
					[StatusCodes.OK]: aiConfigResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const config = app.db
				.select()
				.from(aiConfigs)
				.where(eq(aiConfigs.userId, request.user.id))
				.get();

			if (!config) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No AI configuration found" });
			}

			const decryptedKey = decrypt(config.apiKey);

			return reply.code(StatusCodes.OK).send({
				endpointUrl: config.endpointUrl,
				apiKey: maskApiKey(decryptedKey),
				modelName: config.modelName,
				temperature: config.temperature,
				maxTokens: config.maxTokens,
			});
		},
	);

	typedApp.put(
		"/api/ai/config",
		{
			schema: {
				body: aiConfigBodySchema,
				response: {
					[StatusCodes.OK]: successResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const { endpointUrl, apiKey, modelName, temperature, maxTokens } = request.body;
			const now = new Date().toISOString();
			const encryptedKey = encrypt(apiKey);

			const existing = app.db
				.select()
				.from(aiConfigs)
				.where(eq(aiConfigs.userId, request.user.id))
				.get();

			if (existing) {
				app.db
					.update(aiConfigs)
					.set({
						endpointUrl,
						apiKey: encryptedKey,
						modelName,
						temperature,
						maxTokens,
						updatedAt: now,
					})
					.where(eq(aiConfigs.userId, request.user.id))
					.run();
				request.log.info({ endpointUrl, modelName }, "AI config updated");
			} else {
				app.db
					.insert(aiConfigs)
					.values({
						id: randomUUID(),
						userId: request.user.id,
						endpointUrl,
						apiKey: encryptedKey,
						modelName,
						temperature,
						maxTokens,
						createdAt: now,
						updatedAt: now,
					})
					.run();
				request.log.info({ endpointUrl, modelName }, "AI config created");
			}

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.delete(
		"/api/ai/config",
		{
			schema: {
				response: {
					[StatusCodes.OK]: successResponseSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			const config = app.db
				.select()
				.from(aiConfigs)
				.where(eq(aiConfigs.userId, request.user.id))
				.get();

			if (!config) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No AI configuration found" });
			}

			app.db.delete(aiConfigs).where(eq(aiConfigs.userId, request.user.id)).run();

			request.log.info("AI config removed");
			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.post(
		"/api/ai/test",
		{
			schema: {
				body: testConnectionBodySchema,
				response: {
					[StatusCodes.OK]: aiTestResultSchema,
					[StatusCodes.NOT_FOUND]: errorResponseSchema,
					[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.user) {
				return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
			}

			if (request.body) {
				request.log.debug(
					{ endpointUrl: request.body.endpointUrl },
					"testing AI connection with provided config",
				);
				const result = await testConnection(request, {
					endpointUrl: request.body.endpointUrl,
					apiKey: request.body.apiKey,
					modelName: request.body.modelName,
					temperature: request.body.temperature,
					maxTokens: request.body.maxTokens,
				});

				request.log.info({ success: result.success }, "AI connection test completed");
				return reply.code(StatusCodes.OK).send(result);
			}

			const config = app.db
				.select()
				.from(aiConfigs)
				.where(eq(aiConfigs.userId, request.user.id))
				.get();

			if (!config) {
				return reply.code(StatusCodes.NOT_FOUND).send({ error: "No AI configuration found" });
			}

			request.log.debug(
				{ endpointUrl: config.endpointUrl },
				"testing AI connection with saved config",
			);
			const result = await testConnection(request, {
				endpointUrl: config.endpointUrl,
				apiKey: decrypt(config.apiKey),
				modelName: config.modelName,
				temperature: config.temperature,
				maxTokens: config.maxTokens,
			});

			request.log.info({ success: result.success }, "AI connection test completed");
			return reply.code(StatusCodes.OK).send(result);
		},
	);
};

export { aiRoutes };
