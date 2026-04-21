import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";

const SIZE_SMALL = 22;
const SIZE_LARGE = 28;
const INNER_SIZE_SMALL = 10;
const INNER_SIZE_LARGE = 14;

interface LogoProps {
	size: typeof SIZE_SMALL | typeof SIZE_LARGE;
}

const tile = css`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	background: ${colors.accent};
`;

const tile28 = css`
	width: 1.75rem;
	height: 1.75rem;
	border-radius: 0.5rem;
`;

const tile22 = css`
	width: 1.375rem;
	height: 1.375rem;
	border-radius: 0.375rem;
`;

const STAR_PATH = "M7 1l1.5 3.5 3.5.5-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z";

export const Logo = ({ size }: LogoProps) => {
	const inner = size === SIZE_LARGE ? INNER_SIZE_LARGE : INNER_SIZE_SMALL;
	const tileClass = size === SIZE_LARGE ? tile28 : tile22;
	return (
		<div aria-label="Recommendarr" className={`${tile} ${tileClass}`}>
			<svg width={inner} height={inner} viewBox="0 0 14 14" fill="none" aria-hidden="true">
				<path d={STAR_PATH} fill={colors.bg} />
			</svg>
		</div>
	);
};
