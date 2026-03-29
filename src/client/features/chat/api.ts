import { api } from "../../api.ts";

import type { ChatMessageResponse } from "../../shared/types.ts";

interface SendChatMessageBody {
	message: string;
	mediaType: string;
	resultCount: number;
	conversationId?: string | undefined;
	libraryIds?: string[] | undefined;
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
	}),
});

const {
	useSendChatMessageMutation,
	useGetConversationsQuery,
	useGetConversationQuery,
	useDeleteConversationMutation,
} = chatApi;

export {
	useDeleteConversationMutation,
	useGetConversationQuery,
	useGetConversationsQuery,
	useSendChatMessageMutation,
};
export type { ConversationSummary };
