import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { useGetArrConfigQuery } from "../features/arr/api.ts";
import { useUpdateFeedbackMutation } from "../features/chat/api.ts";
import { colors, radii, spacing } from "../theme.ts";
import { AddToArrModal } from "./AddToArrModal.tsx";

import type { Recommendation } from "@shared/schemas/chat";
import type { ReactNode } from "react";

const card = css`
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	padding: ${spacing.md};
	margin-bottom: ${spacing.sm};
`;

const cardHeader = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	margin-bottom: ${spacing.xs};
`;

const cardTitle = css`
	font-size: 1rem;
	font-weight: 600;
	color: ${colors.text};
`;

const cardYear = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
`;

const mediaTypeBadge = css`
	font-size: 0.7rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	padding: 2px ${spacing.xs};
	border-radius: ${radii.sm};
	background: rgba(130, 170, 255, 0.15);
	color: ${colors.blue};
`;

const synopsis = css`
	font-size: 0.9rem;
	color: ${colors.textMuted};
	line-height: 1.5;
	margin-bottom: ${spacing.sm};
`;

const actionRow = css`
	display: flex;
	gap: ${spacing.sm};
`;

const arrButton = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: none;
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.textDim};
	font-size: 0.8rem;
	cursor: not-allowed;
	opacity: 0.6;
`;

const arrButtonEnabled = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: none;
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.textDim};
	font-size: 0.8rem;
	cursor: pointer;
	opacity: 1;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.accent};
	}
`;

const addedBadge = css`
	padding: ${spacing.xs} ${spacing.sm};
	border-radius: ${radii.sm};
	font-size: 0.8rem;
	color: ${colors.green};
	background: rgba(173, 219, 103, 0.1);
	border: 1px solid rgba(173, 219, 103, 0.3);
`;

const feedbackButton = css`
	padding: ${spacing.xs};
	background: none;
	border: 1px solid transparent;
	border-radius: ${radii.sm};
	font-size: 1rem;
	cursor: pointer;
	opacity: 0.5;
	transition: opacity 0.15s;
	line-height: 1;

	&:hover {
		opacity: 0.8;
	}
`;

const feedbackButtonActive = css`
	padding: ${spacing.xs};
	background: none;
	border: 1px solid transparent;
	border-radius: ${radii.sm};
	font-size: 1rem;
	cursor: pointer;
	opacity: 1;
	line-height: 1;
`;

const CardHeaderContent = ({
	title,
	year,
	mediaType,
}: {
	title: string;
	year: number | undefined;
	mediaType: string;
}) => (
	<div className={cardHeader}>
		<span className={cardTitle}>{title}</span>
		{year ? <span className={cardYear}>({year})</span> : undefined}
		<span className={mediaTypeBadge}>{mediaType === "movie" ? "Movie" : "TV"}</span>
	</div>
);

interface FeedbackButtonsProps {
	feedback: "liked" | "disliked" | null | undefined;
	onFeedback: (feedback: "liked" | "disliked" | null) => void;
}

const FeedbackButtons = ({ feedback, onFeedback }: FeedbackButtonsProps) => {
	const isLiked = feedback === "liked";
	const isDisliked = feedback === "disliked";

	const handleLike = useCallback(() => {
		// eslint-disable-next-line unicorn/no-null -- API requires null to clear feedback
		onFeedback(isLiked ? null : "liked");
	}, [onFeedback, isLiked]);

	const handleDislike = useCallback(() => {
		// eslint-disable-next-line unicorn/no-null -- API requires null to clear feedback
		onFeedback(isDisliked ? null : "disliked");
	}, [onFeedback, isDisliked]);

	return (
		<>
			<button
				type="button"
				className={isLiked ? feedbackButtonActive : feedbackButton}
				aria-label="Thumbs up"
				aria-pressed={isLiked}
				title={isLiked ? "Remove like" : "Like this recommendation"}
				onClick={handleLike}
			>
				👍
			</button>
			<button
				type="button"
				className={isDisliked ? feedbackButtonActive : feedbackButton}
				aria-label="Thumbs down"
				aria-pressed={isDisliked}
				title={isDisliked ? "Remove dislike" : "Dislike this recommendation"}
				onClick={handleDislike}
			>
				👎
			</button>
		</>
	);
};

interface CardActionsProps {
	mediaType: string;
	addedToArr: boolean;
	isConnected: boolean;
	onAdd: () => void;
	children: ReactNode;
}

const CardActions = ({ mediaType, addedToArr, isConnected, onAdd, children }: CardActionsProps) => {
	const serviceName = mediaType === "movie" ? "Radarr" : "Sonarr";

	if (addedToArr) {
		return (
			<div className={actionRow}>
				<span className={addedBadge}>Added to {serviceName}</span>
				{children}
			</div>
		);
	}

	if (isConnected) {
		return (
			<div className={actionRow}>
				<button type="button" className={arrButtonEnabled} onClick={onAdd}>
					Add to {serviceName}
				</button>
				{children}
			</div>
		);
	}

	return (
		<div className={actionRow}>
			<button
				type="button"
				className={arrButton}
				disabled
				title={`Connect ${serviceName} in Settings to enable`}
			>
				Add to {serviceName}
			</button>
			{children}
		</div>
	);
};

const RecommendationCard = ({
	recommendation,
	conversationId,
	onFeedbackChange,
}: {
	recommendation: Recommendation;
	conversationId: string;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
}) => {
	const [modalOpen, setModalOpen] = useState(false);
	const serviceType = recommendation.mediaType === "movie" ? "radarr" : "sonarr";
	const { data: arrConnections } = useGetArrConfigQuery();
	const isConnected =
		arrConnections !== undefined && arrConnections.some((conn) => conn.serviceType === serviceType);
	const [updateFeedback] = useUpdateFeedbackMutation();

	const handleOpenModal = useCallback(() => {
		setModalOpen(true);
	}, []);

	const handleCloseModal = useCallback(() => {
		setModalOpen(false);
	}, []);

	const handleFeedback = useCallback(
		(feedback: "liked" | "disliked" | null) => {
			onFeedbackChange?.(recommendation.id, feedback);
			/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- intentional fire-and-forget with error handling */
			void updateFeedback({
				recommendationId: recommendation.id,
				conversationId,
				feedback,
			}).catch(() => {
				// Optimistic update handles rollback; no additional error handling needed
			});
			/* eslint-enable promise/prefer-await-to-then, promise/prefer-await-to-callbacks */
		},
		[updateFeedback, recommendation.id, conversationId, onFeedbackChange],
	);

	return (
		<div className={card}>
			<CardHeaderContent
				title={recommendation.title}
				year={recommendation.year}
				mediaType={recommendation.mediaType}
			/>
			{recommendation.synopsis ? <p className={synopsis}>{recommendation.synopsis}</p> : undefined}
			<CardActions
				mediaType={recommendation.mediaType}
				addedToArr={recommendation.addedToArr}
				isConnected={isConnected}
				onAdd={handleOpenModal}
			>
				<FeedbackButtons feedback={recommendation.feedback} onFeedback={handleFeedback} />
			</CardActions>
			{isConnected ? (
				<AddToArrModal
					recommendation={recommendation}
					serviceType={serviceType}
					isOpen={modalOpen}
					onClose={handleCloseModal}
				/>
			) : undefined}
		</div>
	);
};

export { RecommendationCard };
