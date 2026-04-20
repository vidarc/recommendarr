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
import { LoginFooter } from "../components/AuthFooter.tsx";
import { FormField } from "../components/FormField.tsx";
import { useLoginMutation } from "../features/auth/api.ts";

import type { ChangeEvent, SubmitEvent } from "react";

export const Login = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [login, { error, isLoading }] = useLoginMutation();
	const dispatch = useDispatch();

	const handleSubmit = useCallback(
		async (event: SubmitEvent<HTMLFormElement>) => {
			event.preventDefault();
			const result = await login({ username, password });
			if ("data" in result && result.data) {
				dispatch(api.util.resetApiState());
			}
		},
		[username, password, login, dispatch],
	);

	const handleUsernameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	const hasError = error !== undefined;
	const errorId = "login-error";

	return (
		<div className={formWrapper}>
			<form onSubmit={handleSubmit} className={formCard}>
				<h1 className={formTitle}>Login</h1>
				{hasError && (
					<p id={errorId} role="alert" className={errorMessage}>
						Invalid username or password
					</p>
				)}
				<FormField
					id="username"
					label="Username"
					value={username}
					onChange={handleUsernameChange}
					required
					autoComplete="username"
					invalid={hasError}
					describedBy={hasError ? errorId : undefined}
				/>
				<FormField
					id="password"
					label="Password"
					type="password"
					value={password}
					onChange={handlePasswordChange}
					required
					autoComplete="current-password"
					invalid={hasError}
					describedBy={hasError ? errorId : undefined}
				/>
				<button type="submit" disabled={isLoading} className={submitButton}>
					{isLoading ? "Logging in..." : "Log in"}
				</button>
				<LoginFooter />
			</form>
		</div>
	);
};
