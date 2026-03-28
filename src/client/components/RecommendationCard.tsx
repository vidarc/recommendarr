import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { useGetArrConfigQuery } from "../features/arr/api.ts";
import { colors, radii, spacing } from "../theme.ts";
import { AddToArrModal } from "./AddToArrModal.tsx";

import type { Recommendation } from "../shared/types.ts";

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

interface CardActionsProps {
	mediaType: string;
	addedToArr: boolean;
	isConnected: boolean;
	onAdd: () => void;
}

const CardActions = ({ mediaType, addedToArr, isConnected, onAdd }: CardActionsProps) => {
	const serviceName = mediaType === "movie" ? "Radarr" : "Sonarr";

	if (addedToArr) {
		return (
			<div className={actionRow}>
				<span className={addedBadge}>Added to {serviceName}</span>
			</div>
		);
	}

	if (isConnected) {
		return (
			<div className={actionRow}>
				<button type="button" className={arrButtonEnabled} onClick={onAdd}>
					Add to {serviceName}
				</button>
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
		</div>
	);
};

const RecommendationCard = ({ recommendation }: { recommendation: Recommendation }) => {
	const [modalOpen, setModalOpen] = useState(false);
	const serviceType = recommendation.mediaType === "movie" ? "radarr" : "sonarr";
	const { data: arrConnections } = useGetArrConfigQuery();
	const isConnected =
		arrConnections !== undefined && arrConnections.some((conn) => conn.serviceType === serviceType);

	const handleOpenModal = useCallback(() => {
		setModalOpen(true);
	}, []);

	const handleCloseModal = useCallback(() => {
		setModalOpen(false);
	}, []);

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
			/>
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
