import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

import type { Recommendation } from "../api.ts";

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

const CardActions = ({ mediaType }: { mediaType: string }) => (
	<div className={actionRow}>
		<button
			type="button"
			className={arrButton}
			disabled
			title={`Connect ${mediaType === "movie" ? "Radarr" : "Sonarr"} in Settings to enable`}
		>
			Add to {mediaType === "movie" ? "Radarr" : "Sonarr"}
		</button>
	</div>
);

const RecommendationCard = ({ recommendation }: { recommendation: Recommendation }) => (
	<div className={card}>
		<CardHeaderContent
			title={recommendation.title}
			year={recommendation.year}
			mediaType={recommendation.mediaType}
		/>
		{recommendation.synopsis ? <p className={synopsis}>{recommendation.synopsis}</p> : undefined}
		<CardActions mediaType={recommendation.mediaType} />
	</div>
);

export { RecommendationCard };
