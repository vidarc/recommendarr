import { css } from "@linaria/atomic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	useDeleteAiConfigMutation,
	useDisconnectPlexMutation,
	useGetAiConfigQuery,
	useGetPlexServersQuery,
	useLazyCheckPlexAuthQuery,
	useSelectPlexServerMutation,
	useStartPlexAuthMutation,
	useTestAiConnectionMutation,
	useUpdateAiConfigMutation,
} from "../api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { PlexServer } from "../api.ts";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const TEMP_STEP = 0.1;
const TEMP_MIN = 0;
const TEMP_MAX = 2;
const POLL_INCREMENT = 1;
const NO_SERVERS = 0;

/* ── Shared styles ─────────────────────────────────────────── */

const pageWrapper = css`
	max-width: 800px;
	width: 100%;
	margin: 0 auto;
	padding: ${spacing.xl};
`;

const pageTitle = css`
	font-size: 2rem;
	font-weight: 700;
	color: ${colors.text};
	margin-bottom: ${spacing.lg};
	letter-spacing: -0.5px;
`;

const tabBar = css`
	display: flex;
	gap: ${spacing.xs};
	border-bottom: 1px solid ${colors.border};
	margin-bottom: ${spacing.xl};
`;

const tabButtonBase = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.95rem;
	transition:
		color 0.2s ease,
		border-color 0.2s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const tabButtonActive = css`
	color: ${colors.accent};
	border-bottom-color: ${colors.accent};
`;

const sectionCard = css`
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.lg};
	padding: ${spacing.lg};
	margin-bottom: ${spacing.lg};
`;

const sectionTitle = css`
	font-size: 1.1rem;
	font-weight: 600;
	color: ${colors.text};
	margin-bottom: ${spacing.md};
`;

const fieldGroup = css`
	margin-bottom: ${spacing.md};
`;

const labelStyle = css`
	display: block;
	font-size: 0.85rem;
	font-weight: 500;
	color: ${colors.textMuted};
	margin-bottom: ${spacing.xs};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const inputStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const primaryButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.accent};
	color: ${colors.bg};
	border: none;
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const dangerButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	color: ${colors.red};
	border: 1px solid ${colors.red};
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.red};
		color: ${colors.bg};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const secondaryButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	color: ${colors.textMuted};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	cursor: pointer;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const buttonRow = css`
	display: flex;
	gap: ${spacing.sm};
	margin-top: ${spacing.md};
`;

const statusText = css`
	font-size: 0.9rem;
	color: ${colors.textMuted};
	margin-top: ${spacing.sm};
`;

const successText = css`
	color: ${colors.green};
	font-size: 0.9rem;
	margin-top: ${spacing.sm};
`;

const errorText = css`
	color: ${colors.red};
	font-size: 0.9rem;
	margin-top: ${spacing.sm};
`;

const connectedRow = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${spacing.md};
`;

const connectedInfo = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
`;

const statusDot = css`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${colors.green};
	flex-shrink: 0;
`;

const connectedLabel = css`
	color: ${colors.text};
	font-weight: 500;
`;

const selectStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}
`;

const comingSoonLabel = css`
	display: inline-block;
	font-size: 0.75rem;
	font-weight: 600;
	color: ${colors.yellow};
	background: rgba(236, 196, 141, 0.15);
	padding: 2px ${spacing.sm};
	border-radius: ${radii.sm};
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-left: ${spacing.sm};
`;

const collapsibleHeader = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	background: none;
	border: none;
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.9rem;
	padding: ${spacing.sm} 0;
	width: 100%;
	text-align: left;
	transition: color 0.2s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const collapsibleContent = css`
	padding-top: ${spacing.sm};
`;

const rangeWrapper = css`
	display: flex;
	align-items: center;
	gap: ${spacing.md};
`;

const rangeInput = css`
	flex: 1;
	accent-color: ${colors.accent};
`;

const rangeValue = css`
	color: ${colors.text};
	font-size: 0.9rem;
	min-width: 32px;
	text-align: right;
`;

/* ── Tab types ─────────────────────────────────────────────── */

type SettingsTab = "account" | "ai" | "integrations" | "plex";

const TABS: { id: SettingsTab; label: string }[] = [
	{ id: "plex", label: "Plex Connection" },
	{ id: "ai", label: "AI Configuration" },
	{ id: "account", label: "Account" },
	{ id: "integrations", label: "Integrations" },
];

/* ── Sub-components ────────────────────────────────────────── */

interface TabButtonProps {
	id: SettingsTab;
	label: string;
	isActive: boolean;
	onClick: (tab: SettingsTab) => void;
}

