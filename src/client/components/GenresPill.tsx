import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

const NONE = 0;

const pillButton = css`
	display: inline-flex;
	align-items: center;
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	font-size: 0.8rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.text};
	}
`;

interface GenresPillProps {
	includedCount: number;
	excludedCount: number;
	expanded: boolean;
	onClick: () => void;
}

const formatLabel = (included: number, excluded: number): string => {
	if (included === NONE && excluded === NONE) {
		return "# Genres";
	}
	return `# Genres (${String(included)}·−${String(excluded)})`;
};

const GenresPill = ({ includedCount, excludedCount, expanded, onClick }: GenresPillProps) => (
	<button
		type="button"
		className={pillButton}
		aria-label="Genres"
		aria-expanded={expanded}
		onClick={onClick}
	>
		{formatLabel(includedCount, excludedCount)}
	</button>
);

export { GenresPill };
