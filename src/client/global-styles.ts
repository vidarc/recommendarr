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
	}
`;
