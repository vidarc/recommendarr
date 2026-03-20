import { useCallback, useState } from "react";
import { useGetSettingsQuery } from "./api.ts";
import { Login } from "./Login.tsx";

const SettingItem = ({ name, value }: { name: string; value: string }) => (
	<li>
		<strong>{name}</strong>: {value}
	</li>
);

const Settings = () => {
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

export const App = () => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const handleLogin = useCallback(() => {
		setIsAuthenticated(true);
	}, []);

	if (!isAuthenticated) {
		return <Login onLogin={handleLogin} />;
	}

	return <Settings />;
};
