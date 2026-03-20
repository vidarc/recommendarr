import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "wouter";
import { useRegisterMutation } from "./api.ts";
import { setUser } from "./auth-slice.ts";

const minPasswordLength = 8;

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
		<form onSubmit={handleSubmit}>
			<h1>Register</h1>
			{validationError && <p>{validationError}</p>}
			{error && <p>{"data" in error ? "Username already taken" : "Registration failed"}</p>}
			<div>
				<label htmlFor="username">Username</label>
				<input
					id="username"
					type="text"
					value={username}
					onChange={handleUsernameChange}
					required
				/>
			</div>
			<div>
				<label htmlFor="password">Password</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={handlePasswordChange}
					required
					minLength={minPasswordLength}
				/>
			</div>
			<div>
				<label htmlFor="confirmPassword">Confirm Password</label>
				<input
					id="confirmPassword"
					type="password"
					value={confirmPassword}
					onChange={handleConfirmPasswordChange}
					required
					minLength={minPasswordLength}
				/>
			</div>
			<button type="submit" disabled={isLoading}>
				{isLoading ? "Registering..." : "Register"}
			</button>
			<p>
				Already have an account? <a href="/login">Log in</a>
			</p>
		</form>
	);
};
