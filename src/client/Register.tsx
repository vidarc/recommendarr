import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "wouter";

import { useRegisterMutation } from "./api.ts";
import { setUser } from "./auth-slice.ts";
import { RegisterFooter } from "./AuthFooter.tsx";
import { FormField } from "./FormField.tsx";
import { colors, radii, spacing } from "./theme.ts";

const minPasswordLength = 8;

const formWrapper = css`
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	padding: ${spacing.md};
`;

const formCard = css`
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.lg};
	padding: ${spacing.xl};
	width: 100%;
	max-width: 400px;
`;

const formTitle = css`
	font-size: 1.75rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.lg};
	text-align: center;
`;

const submitButton = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.accent};
	color: ${colors.bg};
	border: none;
	border-radius: ${radii.sm};
	font-size: 1rem;
	font-weight: 600;
	cursor: pointer;
	margin-top: ${spacing.md};
	transition: background 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const errorMessage = css`
	color: ${colors.red};
	font-size: 0.9rem;
	text-align: center;
	margin-bottom: ${spacing.md};
	padding: ${spacing.sm};
	background: rgba(239, 83, 80, 0.1);
	border-radius: ${radii.sm};
	border: 1px solid rgba(239, 83, 80, 0.3);
`;

export const Register = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [validationError, setValidationError] = useState("");
	const [register, { error, isLoading }] = useRegisterMutation();
	const dispatch = useDispatch();
	const [, navigate] = useLocation();

	const handleSubmit = useCallback(
		async (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setValidationError("");

			if (password !== confirmPassword) {
				setValidationError("Passwords do not match");
				return;
			}

			const result = await register({ username, password });
			if ("data" in result && result.data) {
				dispatch(setUser(result.data));
				navigate("/");
			}
		},
		[username, password, confirmPassword, register, dispatch, navigate],
	);

	const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	const handleConfirmPasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setConfirmPassword(event.target.value);
	}, []);

	return (
		<div className={formWrapper}>
			<form onSubmit={handleSubmit} className={formCard}>
				<h1 className={formTitle}>Register</h1>
				{validationError && <p className={errorMessage}>{validationError}</p>}
				{error && (
					<p className={errorMessage}>
						{"data" in error ? "Username already taken" : "Registration failed"}
					</p>
				)}
				<FormField
					id="username"
					label="Username"
					value={username}
					onChange={handleUsernameChange}
					required
				/>
				<FormField
					id="password"
					label="Password"
					type="password"
					value={password}
					onChange={handlePasswordChange}
					required
					minLength={minPasswordLength}
				/>
				<FormField
					id="confirmPassword"
					label="Confirm Password"
					type="password"
					value={confirmPassword}
					onChange={handleConfirmPasswordChange}
					required
					minLength={minPasswordLength}
				/>
				<button type="submit" disabled={isLoading} className={submitButton}>
					{isLoading ? "Registering..." : "Register"}
				</button>
				<RegisterFooter />
			</form>
		</div>
	);
};
