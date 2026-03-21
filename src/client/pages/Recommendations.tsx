import { css } from "@linaria/atomic";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSendChatMessageMutation } from "../api.ts";
import { ChatControls } from "../components/ChatControls.tsx";
import { ChatInput } from "../components/ChatInput.tsx";
import { ChatMessage } from "../components/ChatMessage.tsx";
import { RecommendationCard } from "../components/RecommendationCard.tsx";
import { colors, spacing } from "../theme.ts";

import type { ChatMessageResponse } from "../api.ts";
import type { MediaType } from "../components/ChatControls.tsx";

const DEFAULT_RESULT_COUNT = 10;
const NO_RECOMMENDATIONS = 0;
const NO_MESSAGES = 0;

const pageWrapper = css`
	display: flex;
	flex-direction: column;
	height: 100vh;
`;

const headerBar = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: ${spacing.md} ${spacing.lg};
	border-bottom: 1px solid ${colors.border};
`;

const pageTitle = css`
	font-size: 1.3rem;
	font-weight: 700;
	color: ${colors.text};
	letter-spacing: -0.3px;
`;

const newConvoButton = css`
	padding: ${spacing.xs} ${spacing.md};
	background: none;
	border: 1px solid ${colors.border};
	border-radius: 6px;
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.85rem;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const threadArea = css`
	flex: 1;
	overflow-y: auto;
	padding: ${spacing.lg};
`;

const emptyState = css`
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: ${colors.textDim};
	font-size: 1rem;
`;

const loadingIndicator = css`
	display: flex;
	justify-content: flex-start;
	margin-bottom: ${spacing.md};
`;

const loadingBubble = css`
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: 8px;
	color: ${colors.textMuted};
	font-size: 0.9rem;
`;

const PageHeader = ({ onNewConversation }: { onNewConversation: () => void }) => (
	<div className={headerBar}>
		<h1 className={pageTitle}>Recommendations</h1>
		<button type="button" className={newConvoButton} onClick={onNewConversation}>
			New Conversation
		</button>
	</div>
);

const LoadingBubble = () => (
	<div className={loadingIndicator}>
		<div className={loadingBubble}>Thinking...</div>
	</div>
);

const RecommendationsList = ({
	recommendations,
}: {
	recommendations: ChatMessageResponse["recommendations"];
}) => (
	<>
		{recommendations.map((rec) => (
			<RecommendationCard key={rec.id} recommendation={rec} />
		))}
	</>
);

const MessageItem = ({ message }: { message: ChatMessageResponse }) => (
	<>
		<ChatMessage content={message.content} role={message.role} />
		{message.recommendations.length > NO_RECOMMENDATIONS ? (
			<RecommendationsList recommendations={message.recommendations} />
		) : undefined}
	</>
);

const MessageThread = ({
	messages,
	isLoading,
}: {
	messages: ChatMessageResponse[];
	isLoading: boolean;
}) => {
	const threadRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (threadRef.current) {
			threadRef.current.scrollTop = threadRef.current.scrollHeight;
		}
	}, [messages.length, isLoading]);

	if (messages.length === NO_MESSAGES && !isLoading) {
		return (
			<div className={threadArea}>
				<div className={emptyState}>Send a message to get recommendations</div>
			</div>
		);
	}

	return (
		<div className={threadArea} ref={threadRef}>
			{messages.map((msg) => (
				<MessageItem key={msg.id} message={msg} />
			))}
			{isLoading ? <LoadingBubble /> : undefined}
		</div>
	);
};

const Recommendations = () => {
	const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
	const [conversationId, setConversationId] = useState<string | undefined>(undefined);
	const [mediaType, setMediaType] = useState<MediaType>("any");
	const [libraryId, setLibraryId] = useState("");
	const [resultCount, setResultCount] = useState(DEFAULT_RESULT_COUNT);
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

	return (
		<div className={pageWrapper}>
			<PageHeader onNewConversation={handleNewConversation} />
			<ChatControls
				mediaType={mediaType}
				onMediaTypeChange={setMediaType}
				libraryId={libraryId}
				onLibraryIdChange={setLibraryId}
				resultCount={resultCount}
				onResultCountChange={setResultCount}
			/>
			<MessageThread messages={messages} isLoading={isLoading} />
			<ChatInput onSend={handleSend} isLoading={isLoading} />
		</div>
	);
};

export { Recommendations };
