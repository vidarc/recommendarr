import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { aiConfigs } from "../schema.ts";
import { testConnection } from "../services/ai-client.ts";
import { decrypt, encrypt } from "../services/encryption.ts";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const MASK_VISIBLE_CHARS = 4;
const MIN_STRING_LENGTH = 1;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_TOKENS = 1;
const PREFIX_START = 0;
const SEPARATOR_OFFSET = 1;

const errorResponseSchema = z.object({
	error: z.string(),
});

const successResponseSchema = z.object({
	success: z.boolean(),
});

const aiConfigResponseSchema = z.object({
	endpointUrl: z.string(),
	apiKey: z.string(),
	modelName: z.string(),
	temperature: z.number(),
	maxTokens: z.number(),
});

const aiConfigBodySchema = z.object({
	endpointUrl: z.string().url(),
	apiKey: z.string().min(MIN_STRING_LENGTH),
	modelName: z.string().min(MIN_STRING_LENGTH),
	temperature: z.number().min(MIN_TEMPERATURE).max(MAX_TEMPERATURE),
	maxTokens: z.number().int().min(MIN_TOKENS),
});

const testConnectionResponseSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

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

			return reply.code(StatusCodes.OK).send({ success: true });
		},
	);

	typedApp.post(
		"/api/ai/test",
		{
			schema: {
				response: {
					[StatusCodes.OK]: testConnectionResponseSchema,
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
			const result = await testConnection({
				endpointUrl: config.endpointUrl,
				apiKey: decryptedKey,
				modelName: config.modelName,
				temperature: config.temperature,
				maxTokens: config.maxTokens,
			});

			return reply.code(StatusCodes.OK).send(result);
		},
	);
};

export { aiRoutes };
