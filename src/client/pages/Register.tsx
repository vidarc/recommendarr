import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";

import { api } from "../api.ts";
import {
	errorMessage,
	formCard,
	formTitle,
	formWrapper,
	submitButton,
} from "../components/auth-styles.ts";
import { RegisterFooter } from "../components/AuthFooter.tsx";
import { FormField } from "../components/FormField.tsx";
import { useRegisterMutation } from "../features/auth/api.ts";

import type { ChangeEvent, SubmitEvent } from "react";

const minPasswordLength = 8;

export const Register = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [validationError, setValidationError] = useState("");
	const [register, { error, isLoading }] = useRegisterMutation();
	const dispatch = useDispatch();

	const handleSubmit = useCallback(
		async (event: SubmitEvent<HTMLFormElement>) => {
			event.preventDefault();
			setValidationError("");

			if (password !== confirmPassword) {
				setValidationError("Passwords do not match");
				return;
			}

			const result = await register({ username, password });
			if ("data" in result && result.data) {
				dispatch(api.util.resetApiState());
			}
		},
		[username, password, confirmPassword, register, dispatch],
	);

	const handleUsernameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	const handleConfirmPasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
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
