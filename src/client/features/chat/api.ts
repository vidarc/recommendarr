import { api } from "../../api.ts";

import type {
	ChatRequest,
	ChatResponse,
	ConversationDetail,
	ConversationsResponse,
	FeedbackBody,
	FeedbackResponse,
	RecommendationFeedback,
} from "@shared/schemas/chat";
import type { SuccessResponse } from "@shared/schemas/common";

interface UpdateFeedbackArgs {
	recommendationId: string;
	conversationId: string;
	feedback: RecommendationFeedback | null;
}

const chatApi = api.injectEndpoints({
	endpoints: (builder) => ({
		sendChatMessage: builder.mutation<ChatResponse, ChatRequest>({
			query: (body) => ({
				url: "api/chat",
				method: "POST",
				body,
			}),
			invalidatesTags: (_result, _error, arg) => [
				{ type: "Conversations", id: "LIST" },
				...(arg.conversationId ? [{ type: "Conversations" as const, id: arg.conversationId }] : []),
			],
		}),
		getConversations: builder.query<ConversationsResponse, void>({
			query: () => "api/conversations",
			providesTags: [{ type: "Conversations", id: "LIST" }],
		}),
		getConversation: builder.query<ConversationDetail, string>({
			query: (id) => `api/conversations/${id}`,
			providesTags: (_result, _error, id) => [{ type: "Conversations", id }],
		}),
		deleteConversation: builder.mutation<SuccessResponse, string>({
			query: (id) => ({
				url: `api/conversations/${id}`,
				method: "DELETE",
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "Conversations", id: "LIST" },
				{ type: "Conversations", id },
			],
		}),
		updateFeedback: builder.mutation<FeedbackResponse, UpdateFeedbackArgs>({
			query: ({ recommendationId, feedback }) => {
				const body: FeedbackBody = { feedback };
				return {
					url: `api/recommendations/${recommendationId}/feedback`,
					method: "PATCH",
					body,
				};
			},
			onQueryStarted: async (
				{ recommendationId, conversationId, feedback },
				{ dispatch, queryFulfilled },
			) => {
				const patchResult = dispatch(
					chatApi.util.updateQueryData("getConversation", conversationId, (draft) => {
						for (const msg of draft.messages) {
							for (const rec of msg.recommendations) {
								if (rec.id === recommendationId) {
									rec.feedback = feedback;
								}
							}
						}
					}),
				);
				try {
					await queryFulfilled;
				} catch {
					patchResult.undo();
				}
			},
		}),
	}),
});

const {
	useSendChatMessageMutation,
	useGetConversationsQuery,
	useGetConversationQuery,
	useDeleteConversationMutation,
	useUpdateFeedbackMutation,
} = chatApi;

export {
	useDeleteConversationMutation,
	useGetConversationQuery,
	useGetConversationsQuery,
	useSendChatMessageMutation,
	useUpdateFeedbackMutation,
};
