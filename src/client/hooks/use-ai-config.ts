import { useCallback, useEffect, useState } from "react";

import {
	useDeleteAiConfigMutation,
	useGetAiConfigQuery,
	useTestAiConnectionMutation,
	useUpdateAiConfigMutation,
} from "../api.ts";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

export const useAiConfig = () => {
	const { data: config, isError } = useGetAiConfigQuery();
	const [updateConfig, { isLoading: isSaving }] = useUpdateAiConfigMutation();
	const [deleteConfig, { isLoading: isDeleting }] = useDeleteAiConfigMutation();
	const [testConnection, { isLoading: isTesting }] = useTestAiConnectionMutation();
	const [testResult, setTestResult] = useState<{ error?: string; success: boolean } | undefined>(
		undefined,
	);

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
		const result = await testConnection({
			endpointUrl,
			apiKey,
			modelName,
			temperature,
			maxTokens: Number(maxTokens),
		});
		if ("data" in result && result.data) {
			setTestResult(result.data);
		} else {
			setTestResult({ success: false, error: "Failed to test connection" });
		}
	}, [testConnection, endpointUrl, apiKey, modelName, temperature, maxTokens]);

	const handleRemove = useCallback(async () => {
		await deleteConfig();
		setEndpointUrl("");
		setApiKey("");
		setModelName("");
		setTemperature(DEFAULT_TEMPERATURE);
		setMaxTokens(String(DEFAULT_MAX_TOKENS));
	}, [deleteConfig]);

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

	return {
		endpointUrl,
		apiKey,
		modelName,
		temperature,
		maxTokens,
		hasConfig,
		isSaving,
		isTesting,
		isDeleting,
		testResult,
		handleSave,
		handleTest,
		handleRemove,
		handleEndpointChange,
		handleApiKeyChange,
		handleModelChange,
		handleTemperatureChange,
		handleMaxTokensChange,
	};
};
