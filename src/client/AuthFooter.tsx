import { css } from "@linaria/atomic";
import { colors, spacing } from "./theme.ts";

const footerText = css`
	text-align: center;
	margin-top: ${spacing.lg};
	color: ${colors.textMuted};
	font-size: 0.9rem;
`;

const LoginFooter = () => (
	<p className={footerText}>
		Don't have an account? <a href="/register">Register</a>
	</p>
);

const RegisterFooter = () => (
	<p className={footerText}>
		Already have an account? <a href="/login">Log in</a>
	</p>
);

export { LoginFooter, RegisterFooter };
