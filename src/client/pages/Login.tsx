import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";

import { api, useLoginMutation } from "../api.ts";
import {
	errorMessage,
	formCard,
	formTitle,
	formWrapper,
	submitButton,
} from "../components/auth-styles.ts";
import { LoginFooter } from "../components/AuthFooter.tsx";
import { FormField } from "../components/FormField.tsx";

export const Login = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [login, { error, isLoading }] = useLoginMutation();
	const dispatch = useDispatch();

	const handleSubmit = useCallback(
		async (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const result = await login({ username, password });
			if ("data" in result && result.data) {
				dispatch(api.util.resetApiState());
			}
		},
		[username, password, login, dispatch],
	);

	const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	return (
		<div className={formWrapper}>
			<form onSubmit={handleSubmit} className={formCard}>
				<h1 className={formTitle}>Login</h1>
				{error && <p className={errorMessage}>Invalid username or password</p>}
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
				/>
				<button type="submit" disabled={isLoading} className={submitButton}>
					{isLoading ? "Logging in..." : "Log in"}
				</button>
				<LoginFooter />
			</form>
		</div>
	);
};
