import { css } from "@linaria/core";

import { colors, fonts } from "./theme.ts";

export const globals = css`
	:global() {
		body {
			font-family: ${fonts.body};
			background-color: ${colors.bg};
			color: ${colors.text};
			line-height: 1.6;
			min-height: 100vh;
		}

		a {
			color: ${colors.accent};
			text-decoration: none;
			transition: color 0.2s ease;

			&:hover {
				color: ${colors.accentHover};
			}
		}

		::selection {
			background-color: ${colors.bgLighter};
			color: ${colors.text};
		}

		:focus {
			outline: none;
		}

		:focus-visible {
			outline: 2px solid ${colors.borderFocus};
			outline-offset: 2px;
		}

		[data-tooltip] {
			position: relative;
		}

		[data-tooltip]:hover::after {
			content: attr(data-tooltip);
			position: absolute;
			left: calc(100% + 0.625rem);
			top: 50%;
			transform: translateY(-50%);
			background: ${colors.bgLight};
			border: 1px solid ${colors.border};
			color: ${colors.text};
			font-size: 0.75rem;
			white-space: nowrap;
			padding: 0.25rem 0.625rem;
			border-radius: 0.375rem;
			pointer-events: none;
			z-index: 100;
		}
	}
`;
