import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";

import { useGetConversationQuery, useSendChatMessageMutation } from "../features/chat/api.ts";
import { useGetLibraryStatusQuery } from "../features/library/api.ts";

import type { MediaType } from "../components/ChatControls.tsx";
import type { ChatMessage } from "@shared/schemas/chat";

const DEFAULT_RESULT_COUNT = 10;

const parseConversationId = (search: string): string | undefined => {
	const params = new URLSearchParams(search);
	return params.get("conversation") ?? undefined;
};

export const useChat = () => {
	const search = useSearch();
	const [, setLocation] = useLocation();
	const urlConversationId = parseConversationId(search);

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [conversationId, setConversationId] = useState(urlConversationId);
	// Tracks the conversation id whose messages are currently authoritative in
	// Local state; prevents the hydration effect from clobbering fresh local
	// State after handleSend pushes a new URL it just produced itself.
	const hydratedIdRef = useRef<string | undefined>(undefined);
	const [mediaType, setMediaType] = useState<MediaType>("any");
	const [libraryId, setLibraryId] = useState("");
	const [resultCount, setResultCount] = useState(DEFAULT_RESULT_COUNT);
	const [excludeLibrary, setExcludeLibrary] = useState<boolean | undefined>(undefined);
	const [sendChatMessage, { isLoading }] = useSendChatMessageMutation();
	const { data: libraryStatus } = useGetLibraryStatusQuery();
	const { data: conversationData } = useGetConversationQuery(urlConversationId ?? "", {
		skip: !urlConversationId,
	});
	const resolvedExclude = excludeLibrary ?? libraryStatus?.excludeDefault ?? true;

	// When the URL points to a different conversation than local state, clear
	// Messages so the stale thread isn't shown while the new one loads.
	useEffect(() => {
		if (urlConversationId !== undefined && urlConversationId !== conversationId) {
			setMessages([]);
			setConversationId(urlConversationId);
			hydratedIdRef.current = undefined;
		}
	}, [urlConversationId, conversationId]);

	// Hydrate messages from the fetched conversation once — only if we haven't
	// Already populated local state for this id (e.g. via handleSend's URL push).
	useEffect(() => {
		if (
			conversationData &&
			conversationData.id === urlConversationId &&
			hydratedIdRef.current !== conversationData.id
		) {
			setMessages(conversationData.messages);
			hydratedIdRef.current = conversationData.id;
		}
	}, [conversationData, urlConversationId]);

	const handleNewConversation = useCallback(() => {
		setMessages([]);
		setConversationId(undefined);
		hydratedIdRef.current = undefined;
		setLocation("/");
	}, [setLocation]);

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
				const newConversationId = result.data.conversationId;
				setConversationId(newConversationId);
				setMessages((prev) => [
					...prev.filter((msg) => !msg.id.startsWith("temp-")),
					result.data.message,
				]);
				hydratedIdRef.current = newConversationId;
				if (urlConversationId !== newConversationId) {
					setLocation(`/?conversation=${newConversationId}`);
				}
			}
		},
		[
			sendChatMessage,
			mediaType,
			resultCount,
			conversationId,
			libraryId,
			resolvedExclude,
			urlConversationId,
			setLocation,
		],
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
						rec.id === recommendationId ? { ...rec, feedback: feedback ?? undefined } : rec,
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
		conversationTitle: conversationData?.title,
		mediaType,
		handleMediaTypeChange: setMediaType,
		libraryId,
		handleLibraryIdChange: setLibraryId,
		resultCount,
		handleResultCountChange: setResultCount,
		excludeLibrary: resolvedExclude,
		handleExcludeLibraryChange,
		handleNewConversation,
		handleSend,
		handleRecommendationFeedback,
	};
};
