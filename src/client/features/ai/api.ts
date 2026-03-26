import { api } from "../../api.ts";

interface AiConfig {
	endpointUrl: string;
	apiKey: string;
	modelName: string;
	temperature: number;
	maxTokens: number;
}

interface AiTestResult {
	success: boolean;
	error?: string;
}

const aiApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getAiConfig: builder.query<AiConfig, void>({
			query: () => "api/ai/config",
			providesTags: ["AiConfig"],
		}),
		updateAiConfig: builder.mutation<{ success: boolean }, AiConfig>({
			query: (body) => ({
				url: "api/ai/config",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["AiConfig"],
		}),
		deleteAiConfig: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/ai/config",
				method: "DELETE",
			}),
			invalidatesTags: ["AiConfig"],
		}),
		testAiConnection: builder.mutation<AiTestResult, AiConfig | void>({
			query: (body) => ({
				url: "api/ai/test",
				method: "POST",
				body: body ?? undefined,
			}),
		}),
	}),
});

const {
	useGetAiConfigQuery,
	useUpdateAiConfigMutation,
	useDeleteAiConfigMutation,
	useTestAiConnectionMutation,
} = aiApi;

export {
	useDeleteAiConfigMutation,
	useGetAiConfigQuery,
	useTestAiConnectionMutation,
	useUpdateAiConfigMutation,
};
export type { AiConfig };
