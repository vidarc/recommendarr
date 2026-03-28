import { css } from "@linaria/atomic";
import { useCallback } from "react";

import { useConversations } from "../hooks/use-conversations.ts";
import { colors, radii, spacing } from "../theme.ts";
import { formatRelativeDate } from "../utils/format-date.ts";

import type { ConversationSummary } from "../features/chat/api.ts";
import type { KeyboardEvent, MouseEvent } from "react";

const NO_CONVERSATIONS = 0;

const pageWrapper = css`
	max-width: 800px;
	width: 100%;
	margin: 0 auto;
	padding: ${spacing.xl};
`;

const pageTitle = css`
	font-size: 2rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.lg};
	letter-spacing: -0.5px;
`;

const emptyText = css`
	color: ${colors.textMuted};
	text-align: center;
	padding: ${spacing.xxl} 0;
	font-size: 1rem;
`;

const listWrapper = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.sm};
`;

const rowWrapper = css`
	display: flex;
	align-items: center;
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	transition:
		background 0.2s ease,
		border-color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		border-color: ${colors.borderFocus};
	}
`;

const itemButton = css`
	display: flex;
	align-items: center;
	flex: 1;
	min-width: 0;
	padding: ${spacing.md};
	background: none;
	border: none;
	cursor: pointer;
	text-align: left;
	font: inherit;
`;

const infoWrapper = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
	min-width: 0;
	flex: 1;
`;

const titleText = css`
	font-size: 1rem;
	font-weight: 600;
	color: ${colors.text};
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const metaRow = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	font-size: 0.8rem;
	color: ${colors.textMuted};
`;

const badgeStyle = css`
	display: inline-block;
	padding: 2px ${spacing.sm};
	background: ${colors.bgLighter};
	border-radius: ${radii.sm};
	font-size: 0.75rem;
	font-weight: 600;
	color: ${colors.accent};
	text-transform: capitalize;
`;

const deleteBtnStyle = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: none;
	border: 1px solid transparent;
	border-radius: ${radii.sm};
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.8rem;
	margin-right: ${spacing.md};
	flex-shrink: 0;
	transition:
		color 0.2s ease,
		border-color 0.2s ease;

	&:hover {
		color: ${colors.red};
		border-color: ${colors.red};
	}
`;

const confirmBtnStyle = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.red};
	border: 1px solid ${colors.red};
	border-radius: ${radii.sm};
	color: ${colors.text};
	cursor: pointer;
	font-size: 0.8rem;
	margin-right: ${spacing.md};
	flex-shrink: 0;
	font-weight: 600;
`;

const cancelBtnStyle = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: none;
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.8rem;
	flex-shrink: 0;
`;

/* ── Sub-components ────────────────────────────────────────── */

const DeleteActions = ({
	isConfirming,
	onDelete,
	onConfirm,
	onCancel,
}: {
	isConfirming: boolean;
	onDelete: (event: MouseEvent) => void;
	onConfirm: (event: MouseEvent) => void;
	onCancel: (event: MouseEvent) => void;
}) => {
	if (isConfirming) {
		return (
			<>
				<button type="button" className={cancelBtnStyle} onClick={onCancel}>
					Cancel
				</button>
				<button type="button" className={confirmBtnStyle} onClick={onConfirm}>
					Delete
				</button>
			</>
		);
	}
	return (
		<button type="button" className={deleteBtnStyle} onClick={onDelete}>
			Delete
		</button>
	);
};

const ConversationMeta = ({ conversation }: { conversation: ConversationSummary }) => (
	<div className={infoWrapper}>
		<span className={titleText}>{conversation.title || "Untitled"}</span>
		<div className={metaRow}>
			<span className={badgeStyle}>{conversation.mediaType}</span>
			<span>{formatRelativeDate(conversation.createdAt)}</span>
		</div>
	</div>
);

const ConversationRow = ({
	conversation,
	isConfirming,
	onNavigate,
	onDeleteClick,
	onConfirmDelete,
	onCancelDelete,
}: {
	conversation: ConversationSummary;
	isConfirming: boolean;
	onNavigate: (id: string) => void;
	onDeleteClick: (event: MouseEvent, id: string) => void;
	onConfirmDelete: (event: MouseEvent, id: string) => void;
	onCancelDelete: (event: MouseEvent) => void;
}) => {
	const handleClick = useCallback(() => {
		onNavigate(conversation.id);
	}, [onNavigate, conversation.id]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				onNavigate(conversation.id);
			}
		},
		[onNavigate, conversation.id],
	);

	const handleDelete = useCallback(
		(event: MouseEvent) => {
			onDeleteClick(event, conversation.id);
		},
		[onDeleteClick, conversation.id],
	);

	const handleConfirm = useCallback(
		(event: MouseEvent) => {
			onConfirmDelete(event, conversation.id);
		},
		[onConfirmDelete, conversation.id],
	);

	return (
		<div className={rowWrapper}>
			<button type="button" className={itemButton} onClick={handleClick} onKeyDown={handleKeyDown}>
				<ConversationMeta conversation={conversation} />
			</button>
			<DeleteActions
				isConfirming={isConfirming}
				onDelete={handleDelete}
				onConfirm={handleConfirm}
				onCancel={onCancelDelete}
			/>
		</div>
	);
};

/* ── Main History ──────────────────────────────────────────── */

const History = () => {
	const {
		conversations,
		confirmingDeleteId,
		navigate,
		requestDelete,
		confirmDelete,
		cancelDelete,
	} = useConversations();

	if (conversations.length === NO_CONVERSATIONS) {
		return (
			<div className={pageWrapper}>
				<h1 className={pageTitle}>History</h1>
				<p className={emptyText}>No conversations yet. Start one from the Recommendations page.</p>
			</div>
		);
	}

	return (
		<div className={pageWrapper}>
			<h1 className={pageTitle}>History</h1>
			<div className={listWrapper}>
				{conversations.map((conversation) => (
					<ConversationRow
						key={conversation.id}
						conversation={conversation}
						isConfirming={confirmingDeleteId === conversation.id}
						onNavigate={navigate}
						onDeleteClick={requestDelete}
						onConfirmDelete={confirmDelete}
						onCancelDelete={cancelDelete}
					/>
				))}
			</div>
		</div>
	);
};

export { History };
