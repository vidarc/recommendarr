import { z } from "zod";

const MIN_STRING_LENGTH = 1;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_TOKENS = 1;

const aiConfigBodySchema = z.object({
	endpointUrl: z.string().url(),
	apiKey: z.string().min(MIN_STRING_LENGTH),
	modelName: z.string().min(MIN_STRING_LENGTH),
	temperature: z.number().min(MIN_TEMPERATURE).max(MAX_TEMPERATURE),
	maxTokens: z.number().int().min(MIN_TOKENS),
});

const aiConfigResponseSchema = z.object({
	endpointUrl: z.string(),
	apiKey: z.string(),
	modelName: z.string(),
	temperature: z.number(),
	maxTokens: z.number(),
});

const aiTestResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

type AiConfigBody = z.infer<typeof aiConfigBodySchema>;
type AiConfigResponse = z.infer<typeof aiConfigResponseSchema>;
type AiTestResult = z.infer<typeof aiTestResultSchema>;

export { aiConfigBodySchema, aiConfigResponseSchema, aiTestResultSchema };
export type { AiConfigBody, AiConfigResponse, AiTestResult };
