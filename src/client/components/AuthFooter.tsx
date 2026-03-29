import { css } from "@linaria/atomic";
import { Link } from "wouter";

import { colors, spacing } from "../theme.ts";

const footerText = css`
	text-align: center;
	margin-top: ${spacing.lg};
	color: ${colors.textMuted};
	font-size: 0.9rem;
`;

const LoginFooter = () => (
	<p className={footerText}>
		Don't have an account? <Link href="/register">Register</Link>
	</p>
);

const RegisterFooter = () => (
	<p className={footerText}>
		Already have an account? <Link href="/login">Log in</Link>
	</p>
);

export { LoginFooter, RegisterFooter };
