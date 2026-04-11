import { useCallback, useState } from "react";

import { useSendChatMessageMutation } from "../features/chat/api.ts";
import { useGetLibraryStatusQuery } from "../features/library/api.ts";

import type { MediaType } from "../components/ChatControls.tsx";
import type { ChatMessage } from "@shared/schemas/chat";

const DEFAULT_RESULT_COUNT = 10;

export const useChat = () => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [conversationId, setConversationId] = useState<string | undefined>(undefined);
	const [mediaType, handleMediaTypeChange] = useState<MediaType>("any");
	const [libraryId, handleLibraryIdChange] = useState("");
	const [resultCount, handleResultCountChange] = useState(DEFAULT_RESULT_COUNT);
	const [excludeLibrary, setExcludeLibrary] = useState<boolean | undefined>(undefined);
	const [sendChatMessage, { isLoading }] = useSendChatMessageMutation();
	const { data: libraryStatus } = useGetLibraryStatusQuery();
	const resolvedExclude = excludeLibrary ?? libraryStatus?.excludeDefault ?? true;

	const handleNewConversation = useCallback(() => {
		setMessages([]);
		setConversationId(undefined);
	}, []);

	const handleSend = useCallback(
		async (message: string) => {
			const userMessage: ChatMessage = {
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
				excludeLibrary: resolvedExclude,
			});

			if ("data" in result && result.data) {
				setConversationId(result.data.conversationId);
				setMessages((prev) => [
					...prev.filter((msg) => !msg.id.startsWith("temp-")),
					result.data.message,
				]);
			}
		},
		[sendChatMessage, mediaType, resultCount, conversationId, libraryId, resolvedExclude],
	);

	const handleExcludeLibraryChange = useCallback((value: boolean) => {
		setExcludeLibrary(value);
	}, []);

	const handleRecommendationFeedback = useCallback(
		(recommendationId: string, feedback: "liked" | "disliked" | null) => {
			setMessages((prev) =>
				prev.map((msg) => ({
					...msg,
					recommendations: msg.recommendations.map((rec) =>
						rec.id === recommendationId ? { ...rec, feedback } : rec,
					),
				})),
			);
		},
		[],
	);

	return {
		messages,
		isLoading,
		conversationId,
		mediaType,
		handleMediaTypeChange,
		libraryId,
		handleLibraryIdChange,
		resultCount,
		handleResultCountChange,
		excludeLibrary: resolvedExclude,
		handleExcludeLibraryChange,
		handleNewConversation,
		handleSend,
		handleRecommendationFeedback,
	};
};
