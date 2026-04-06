import { api } from "../../api.ts";

import type { ChatMessageResponse } from "../../shared/types.ts";

interface SendChatMessageBody {
	message: string;
	mediaType: string;
	resultCount: number;
	conversationId?: string | undefined;
	libraryIds?: string[] | undefined;
	excludeLibrary?: boolean | undefined;
}

interface SendChatMessageResponse {
	conversationId: string;
	message: ChatMessageResponse;
}

interface ConversationSummary {
	id: string;
	title: string;
	mediaType: string;
	createdAt: string;
}

interface ConversationsResponse {
	conversations: ConversationSummary[];
}

interface ConversationDetail {
	conversation: {
		id: string;
		title: string;
		mediaType: string;
		createdAt: string;
		messages: ChatMessageResponse[];
	};
}

interface DeleteConversationResponse {
	success: boolean;
}

const chatApi = api.injectEndpoints({
	endpoints: (builder) => ({
		sendChatMessage: builder.mutation<SendChatMessageResponse, SendChatMessageBody>({
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
		deleteConversation: builder.mutation<DeleteConversationResponse, string>({
			query: (id) => ({
				url: `api/conversations/${id}`,
				method: "DELETE",
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "Conversations", id: "LIST" },
				{ type: "Conversations", id },
			],
		}),
		updateFeedback: builder.mutation<
			{ id: string; feedback: "liked" | "disliked" | null },
			{ recommendationId: string; conversationId: string; feedback: "liked" | "disliked" | null }
		>({
			query: ({ recommendationId, feedback }) => ({
				url: `api/recommendations/${recommendationId}/feedback`,
				method: "PATCH",
				body: { feedback },
			}),
			onQueryStarted: async (
				{ recommendationId, conversationId, feedback },
				{ dispatch, queryFulfilled },
			) => {
				const patchResult = dispatch(
					chatApi.util.updateQueryData("getConversation", conversationId, (draft) => {
						for (const msg of draft.conversation.messages) {
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
export type { ConversationSummary };
