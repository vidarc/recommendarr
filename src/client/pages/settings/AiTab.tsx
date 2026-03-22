import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { useAiConfig } from "../../hooks/use-ai-config.ts";
import { colors, spacing } from "../../theme.ts";
import {
	buttonRow,
	dangerButton,
	errorText,
	fieldGroup,
	labelStyle,
	primaryButton,
	secondaryButton,
	sectionCard,
	sectionTitle,
	successText,
} from "./settings-styles.ts";
import { SettingsField } from "./SettingsField.tsx";

const TEMP_STEP = 0.1;
const TEMP_MIN = 0;
const TEMP_MAX = 2;

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

/* ── Sub-components ────────────────────────────────────────── */

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

/* ── Main AiTab ────────────────────────────────────────────── */

export const AiTab = () => {
	const config = useAiConfig();
	const [showAdvanced, setShowAdvanced] = useState(false);

	const toggleAdvanced = useCallback(() => {
		setShowAdvanced((prev) => !prev);
	}, []);

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>AI Configuration</h3>
			<SettingsField
				id="endpointUrl"
				label="Endpoint URL"
				value={config.endpointUrl}
				onChange={config.handleEndpointChange}
				placeholder="https://api.openai.com/v1"
			/>
			<SettingsField
				id="apiKey"
				label="API Key"
				type="password"
				value={config.apiKey}
				onChange={config.handleApiKeyChange}
				placeholder="sk-..."
			/>
			<SettingsField
				id="modelName"
				label="Model Name"
				value={config.modelName}
				onChange={config.handleModelChange}
				placeholder="gpt-4"
			/>
			<button type="button" className={collapsibleHeader} onClick={toggleAdvanced}>
				{showAdvanced ? "Hide" : "Show"} Advanced Settings
			</button>
			{showAdvanced && (
				<div className={collapsibleContent}>
					<AdvancedAiFields
						temperature={config.temperature}
						maxTokens={config.maxTokens}
						onTemperatureChange={config.handleTemperatureChange}
						onMaxTokensChange={config.handleMaxTokensChange}
					/>
				</div>
			)}
			<AiTabButtons
				hasConfig={config.hasConfig}
				isSaving={config.isSaving}
				isTesting={config.isTesting}
				isDeleting={config.isDeleting}
				onSave={config.handleSave}
				onTest={config.handleTest}
				onDelete={config.handleRemove}
			/>
			{config.testResult && <AiTestResultMessage result={config.testResult} />}
		</div>
	);
};
