import { useCallback, useState } from "react";

interface LoginProps {
	onLogin: (username: string, password: string) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	const handleSubmit = useCallback(
		(event: React.SubmitEvent<HTMLFormElement>) => {
			event.preventDefault();
			onLogin(username, password);
		},
		[onLogin, username, password],
	);

	const handleUsernameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	return (
		<form onSubmit={handleSubmit}>
			<h1>Login</h1>
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
				/>
			</div>
			<button type="submit">Log in</button>
		</form>
	);
};
