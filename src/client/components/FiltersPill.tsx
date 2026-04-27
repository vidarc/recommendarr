import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

import type { MediaType } from "./FiltersPopover.tsx";

const pillButton = css`
	display: inline-flex;
	align-items: center;
	gap: ${spacing.xs};
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

const MEDIA_SHORTHAND: Record<MediaType, string> = {
	movie: "Films",
	tv: "Shows",
	any: "Either",
};

interface FiltersPillProps {
	mediaType: MediaType;
	resultCount: number;
	expanded: boolean;
	onClick: () => void;
}

const FiltersPill = ({ mediaType, resultCount, expanded, onClick }: FiltersPillProps) => (
	<button
		type="button"
		className={pillButton}
		aria-label="Filters"
		aria-expanded={expanded}
		onClick={onClick}
	>
		{MEDIA_SHORTHAND[mediaType]} · {resultCount}
	</button>
);

export { FiltersPill };
