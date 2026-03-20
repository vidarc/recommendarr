import { useSelector } from "react-redux";
import { Redirect, Route, Switch } from "wouter";
import { useGetSettingsQuery, useGetSetupStatusQuery } from "./api.ts";
import { Login } from "./Login.tsx";
import { Register } from "./Register.tsx";

import type { RootState } from "./store.ts";

const SettingItem = ({ name, value }: { name: string; value: string }) => (
	<li>
		<strong>{name}</strong>: {value}
	</li>
);

const Dashboard = () => {
	const { data: settings, error, isLoading } = useGetSettingsQuery();

	if (isLoading) {
		return <p>Loading...</p>;
	}

	if (error) {
		return <p>Error loading settings</p>;
	}

	if (!settings) {
		return <p>No settings found</p>;
	}

	return (
		<div>
			<h1>Recommendarr</h1>
			<ul>
				{Object.entries(settings).map(([key, value]) => (
					<SettingItem key={key} name={key} value={value} />
				))}
			</ul>
		</div>
	);
};

const ProtectedDashboard = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	if (!user) {
		return <Redirect to="/login" />;
	}
	return <Dashboard />;
};

const LoginPage = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	const { data: setupStatus } = useGetSetupStatusQuery();

	if (user) {
		return <Redirect to="/" />;
	}
	if (setupStatus?.needsSetup) {
		return <Redirect to="/register" />;
	}
	return <Login />;
};

const RegisterPage = () => {
	const user = useSelector((state: RootState) => state.auth.user);
	if (user) {
		return <Redirect to="/" />;
	}
	return <Register />;
};

export const App = () => {
	const { isLoading } = useGetSetupStatusQuery();

	if (isLoading) {
		return <p>Loading...</p>;
	}

	return (
		<Switch>
			<Route path="/login" component={LoginPage} />
			<Route path="/register" component={RegisterPage} />
			<Route path="/" component={ProtectedDashboard} />
			<Route>
				<Redirect to="/" />
			</Route>
		</Switch>
	);
};
