import { useCallback, useState } from "react";

import { useSendChatMessageMutation } from "../api.ts";

import type { ChatMessageResponse } from "../api.ts";
import type { MediaType } from "../components/ChatControls.tsx";

const DEFAULT_RESULT_COUNT = 10;

export const useChat = () => {
	const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
	const [conversationId, setConversationId] = useState<string | undefined>(undefined);
	const [mediaType, handleMediaTypeChange] = useState<MediaType>("any");
	const [libraryId, handleLibraryIdChange] = useState("");
	const [resultCount, handleResultCountChange] = useState(DEFAULT_RESULT_COUNT);
	const [sendChatMessage, { isLoading }] = useSendChatMessageMutation();

	const handleNewConversation = useCallback(() => {
		setMessages([]);
		setConversationId(undefined);
	}, []);

	const handleSend = useCallback(
		async (message: string) => {
			const userMessage: ChatMessageResponse = {
				id: `temp-${Date.now().toString()}`,
				content: message,
				role: "user",
				createdAt: new Date().toISOString(),
				recommendations: [],
			};
			setMessages((prev) => [...prev, userMessage]);

			const result = await sendChatMessage({
				message,
				mediaType,
				resultCount,
				conversationId,
				libraryIds: libraryId ? [libraryId] : undefined,
			});

			if ("data" in result && result.data) {
				setConversationId(result.data.conversationId);
				setMessages((prev) => [...prev, result.data.message]);
			}
		},
		[sendChatMessage, mediaType, resultCount, conversationId, libraryId],
	);

	return {
		messages,
		isLoading,
		mediaType,
		handleMediaTypeChange,
		libraryId,
		handleLibraryIdChange,
		resultCount,
		handleResultCountChange,
		handleNewConversation,
		handleSend,
	};
};
