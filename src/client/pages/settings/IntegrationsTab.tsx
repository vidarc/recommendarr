import { useArrConfig } from "../../hooks/use-arr-config.ts";
import {
	buttonRow,
	dangerButton,
	errorText,
	primaryButton,
	secondaryButton,
	sectionCard,
	sectionTitle,
	successText,
} from "./settings-styles.ts";
import { SettingsField } from "./SettingsField.tsx";

interface ServiceButtonsProps {
	isConnected: boolean;
	isSaving: boolean;
	isTesting: boolean;
	isDeleting: boolean;
	onSave: () => void;
	onTest: () => void;
	onRemove: () => void;
}

const ServiceButtons = ({
	isConnected,
	isSaving,
	isTesting,
	isDeleting,
	onSave,
	onTest,
	onRemove,
}: ServiceButtonsProps) => (
	<div className={buttonRow}>
		<button type="button" className={primaryButton} onClick={onSave} disabled={isSaving}>
			{isSaving ? "Saving..." : "Save"}
		</button>
		{isConnected && (
			<button type="button" className={secondaryButton} onClick={onTest} disabled={isTesting}>
				{isTesting ? "Testing..." : "Test Connection"}
			</button>
		)}
		{isConnected && (
			<button type="button" className={dangerButton} onClick={onRemove} disabled={isDeleting}>
				{isDeleting ? "Removing..." : "Remove"}
			</button>
		)}
	</div>
);

interface ServiceSectionProps {
	label: string;
	urlId: string;
	apiKeyId: string;
	urlPlaceholder: string;
	url: string;
	apiKey: string;
	isConnected: boolean;
	isSaving: boolean;
	isTesting: boolean;
	isDeleting: boolean;
	testResult: string;
	onUrlChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onApiKeyChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onSave: () => void;
	onTest: () => void;
	onRemove: () => void;
}

const ServiceSection = ({
	label,
	urlId,
	apiKeyId,
	urlPlaceholder,
	url,
	apiKey,
	isConnected,
	isSaving,
	isTesting,
	isDeleting,
	testResult,
	onUrlChange,
	onApiKeyChange,
	onSave,
	onTest,
	onRemove,
}: ServiceSectionProps) => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>{label}</h3>
		<SettingsField
			id={urlId}
			label={`${label} URL`}
			value={url}
			onChange={onUrlChange}
			placeholder={urlPlaceholder}
		/>
		<SettingsField
			id={apiKeyId}
			label={`${label} API Key`}
			type="password"
			value={apiKey}
			onChange={onApiKeyChange}
		/>
		<ServiceButtons
			isConnected={isConnected}
			isSaving={isSaving}
			isTesting={isTesting}
			isDeleting={isDeleting}
			onSave={onSave}
			onTest={onTest}
			onRemove={onRemove}
		/>
		{testResult && (
			<p className={testResult.startsWith("Connection successful") ? successText : errorText}>
				{testResult}
			</p>
		)}
	</div>
);

const RADARR_RESULT_KEY = "radarr";
const SONARR_RESULT_KEY = "sonarr";

const IntegrationsTab = () => {
	const config = useArrConfig();

	return (
		<div>
			<ServiceSection
				label="Radarr"
				urlId="radarrUrl"
				apiKeyId="radarrApiKey"
				urlPlaceholder="http://localhost:7878"
				url={config.radarr.url}
				apiKey={config.radarr.apiKey}
				isConnected={config.isConnected(RADARR_RESULT_KEY)}
				isSaving={config.isSaving}
				isTesting={config.isTesting}
				isDeleting={config.isDeleting}
				testResult={config.testResult[RADARR_RESULT_KEY] ?? ""}
				onUrlChange={config.handleRadarrUrlChange}
				onApiKeyChange={config.handleRadarrApiKeyChange}
				onSave={config.handleSaveRadarr}
				onTest={config.handleTestRadarr}
				onRemove={config.handleRemoveRadarr}
			/>
			<ServiceSection
				label="Sonarr"
				urlId="sonarrUrl"
				apiKeyId="sonarrApiKey"
				urlPlaceholder="http://localhost:8989"
				url={config.sonarr.url}
				apiKey={config.sonarr.apiKey}
				isConnected={config.isConnected(SONARR_RESULT_KEY)}
				isSaving={config.isSaving}
				isTesting={config.isTesting}
				isDeleting={config.isDeleting}
				testResult={config.testResult[SONARR_RESULT_KEY] ?? ""}
				onUrlChange={config.handleSonarrUrlChange}
				onApiKeyChange={config.handleSonarrApiKeyChange}
				onSave={config.handleSaveSonarr}
				onTest={config.handleTestSonarr}
				onRemove={config.handleRemoveSonarr}
			/>
		</div>
	);
};

export { IntegrationsTab };
