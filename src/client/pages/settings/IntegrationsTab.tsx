import { comingSoonLabel, sectionCard, sectionTitle } from "./settings-styles.ts";
import { SettingsField } from "./SettingsField.tsx";

const noopChange = () => {};

export const IntegrationsTab = () => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>
			Radarr / Sonarr
			<span className={comingSoonLabel}>Coming Soon</span>
		</h3>
		<SettingsField
			id="radarrUrl"
			label="Radarr URL"
			value=""
			onChange={noopChange}
			disabled
			placeholder="http://localhost:7878"
		/>
		<SettingsField
			id="radarrApiKey"
			label="Radarr API Key"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<SettingsField
			id="sonarrUrl"
			label="Sonarr URL"
			value=""
			onChange={noopChange}
			disabled
			placeholder="http://localhost:8989"
		/>
		<SettingsField
			id="sonarrApiKey"
			label="Sonarr API Key"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
	</div>
);
