import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";
import { Logo } from "./Logo.tsx";

const userWrapper = css`
	display: flex;
	justify-content: flex-end;
	margin-bottom: 1.25rem;
`;

const userBubble = css`
	max-width: 70%;
	background: ${colors.accentDim};
	border: 1px solid rgba(127, 219, 202, 0.2);
	border-radius: 0.875rem 0.875rem 0.25rem 0.875rem;
	padding: 0.625rem 0.875rem;
	font-size: 0.875rem;
	color: ${colors.text};
	line-height: 1.55;
`;

const assistantWrapper = css`
	margin-bottom: 1.25rem;
`;

const assistantHeader = css`
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
`;

const assistantLabel = css`
	font-size: 0.75rem;
	color: ${colors.textDim};
	font-weight: 500;
`;

const assistantContent = css`
	font-size: 0.875rem;
	color: ${colors.textMuted};
	line-height: 1.6;
	padding-left: 1.875rem;
	margin-bottom: 0.75rem;
`;

interface ChatMessageProps {
	content: string;
	role: string;
}

export const ChatMessage = ({ content, role }: ChatMessageProps) => {
	if (role === "user") {
		return (
			<div data-role="user" className={userWrapper}>
				<div className={userBubble}>{content}</div>
			</div>
		);
	}

	return (
		<div data-role="assistant" className={assistantWrapper}>
			<div className={assistantHeader}>
				<Logo size={22} />
				<span className={assistantLabel}>Recommendarr</span>
			</div>
			<p className={assistantContent}>{content}</p>
		</div>
	);
};
