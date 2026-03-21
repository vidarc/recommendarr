import { css } from "@linaria/atomic";
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { useDeleteConversationMutation, useGetConversationsQuery } from "../api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { ConversationSummary } from "../api.ts";
import type { KeyboardEvent, MouseEvent } from "react";

const NO_CONVERSATIONS = 0;
const NO_TIME_ELAPSED = 0;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

const EMPTY_CONVERSATIONS: ConversationSummary[] = [];

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

const itemButton = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: ${spacing.md};
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	cursor: pointer;
	width: 100%;
	text-align: left;
	font: inherit;
	transition:
		background 0.2s ease,
		border-color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		border-color: ${colors.borderFocus};
	}
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
	margin-left: ${spacing.md};
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
	margin-left: ${spacing.xs};
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
	margin-left: ${spacing.md};
	flex-shrink: 0;
`;

const formatRelativeDate = (dateString: string): string => {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / MS_PER_SECOND);
	const diffMinutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
	const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
	const diffDays = Math.floor(diffHours / HOURS_PER_DAY);

	if (diffDays >= DAYS_PER_YEAR) {
		const years = Math.floor(diffDays / DAYS_PER_YEAR);
		return `${String(years)}y ago`;
	}
	if (diffDays >= DAYS_PER_MONTH) {
		const months = Math.floor(diffDays / DAYS_PER_MONTH);
		return `${String(months)}mo ago`;
	}
	if (diffDays >= DAYS_PER_WEEK) {
		const weeks = Math.floor(diffDays / DAYS_PER_WEEK);
		return `${String(weeks)}w ago`;
	}
	if (diffDays > NO_TIME_ELAPSED) {
		return `${String(diffDays)}d ago`;
	}
	if (diffHours > NO_TIME_ELAPSED) {
		return `${String(diffHours)}h ago`;
	}
	if (diffMinutes > NO_TIME_ELAPSED) {
		return `${String(diffMinutes)}m ago`;
	}
	return "just now";
};

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
		<button type="button" className={itemButton} onClick={handleClick} onKeyDown={handleKeyDown}>
			<ConversationMeta conversation={conversation} />
			<DeleteActions
				isConfirming={isConfirming}
				onDelete={handleDelete}
				onConfirm={handleConfirm}
				onCancel={onCancelDelete}
			/>
		</button>
	);
};

const ConversationList = ({
	conversations,
	confirmingDeleteId,
	onNavigate,
	onDeleteClick,
	onConfirmDelete,
	onCancelDelete,
}: {
	conversations: ConversationSummary[];
	confirmingDeleteId: string | undefined;
	onNavigate: (id: string) => void;
	onDeleteClick: (event: MouseEvent, id: string) => void;
	onConfirmDelete: (event: MouseEvent, id: string) => void;
	onCancelDelete: (event: MouseEvent) => void;
}) => (
	<div className={listWrapper}>
		{conversations.map((conversation) => (
			<ConversationRow
				key={conversation.id}
				conversation={conversation}
				isConfirming={confirmingDeleteId === conversation.id}
				onNavigate={onNavigate}
				onDeleteClick={onDeleteClick}
				onConfirmDelete={onConfirmDelete}
				onCancelDelete={onCancelDelete}
			/>
		))}
	</div>
);

const History = () => {
	const { data } = useGetConversationsQuery();
	const [deleteConversation] = useDeleteConversationMutation();
	const [, setLocation] = useLocation();
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | undefined>(undefined);

	const conversations = useMemo(
		() => data?.conversations ?? EMPTY_CONVERSATIONS,
		[data?.conversations],
	);

	const handleNavigate = useCallback(
		(id: string) => {
			setLocation(`/?conversation=${id}`);
		},
		[setLocation],
	);

	const handleDeleteClick = useCallback((event: MouseEvent, id: string) => {
		event.stopPropagation();
		setConfirmingDeleteId(id);
	}, []);

	const handleConfirmDelete = useCallback(
		(event: MouseEvent, id: string) => {
			event.stopPropagation();
			void deleteConversation(id);
			setConfirmingDeleteId(undefined);
		},
		[deleteConversation],
	);

	const handleCancelDelete = useCallback((event: MouseEvent) => {
		event.stopPropagation();
		setConfirmingDeleteId(undefined);
	}, []);

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
			<ConversationList
				conversations={conversations}
				confirmingDeleteId={confirmingDeleteId}
				onNavigate={handleNavigate}
				onDeleteClick={handleDeleteClick}
				onConfirmDelete={handleConfirmDelete}
				onCancelDelete={handleCancelDelete}
			/>
		</div>
	);
};

export { History };
