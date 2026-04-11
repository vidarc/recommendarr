import { api } from "../../api.ts";

import type { AiConfigBody, AiConfigResponse, AiTestResult } from "@shared/schemas/ai";
import type { SuccessResponse } from "@shared/schemas/common";

const aiApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getAiConfig: builder.query<AiConfigResponse, void>({
			query: () => "api/ai/config",
			providesTags: ["AiConfig"],
		}),
		updateAiConfig: builder.mutation<SuccessResponse, AiConfigBody>({
			query: (body) => ({
				url: "api/ai/config",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["AiConfig"],
		}),
		deleteAiConfig: builder.mutation<SuccessResponse, void>({
			query: () => ({
				url: "api/ai/config",
				method: "DELETE",
			}),
			invalidatesTags: ["AiConfig"],
		}),
		testAiConnection: builder.mutation<AiTestResult, AiConfigBody | void>({
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