const TabButton = ({ id, label, isActive, onClick }: TabButtonProps) => {
	const handleClick = useCallback(() => {
		onClick(id);
	}, [id, onClick]);

	return (
		<button
			type="button"
			className={`${tabButtonBase} ${isActive ? tabButtonActive : ""}`}
			onClick={handleClick}
		>
			{label}
		</button>
	);
};

interface SettingsFieldProps {
	id: string;
	label: string;
	type?: string;
	value: string;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	disabled?: boolean;
	placeholder?: string;
}

const SettingsField = ({
	id,
	label,
	type = "text",
	value,
	onChange,
	disabled,
	placeholder,
}: SettingsFieldProps) => (
	<div className={fieldGroup}>
		<label htmlFor={id} className={labelStyle}>
			{label}
		</label>
		<input
			id={id}
			type={type}
			value={value}
			onChange={onChange}
			disabled={disabled}
			placeholder={placeholder}
			className={inputStyle}
		/>
	</div>
);

interface ServerSelectProps {
	servers: PlexServer[];
	onSelect: (server: PlexServer) => void;
	isLoading: boolean;
}

const ServerSelect = ({ servers, onSelect, isLoading }: ServerSelectProps) => {
	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			const server = servers.find((item) => item.clientIdentifier === event.target.value);
			if (server) {
				onSelect(server);
			}
		},
		[servers, onSelect],
	);

	return (
		<div className={fieldGroup}>
			<label htmlFor="plex-server" className={labelStyle}>
				Select Server
			</label>
			<select
				id="plex-server"
				className={selectStyle}
				onChange={handleChange}
				disabled={isLoading}
				defaultValue=""
			>
				<option value="" disabled>
					Choose a server...
				</option>
				{servers.map((server) => (
					<option key={server.clientIdentifier} value={server.clientIdentifier}>
						{server.name}
					</option>
				))}
			</select>
		</div>
	);
};

const PlexNotConnected = () => {
	const [startAuth, { isLoading: isStarting }] = useStartPlexAuthMutation();
	const [triggerCheck] = useLazyCheckPlexAuthQuery();
	const [polling, setPolling] = useState(false);
	const [error, setError] = useState("");
	const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(
		() => () => {
			if (pollRef.current) {
				clearTimeout(pollRef.current);
			}
		},
		[],
	);

	const handleConnect = useCallback(async () => {
		setError("");
		const result = await startAuth();
		if ("error" in result) {
			setError("Failed to start Plex authentication");
			return;
		}

		const { pinId, authUrl } = result.data;
		window.open(authUrl, "_blank");
		setPolling(true);

		let polls = 0;
		const poll = async () => {
			if (polls >= MAX_POLLS) {
				setPolling(false);
				setError("Authentication timed out. Please try again.");
				return;
			}
			polls += POLL_INCREMENT;
			const check = await triggerCheck(pinId);
			if (check.data?.claimed) {
				setPolling(false);
				return;
			}
			pollRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
		};

		await poll();
	}, [startAuth, triggerCheck]);

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>Plex Connection</h3>
			<p className={statusText}>Connect your Plex account to get personalized recommendations.</p>
			<div className={buttonRow}>
				<button
					type="button"
					className={primaryButton}
					onClick={handleConnect}
					disabled={isStarting || polling}
				>
					{polling ? "Waiting for authentication..." : "Connect Plex"}
				</button>
			</div>
			{error && <p className={errorText}>{error}</p>}
		</div>
	);
};

const ServerStatus = ({ serverName }: { serverName: string }) => (
	<div className={connectedInfo}>
		<span className={statusDot} />
		<span className={connectedLabel}>{serverName}</span>
	</div>
);

interface PlexConnectedProps {
	serverName: string;
	onDisconnect: () => void;
	isDisconnecting: boolean;
}

const PlexConnectedCard = ({ serverName, onDisconnect, isDisconnecting }: PlexConnectedProps) => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>Plex Connection</h3>
		<div className={connectedRow}>
			<ServerStatus serverName={serverName} />
			<button
				type="button"
				className={dangerButton}
				onClick={onDisconnect}
				disabled={isDisconnecting}
			>
				{isDisconnecting ? "Disconnecting..." : "Disconnect"}
			</button>
		</div>
	</div>
);

const PlexServerSelection = () => {
	const { data, isLoading } = useGetPlexServersQuery();
	const [selectServer, { isLoading: isSelecting }] = useSelectPlexServerMutation();

	const handleSelect = useCallback(
		async (server: PlexServer) => {
			await selectServer({
				serverUrl: server.uri,
				serverName: server.name,
				machineIdentifier: server.clientIdentifier,
			});
		},
		[selectServer],
	);

	const servers = useMemo(() => data?.servers ?? [], [data?.servers]);

	if (isLoading) {
		return (
			<div className={sectionCard}>
				<h3 className={sectionTitle}>Select Plex Server</h3>
				<p className={statusText}>Loading servers...</p>
			</div>
		);
	}

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>Select Plex Server</h3>
			<ServerSelect servers={servers} onSelect={handleSelect} isLoading={isSelecting} />
		</div>
	);
};

