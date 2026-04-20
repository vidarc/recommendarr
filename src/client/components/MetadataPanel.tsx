import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { useLazyGetMetadataQuery } from "../features/metadata/api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { CreditPerson, MediaMetadataResponse } from "@shared/schemas/metadata";

const RATING_DECIMALS = 1;
const EMPTY = 0;

const metadataContainer = css`
	margin-top: ${spacing.sm};
	border-top: 1px solid ${colors.border};
	padding-top: ${spacing.sm};
`;

const posterRow = css`
	display: flex;
	gap: ${spacing.md};
`;

const posterImage = css`
	width: 80px;
	height: 120px;
	object-fit: cover;
	border-radius: ${radii.sm};
	flex-shrink: 0;
`;

const metadataDetails = css`
	flex: 1;
	min-width: 0;
`;

const genreList = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
	margin-bottom: ${spacing.xs};
`;

const genreBadge = css`
	font-size: 0.7rem;
	padding: 1px ${spacing.xs};
	border-radius: ${radii.sm};
	background: rgba(130, 170, 255, 0.1);
	color: ${colors.textMuted};
`;

const overviewText = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
	line-height: 1.4;
	margin-bottom: ${spacing.xs};
`;

const ratingText = css`
	font-size: 0.8rem;
	color: ${colors.textDim};
`;

const castSection = css`
	margin-top: ${spacing.xs};
`;

const castToggle = css`
	font-size: 0.8rem;
	color: ${colors.accent};
	background: none;
	border: none;
	cursor: pointer;
	padding: 0;

	&:hover {
		text-decoration: underline;
	}
`;

const castList = css`
	font-size: 0.8rem;
	color: ${colors.textMuted};
	line-height: 1.6;
	margin-top: ${spacing.xs};
`;

const showMoreButton = css`
	font-size: 0.8rem;
	color: ${colors.accent};
	background: none;
	border: none;
	cursor: pointer;
	padding: ${spacing.xs} 0;
	margin-top: ${spacing.xs};

	&:hover {
		text-decoration: underline;
	}
`;

const loadingText = css`
	font-size: 0.8rem;
	color: ${colors.textDim};
	padding: ${spacing.xs} 0;
`;

const GenreBadge = ({ genre }: { genre: string }) => <span className={genreBadge}>{genre}</span>;

const GenreList = ({ genres }: { genres: string[] }) => (
	<div className={genreList}>
		{genres.map((genre) => (
			<GenreBadge key={genre} genre={genre} />
		))}
	</div>
);

const CastEntry = ({ person }: { person: CreditPerson }) => (
	<p>
		{person.name}
		{person.character ? ` as ${person.character}` : ""}
	</p>
);

interface CastCrewSectionProps {
	cast: CreditPerson[];
	crew: CreditPerson[];
	expanded: boolean;
	onToggle: () => void;
}

const CastCrewSection = ({ cast, crew, expanded, onToggle }: CastCrewSectionProps) => (
	<div className={castSection}>
		<button type="button" className={castToggle} onClick={onToggle}>
			{expanded ? "Hide cast & crew" : "Show cast & crew"}
		</button>
		{expanded ? (
			<div className={castList}>
				{crew.length > EMPTY ? (
					<p>{crew.map((person) => `${person.name} (${person.role})`).join(", ")}</p>
				) : undefined}
				{cast.map((person) => (
					<CastEntry key={person.name} person={person} />
				))}
			</div>
		) : undefined}
	</div>
);

interface MetadataContentProps {
	metadata: MediaMetadataResponse;
	castExpanded: boolean;
	onToggleCast: () => void;
}

const MetadataContent = ({ metadata, castExpanded, onToggleCast }: MetadataContentProps) => (
	<div className={posterRow}>
		{metadata.posterUrl ? (
			<img src={metadata.posterUrl} alt={`${metadata.title} poster`} className={posterImage} />
		) : undefined}
		<div className={metadataDetails}>
			{metadata.genres.length > EMPTY ? <GenreList genres={metadata.genres} /> : undefined}
			{metadata.overview ? <p className={overviewText}>{metadata.overview}</p> : undefined}
			{metadata.rating !== undefined ? (
				<p className={ratingText}>
					Rating: {metadata.rating.toFixed(RATING_DECIMALS)}
					{metadata.status ? ` | ${metadata.status}` : ""}
				</p>
			) : undefined}
			{metadata.cast.length > EMPTY ? (
				<CastCrewSection
					cast={metadata.cast}
					crew={metadata.crew}
					expanded={castExpanded}
					onToggle={onToggleCast}
				/>
			) : undefined}
		</div>
	</div>
);

interface MetadataPanelProps {
	recommendationId: string;
	metadataAvailable: boolean;
}

const MetadataPanel = ({ recommendationId, metadataAvailable }: MetadataPanelProps) => {
	const [expanded, setExpanded] = useState(false);
	const [castExpanded, setCastExpanded] = useState(false);
	const [fetchMetadata, { data, isLoading }] = useLazyGetMetadataQuery();

	const handleExpand = useCallback(() => {
		if (!expanded) {
			void fetchMetadata(recommendationId);
		}
		setExpanded((prev) => !prev);
	}, [expanded, fetchMetadata, recommendationId]);

	const handleToggleCast = useCallback(() => {
		setCastExpanded((prev) => !prev);
	}, []);

	if (!metadataAvailable) {
		return undefined;
	}

	if (!expanded) {
		return (
			<button type="button" className={showMoreButton} onClick={handleExpand}>
				Show more info
			</button>
		);
	}

	if (isLoading) {
		return <p className={loadingText}>Loading metadata...</p>;
	}

	if (!data || !data.available) {
		return <p className={loadingText}>No additional info available.</p>;
	}

	return (
		<div className={metadataContainer}>
			<MetadataContent
				metadata={data}
				castExpanded={castExpanded}
				onToggleCast={handleToggleCast}
			/>
		</div>
	);
};

export { MetadataPanel };
