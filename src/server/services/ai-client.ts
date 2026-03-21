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

interface ChatCompletionResponse {
	id: string;
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
	}>;
}

interface TestConnectionResult {
	success: boolean;
	error?: string;
}

const FIRST_CHOICE = 0;

const chatCompletion = async (config: AiConfig, messages: ChatMessage[]): Promise<string> => {
	const url = `${config.endpointUrl}/v1/chat/completions`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			model: config.modelName,
			messages,
			temperature: config.temperature,
			max_tokens: config.maxTokens,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`AI API request failed (${String(response.status)}): ${text}`);
	}

	const data = (await response.json()) as ChatCompletionResponse;
	const content = data.choices[FIRST_CHOICE]?.message.content;

	if (!content) {
		throw new Error("AI API returned no content in response");
	}

	return content;
};

const testConnection = async (config: AiConfig): Promise<TestConnectionResult> => {
	try {
		await chatCompletion(config, [{ role: "user", content: "Hello" }]);
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: message };
	}
};

export { chatCompletion, testConnection };

export type { AiConfig, ChatMessage, TestConnectionResult };
