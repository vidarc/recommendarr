import { css } from "@linaria/atomic";
import { useEffect, useRef } from "react";

import { ChatControls } from "../components/ChatControls.tsx";
import { ChatInput } from "../components/ChatInput.tsx";
import { ChatMessage } from "../components/ChatMessage.tsx";
import { RecommendationCard } from "../components/RecommendationCard.tsx";
import { useChat } from "../hooks/use-chat.ts";
import { colors, spacing } from "../theme.ts";

import type { ChatMessageResponse } from "../shared/types.ts";

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

const pageTitleStyle = css`
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

/* ── Sub-components ────────────────────────────────────────── */

const PageHeader = ({ onNewConversation }: { onNewConversation: () => void }) => (
	<div className={headerBar}>
		<h1 className={pageTitleStyle}>Recommendations</h1>
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

const MessageItem = ({
	message,
	conversationId,
	onFeedbackChange,
}: {
	message: ChatMessageResponse;
	conversationId: string;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
}) => (
	<>
		<ChatMessage content={message.content} role={message.role} />
		{message.recommendations.length > NO_RECOMMENDATIONS
			? message.recommendations.map((rec) => (
					<RecommendationCard
						key={rec.id}
						recommendation={rec}
						conversationId={conversationId}
						onFeedbackChange={onFeedbackChange}
					/>
				))
			: undefined}
	</>
);

const MessageThread = ({
	messages,
	isLoading,
	conversationId,
	onFeedbackChange,
}: {
	messages: ChatMessageResponse[];
	isLoading: boolean;
	conversationId: string | undefined;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
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
				<MessageItem
					key={msg.id}
					message={msg}
					conversationId={conversationId ?? ""}
					onFeedbackChange={onFeedbackChange}
				/>
			))}
			{isLoading ? <LoadingBubble /> : undefined}
		</div>
	);
};

/* ── Main Recommendations ──────────────────────────────────── */

const Recommendations = () => {
	const chat = useChat();

	return (
		<div className={pageWrapper}>
			<PageHeader onNewConversation={chat.handleNewConversation} />
			<ChatControls
				mediaType={chat.mediaType}
				onMediaTypeChange={chat.handleMediaTypeChange}
				libraryId={chat.libraryId}
				onLibraryIdChange={chat.handleLibraryIdChange}
				resultCount={chat.resultCount}
				onResultCountChange={chat.handleResultCountChange}
				excludeLibrary={chat.excludeLibrary}
				onExcludeLibraryChange={chat.handleExcludeLibraryChange}
			/>
			<MessageThread
				messages={chat.messages}
				isLoading={chat.isLoading}
				conversationId={chat.conversationId}
				onFeedbackChange={chat.handleRecommendationFeedback}
			/>
			<ChatInput onSend={chat.handleSend} isLoading={chat.isLoading} />
		</div>
	);
};

export { Recommendations };