const PlexTab = () => {
	const { data, isLoading, isError } = useGetPlexServersQuery();
	const [disconnect, { isLoading: isDisconnecting }] = useDisconnectPlexMutation();

	const handleDisconnect = useCallback(async () => {
		await disconnect();
	}, [disconnect]);

	if (isLoading) {
		return <p className={statusText}>Loading Plex connection status...</p>;
	}

	if (isError) {
		return <PlexNotConnected />;
	}

	const servers = data?.servers ?? [];
	const selectedServer = servers.find((server) => server.owned);

	if (servers.length > NO_SERVERS && !selectedServer) {
		return <PlexServerSelection />;
	}

	if (selectedServer) {
		return (
			<PlexConnectedCard
				serverName={selectedServer.name}
				onDisconnect={handleDisconnect}
				isDisconnecting={isDisconnecting}
			/>
		);
	}

	return <PlexNotConnected />;
};

/* ── AI Configuration tab ─────────────────────────────────── */

interface TemperatureSliderProps {
	temperature: number;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const TemperatureSlider = ({ temperature, onChange }: TemperatureSliderProps) => (
	<div className={rangeWrapper}>
		<input
			id="temperature"
			type="range"
			min={TEMP_MIN}
			max={TEMP_MAX}
			step={TEMP_STEP}
			value={temperature}
			onChange={onChange}
			className={rangeInput}
		/>
		<span className={rangeValue}>{temperature}</span>
	</div>
);

interface AdvancedAiFieldsProps {
	temperature: number;
	maxTokens: string;
	onTemperatureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onMaxTokensChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const AdvancedAiFields = ({
	temperature,
	maxTokens,
	onTemperatureChange,
	onMaxTokensChange,
}: AdvancedAiFieldsProps) => (
	<div>
		<div className={fieldGroup}>
			<label htmlFor="temperature" className={labelStyle}>
				Temperature
			</label>
			<TemperatureSlider temperature={temperature} onChange={onTemperatureChange} />
		</div>
		<SettingsField
			id="maxTokens"
			label="Max Tokens"
			type="number"
			value={maxTokens}
			onChange={onMaxTokensChange}
		/>
	</div>
);

const AiTab = () => {
	const { data: config, isError } = useGetAiConfigQuery();
	const [updateConfig, { isLoading: isSaving }] = useUpdateAiConfigMutation();
	const [deleteConfig, { isLoading: isDeleting }] = useDeleteAiConfigMutation();
	const [testConnection, { isLoading: isTesting }] = useTestAiConnectionMutation();
	const [testResult, setTestResult] = useState<{ error?: string; success: boolean } | undefined>(
		undefined,
	);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const [endpointUrl, setEndpointUrl] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [modelName, setModelName] = useState("");
	const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
	const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_TOKENS));

	useEffect(() => {
		if (config) {
			setEndpointUrl(config.endpointUrl);
			setApiKey(config.apiKey);
			setModelName(config.modelName);
			setTemperature(config.temperature);
			setMaxTokens(String(config.maxTokens));
		}
	}, [config]);

	const handleSave = useCallback(async () => {
		await updateConfig({
			endpointUrl,
			apiKey,
			modelName,
			temperature,
			maxTokens: Number(maxTokens),
		});
	}, [endpointUrl, apiKey, modelName, temperature, maxTokens, updateConfig]);

	const handleTest = useCallback(async () => {
		setTestResult(undefined);
		const result = await testConnection();
		if ("data" in result && result.data) {
			setTestResult(result.data);
		} else {
			setTestResult({ success: false, error: "Failed to test connection" });
		}
	}, [testConnection]);

	const handleDelete = useCallback(async () => {
		await deleteConfig();
		setEndpointUrl("");
		setApiKey("");
		setModelName("");
		setTemperature(DEFAULT_TEMPERATURE);
		setMaxTokens(String(DEFAULT_MAX_TOKENS));
	}, [deleteConfig]);

	const toggleAdvanced = useCallback(() => {
		setShowAdvanced((prev) => !prev);
	}, []);

