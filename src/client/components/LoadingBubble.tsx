import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";

const DOT_SIZE_REM = 0.375;
const DOT_GAP_REM = 0.25;
const PADDING_X_REM = 0.875;
const PADDING_Y_REM = 0.5;
const BORDER_RADIUS_REM = 0.625;
const WRAPPER_MARGIN_BOTTOM_REM = 1;
const WRAPPER_PADDING_LEFT_REM = 1.875;
const ANIMATION_DURATION_MS = 1000;
const DOT_DELAY_INCREMENT_MS = 150;
const DOT_1_MULTIPLIER = 1;
const DOT_2_MULTIPLIER = 2;
const MIN_OPACITY = 0.3;
const MAX_OPACITY = 1;
const MIN_SCALE = 0.8;

const wrapper = css`
	padding-left: ${WRAPPER_PADDING_LEFT_REM}rem;
	margin-bottom: ${WRAPPER_MARGIN_BOTTOM_REM}rem;
`;

const bubble = css`
	display: inline-flex;
	gap: ${DOT_GAP_REM}rem;
	padding: ${PADDING_Y_REM}rem ${PADDING_X_REM}rem;
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${BORDER_RADIUS_REM}rem;
`;

const dotBase = css`
	width: ${DOT_SIZE_REM}rem;
	height: ${DOT_SIZE_REM}rem;
	border-radius: 50%;
	background: ${colors.accent};
	opacity: ${MIN_OPACITY};
	animation: loadingPulse ${ANIMATION_DURATION_MS}ms ease-in-out infinite;

	@keyframes loadingPulse {
		0%,
		100% {
			opacity: ${MIN_OPACITY};
			transform: scale(${MIN_SCALE});
		}
		50% {
			opacity: ${MAX_OPACITY};
			transform: scale(1);
		}
	}
`;

const dot0 = css`
	animation-delay: 0s;
`;

const dot1 = css`
	animation-delay: ${DOT_DELAY_INCREMENT_MS * DOT_1_MULTIPLIER}ms;
`;

const dot2 = css`
	animation-delay: ${DOT_DELAY_INCREMENT_MS * DOT_2_MULTIPLIER}ms;
`;

export const LoadingBubble = () => (
	<div className={wrapper}>
		<div role="status" aria-label="Loading" className={bubble}>
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot0}`} />
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot1}`} />
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot2}`} />
		</div>
	</div>
);
