import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { useDeleteConversationMutation, useGetConversationsQuery } from "../features/chat/api.ts";

import type { ConversationSummary } from "../features/chat/api.ts";
import type { MouseEvent } from "react";

const EMPTY_CONVERSATIONS: ConversationSummary[] = [];

export const useConversations = () => {
	const { data } = useGetConversationsQuery();
	const [deleteConversation] = useDeleteConversationMutation();
	const [, setLocation] = useLocation();
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | undefined>(undefined);

	const conversations = useMemo(
		() => data?.conversations ?? EMPTY_CONVERSATIONS,
		[data?.conversations],
	);

	const navigate = useCallback(
		(id: string) => {
			setLocation(`/?conversation=${id}`);
		},
		[setLocation],
	);

	const requestDelete = useCallback((event: MouseEvent, id: string) => {
		event.stopPropagation();
		setConfirmingDeleteId(id);
	}, []);

	const confirmDelete = useCallback(
		(event: MouseEvent, id: string) => {
			event.stopPropagation();
			void deleteConversation(id);
			setConfirmingDeleteId(undefined);
		},
		[deleteConversation],
	);

	const cancelDelete = useCallback((event: MouseEvent) => {
		event.stopPropagation();
		setConfirmingDeleteId(undefined);
	}, []);

	return {
		conversations,
		confirmingDeleteId,
		navigate,
		requestDelete,
		confirmDelete,
		cancelDelete,
	};
};