	const handleEndpointChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setEndpointUrl(event.target.value);
	}, []);

	const handleApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setApiKey(event.target.value);
	}, []);

	const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setModelName(event.target.value);
	}, []);

	const handleTemperatureChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setTemperature(Number(event.target.value));
	}, []);

	const handleMaxTokensChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setMaxTokens(event.target.value);
	}, []);

	const hasConfig = !isError && Boolean(config);

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>AI Configuration</h3>
			<SettingsField
				id="endpointUrl"
				label="Endpoint URL"
				value={endpointUrl}
				onChange={handleEndpointChange}
				placeholder="https://api.openai.com/v1"
			/>
			<SettingsField
				id="apiKey"
				label="API Key"
				type="password"
				value={apiKey}
				onChange={handleApiKeyChange}
				placeholder="sk-..."
			/>
			<SettingsField
				id="modelName"
				label="Model Name"
				value={modelName}
				onChange={handleModelChange}
				placeholder="gpt-4"
			/>
			<button type="button" className={collapsibleHeader} onClick={toggleAdvanced}>
				{showAdvanced ? "Hide" : "Show"} Advanced Settings
			</button>
			{showAdvanced && (
				<div className={collapsibleContent}>
					<AdvancedAiFields
						temperature={temperature}
						maxTokens={maxTokens}
						onTemperatureChange={handleTemperatureChange}
						onMaxTokensChange={handleMaxTokensChange}
					/>
				</div>
			)}
			<AiTabButtons
				hasConfig={hasConfig}
				isSaving={isSaving}
				isTesting={isTesting}
				isDeleting={isDeleting}
				onSave={handleSave}
				onTest={handleTest}
				onDelete={handleDelete}
			/>
			{testResult && <AiTestResultMessage result={testResult} />}
		</div>
	);
};

interface AiTabButtonsProps {
	hasConfig: boolean;
	isSaving: boolean;
	isTesting: boolean;
	isDeleting: boolean;
	onSave: () => void;
	onTest: () => void;
	onDelete: () => void;
}

const AiTabButtons = ({
	hasConfig,
	isSaving,
	isTesting,
	isDeleting,
	onSave,
	onTest,
	onDelete,
}: AiTabButtonsProps) => (
	<div className={buttonRow}>
		<button type="button" className={primaryButton} onClick={onSave} disabled={isSaving}>
			{isSaving ? "Saving..." : "Save"}
		</button>
		{hasConfig && (
			<button type="button" className={secondaryButton} onClick={onTest} disabled={isTesting}>
				{isTesting ? "Testing..." : "Test Connection"}
			</button>
		)}
		{hasConfig && (
			<button type="button" className={dangerButton} onClick={onDelete} disabled={isDeleting}>
				{isDeleting ? "Removing..." : "Remove"}
			</button>
		)}
	</div>
);

const AiTestResultMessage = ({ result }: { result: { error?: string; success: boolean } }) => {
	if (result.success) {
		return <p className={successText}>Connection successful!</p>;
	}
	return <p className={errorText}>{result.error ?? "Connection failed"}</p>;
};

/* ── Account tab ───────────────────────────────────────────── */

const noopChange = () => {};

const AccountTab = () => (
	<div className={sectionCard}>
		<h3 className={sectionTitle}>
			Change Password
			<span className={comingSoonLabel}>Coming Soon</span>
		</h3>
		<SettingsField
			id="currentPassword"
			label="Current Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<SettingsField
			id="newPassword"
			label="New Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<SettingsField
			id="confirmPassword"
			label="Confirm Password"
			type="password"
			value=""
			onChange={noopChange}
			disabled
		/>
		<div className={buttonRow}>
			<button type="button" className={primaryButton} disabled>
				Update Password
			</button>
		</div>
	</div>
);

/* ── Integrations tab ──────────────────────────────────────── */

const IntegrationsTab = () => (
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

/* ── Tab content router ────────────────────────────────────── */

const TabContent = ({ tab }: { tab: SettingsTab }) => {
	if (tab === "plex") {
		return <PlexTab />;
	}
	if (tab === "ai") {
		return <AiTab />;
	}
	if (tab === "account") {
		return <AccountTab />;
	}
	return <IntegrationsTab />;
};

/* ── Main Settings component ───────────────────────────────── */

const Settings = () => {
	const [activeTab, setActiveTab] = useState<SettingsTab>("plex");

	return (
		<div className={pageWrapper}>
			<h1 className={pageTitle}>Settings</h1>
			<SettingsTabBar activeTab={activeTab} onTabChange={setActiveTab} />
			<TabContent tab={activeTab} />
		</div>
	);
};

interface SettingsTabBarProps {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
}

const SettingsTabBar = ({ activeTab, onTabChange }: SettingsTabBarProps) => (
	<div className={tabBar}>
		{TABS.map((tab) => (
			<TabButton
				key={tab.id}
				id={tab.id}
				label={tab.label}
				isActive={activeTab === tab.id}
				onClick={onTabChange}
			/>
		))}
	</div>
);

export { Settings };
