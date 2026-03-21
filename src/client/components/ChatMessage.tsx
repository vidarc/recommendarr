import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

const messageRow = css`
	display: flex;
	margin-bottom: ${spacing.md};
`;

const userMessageRow = css`
	justify-content: flex-end;
`;

const assistantMessageRow = css`
	justify-content: flex-start;
`;

const messageBubble = css`
	max-width: 75%;
	padding: ${spacing.sm} ${spacing.md};
	border-radius: ${radii.md};
	font-size: 0.95rem;
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
`;

const userBubble = css`
	background: rgba(127, 219, 202, 0.15);
	color: ${colors.text};
	border: 1px solid rgba(127, 219, 202, 0.3);
`;

const assistantBubble = css`
	background: ${colors.surface};
	color: ${colors.text};
	border: 1px solid ${colors.border};
`;

interface ChatMessageProps {
	content: string;
	role: string;
}

const ChatMessage = ({ content, role }: ChatMessageProps) => {
	const isUser = role === "user";

	return (
		<div className={`${messageRow} ${isUser ? userMessageRow : assistantMessageRow}`}>
			<div className={`${messageBubble} ${isUser ? userBubble : assistantBubble}`}>{content}</div>
		</div>
	);
};

export { ChatMessage };
