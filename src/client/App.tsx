import { useGetSettingsQuery } from "./api.ts";

const SettingItem = ({ name, value }: { name: string; value: string }) => (
	<li>
		<strong>{name}</strong>: {value}
	</li>
);

export const App = () => {
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
