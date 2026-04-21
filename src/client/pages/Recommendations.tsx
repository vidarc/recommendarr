import { css } from "@linaria/atomic";
import { useEffect, useRef } from "react";

import { ChatControls } from "../components/ChatControls.tsx";
import { ChatInput } from "../components/ChatInput.tsx";
import { ChatMessage } from "../components/ChatMessage.tsx";
import { Icon } from "../components/Icon.tsx";
import { LoadingBubble } from "../components/LoadingBubble.tsx";
import { RecommendationCard } from "../components/RecommendationCard.tsx";
import { useChat } from "../hooks/use-chat.ts";
import { colors } from "../theme.ts";

import type { ChatMessage as ChatMessageType } from "@shared/schemas/chat";

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
	padding: 0.75rem 1.25rem;
	border-bottom: 1px solid ${colors.border};
	background: ${colors.bg};
	flex-shrink: 0;
`;

const pageTitleStyle = css`
	font-size: 0.9375rem;
	font-weight: 700;
	color: ${colors.text};
	letter-spacing: -0.2px;
`;

const pageSubtitle = css`
	font-size: 0.75rem;
	color: ${colors.textDim};
	margin-top: 0.0625rem;
`;

const newButton = css`
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.375rem 0.75rem;
	background: none;
	border: 1px solid ${colors.border};
	border-radius: 0.5rem;
	color: ${colors.textMuted};
	font-size: 0.75rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.accent};
	}
`;

const threadArea = css`
	flex: 1;
	overflow-y: auto;
	padding: 1.25rem 1.25rem 0;
`;

const assistantRecsIndent = css`
	padding-left: 1.875rem;
`;

/* ── Sub-components ────────────────────────────────────────── */

interface PageHeaderProps {
	title: string | undefined;
	messageCount: number;
	recCount: number;
	onNewConversation: () => void;
}

const formatSubtitle = (messageCount: number, recCount: number): string => {
	if (messageCount === NO_MESSAGES) {
		return "No messages yet";
	}
	return `${String(recCount)} recommendations · ${String(messageCount)} messages`;
};

const PageHeader = ({ title, messageCount, recCount, onNewConversation }: PageHeaderProps) => (
	<div className={headerBar}>
		<div>
			<h1 className={pageTitleStyle}>{title ?? "New conversation"}</h1>
			<p className={pageSubtitle}>{formatSubtitle(messageCount, recCount)}</p>
		</div>
		<button type="button" className={newButton} onClick={onNewConversation}>
			<Icon name="plus" size={13} />
			New
		</button>
	</div>
);

const MessageItem = ({
	message,
	conversationId,
	onFeedbackChange,
}: {
	message: ChatMessageType;
	conversationId: string;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
}) => (
	<>
		<ChatMessage content={message.content} role={message.role} />
		{message.recommendations.length > NO_RECOMMENDATIONS ? (
			<div className={message.role === "assistant" ? assistantRecsIndent : ""}>
				{message.recommendations.map((rec) => (
					<RecommendationCard
						key={rec.id}
						recommendation={rec}
						conversationId={conversationId}
						onFeedbackChange={onFeedbackChange}
					/>
				))}
			</div>
		) : undefined}
	</>
);

const MessageThread = ({
	messages,
	isLoading,
	conversationId,
	onFeedbackChange,
}: {
	messages: ChatMessageType[];
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
	const recCount = chat.messages.reduce(
		(total, msg) => total + msg.recommendations.length,
		NO_RECOMMENDATIONS,
	);

	return (
		<div className={pageWrapper}>
			<PageHeader
				title={chat.conversationTitle}
				messageCount={chat.messages.length}
				recCount={recCount}
				onNewConversation={chat.handleNewConversation}
			/>
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
