import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

const NONE = 0;

const row = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
`;

const chipBase = css`
	display: inline-flex;
	align-items: center;
	gap: ${spacing.xs};
	padding: ${spacing.xs} ${spacing.sm};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	font-size: 0.8rem;
`;

const chipIncluded = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};
`;

const chipExcluded = css`
	border-color: ${colors.red};
	color: ${colors.red};
	text-decoration: line-through;
`;

const removeButton = css`
	background: none;
	border: none;
	padding: 0;
	color: inherit;
	font-size: 0.9rem;
	line-height: 1;
	cursor: pointer;
`;

interface SelectedGenresRowProps {
	included: readonly string[];
	excluded: readonly string[];
	onRemove: (genre: string) => void;
}

const SelectedGenresRow = ({ included, excluded, onRemove }: SelectedGenresRowProps) => {
	if (included.length === NONE && excluded.length === NONE) {
		// oxlint-disable-next-line unicorn/no-null -- intentional null for empty render
		return null;
	}
	return (
		<div className={row}>
			{included.map((genre) => (
				<Chip key={`i-${genre}`} genre={genre} variant="included" onRemove={onRemove} />
			))}
			{excluded.map((genre) => (
				<Chip key={`e-${genre}`} genre={genre} variant="excluded" onRemove={onRemove} />
			))}
		</div>
	);
};

interface ChipProps {
	genre: string;
	variant: "included" | "excluded";
	onRemove: (genre: string) => void;
}

const Chip = ({ genre, variant, onRemove }: ChipProps) => {
	const handleClick = () => {
		onRemove(genre);
	};
	const className =
		variant === "included" ? `${chipBase} ${chipIncluded}` : `${chipBase} ${chipExcluded}`;
	return (
		<span className={className}>
			{genre}
			<button
				type="button"
				className={removeButton}
				aria-label={`Remove ${genre}`}
				onClick={handleClick}
			>
				×
			</button>
		</span>
	);
};

export { SelectedGenresRow };
