import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../../theme.ts";

const pageWrapper = css`
	max-width: 800px;
	width: 100%;
	margin: 0 auto;
	padding: ${spacing.xl};
`;

const pageTitle = css`
	font-size: 2rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.lg};
	letter-spacing: -0.5px;
`;

const sectionCard = css`
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.lg};
	padding: ${spacing.lg};
	margin-bottom: ${spacing.lg};
`;

const sectionTitle = css`
	font-size: 1.1rem;
	font-weight: 600;
	color: ${colors.text};
	margin-bottom: ${spacing.md};
`;

const fieldGroup = css`
	margin-bottom: ${spacing.md};
`;

const labelStyle = css`
	display: block;
	font-size: 0.85rem;
	font-weight: 500;
	color: ${colors.textMuted};
	margin-bottom: ${spacing.xs};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const inputStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const primaryButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.accent};
	color: ${colors.bg};
	border: none;
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const dangerButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	color: ${colors.red};
	border: 1px solid ${colors.red};
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.red};
		color: ${colors.bg};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const secondaryButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	color: ${colors.textMuted};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	cursor: pointer;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const buttonRow = css`
	display: flex;
	gap: ${spacing.sm};
	margin-top: ${spacing.md};
`;

const statusText = css`
	font-size: 0.9rem;
	color: ${colors.textMuted};
	margin-top: ${spacing.sm};
`;

const successText = css`
	color: ${colors.green};
	font-size: 0.9rem;
	margin-top: ${spacing.sm};
`;

const errorText = css`
	color: ${colors.red};
	font-size: 0.9rem;
	margin-top: ${spacing.sm};
`;

const selectStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}
`;

const comingSoonLabel = css`
	display: inline-block;
	font-size: 0.75rem;
	font-weight: 600;
	color: ${colors.yellow};
	background: rgba(236, 196, 141, 0.15);
	padding: 2px ${spacing.sm};
	border-radius: ${radii.sm};
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-left: ${spacing.sm};
`;

export {
	buttonRow,
	comingSoonLabel,
	dangerButton,
	errorText,
	fieldGroup,
	inputStyle,
	labelStyle,
	pageTitle,
	pageWrapper,
	primaryButton,
	secondaryButton,
	sectionCard,
	sectionTitle,
	selectStyle,
	statusText,
	successText,
};
