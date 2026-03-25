import OpenAI from "openai";

import type { FastifyRequest } from "fastify";

interface AiConfig {
	endpointUrl: string;
	apiKey: string;
	modelName: string;
	temperature: number;
	maxTokens: number;
}

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface TestConnectionResult {
	success: boolean;
}

const FIRST_CHOICE = 0;

const chatCompletion = async (config: AiConfig, messages: ChatMessage[]): Promise<string> => {
	const client = new OpenAI({
		apiKey: config.apiKey,
		baseURL: `${config.endpointUrl}/v1`,
		maxRetries: 0,
	});

	const response = await client.chat.completions.create({
		model: config.modelName,
		messages,
		temperature: config.temperature,
		max_tokens: config.maxTokens,
	});

	const content = response.choices[FIRST_CHOICE]?.message.content;

	if (!content) {
		throw new Error("AI API returned no content in response");
	}

	return content;
};

const testConnection = async (
	request: FastifyRequest,
	config: AiConfig,
): Promise<TestConnectionResult> => {
	try {
		await chatCompletion(config, [{ role: "user", content: "Hello" }]);
		return { success: true };
	} catch (error) {
		request.log.error(error, "AI Test conncetion call failed");
		return { success: false };
	}
};

export { chatCompletion, testConnection };

export type { AiConfig, ChatMessage, TestConnectionResult };
