import { useCallback, useEffect, useState } from "react";

import {
	useDeleteArrConfigMutation,
	useGetArrConfigQuery,
	useTestArrConnectionMutation,
	useUpdateArrConfigMutation,
} from "../api.ts";

type ServiceType = "radarr" | "sonarr";

interface ServiceState {
	url: string;
	apiKey: string;
}

const DEFAULT_STATE: ServiceState = { url: "", apiKey: "" };

const useArrConfig = () => {
	const { data: connections } = useGetArrConfigQuery();
	const [updateConfig, { isLoading: isSaving }] = useUpdateArrConfigMutation();
	const [deleteConfig, { isLoading: isDeleting }] = useDeleteArrConfigMutation();
	const [testConnection, { isLoading: isTesting }] = useTestArrConnectionMutation();

	const [radarr, setRadarr] = useState<ServiceState>(DEFAULT_STATE);
	const [sonarr, setSonarr] = useState<ServiceState>(DEFAULT_STATE);
	const [testResult, setTestResult] = useState<Record<string, string>>({});

	useEffect(() => {
		if (connections) {
			for (const conn of connections) {
				if (conn.serviceType === "radarr") {
					setRadarr({ url: conn.url, apiKey: conn.apiKey });
				} else if (conn.serviceType === "sonarr") {
					setSonarr({ url: conn.url, apiKey: conn.apiKey });
				}
			}
		}
	}, [connections]);

	const handleSaveFor = useCallback(
		async (serviceType: ServiceType) => {
			const state = serviceType === "radarr" ? radarr : sonarr;
			await updateConfig({ serviceType, url: state.url, apiKey: state.apiKey });
		},
		[radarr, sonarr, updateConfig],
	);

	const handleTestFor = useCallback(
		async (serviceType: ServiceType) => {
			setTestResult((prev) => ({ ...prev, [serviceType]: "" }));
			const result = await testConnection({ serviceType });
			if ("data" in result && result.data) {
				const { success, version, error } = result.data;
				const message = success
					? `Connection successful${version ? ` (${version})` : ""}`
					: `Connection failed: ${error ?? "Unknown error"}`;
				setTestResult((prev) => ({ ...prev, [serviceType]: message }));
			} else {
				setTestResult((prev) => ({
					...prev,
					[serviceType]: "Connection failed: Unknown error",
				}));
			}
		},
		[testConnection],
	);

	const handleRemoveFor = useCallback(
		async (serviceType: ServiceType) => {
			await deleteConfig(serviceType);
			if (serviceType === "radarr") {
				setRadarr(DEFAULT_STATE);
			} else {
				setSonarr(DEFAULT_STATE);
			}
			setTestResult((prev) => ({ ...prev, [serviceType]: "" }));
		},
		[deleteConfig],
	);

	const handleSaveRadarr = useCallback(async () => handleSaveFor("radarr"), [handleSaveFor]);
	const handleSaveSonarr = useCallback(async () => handleSaveFor("sonarr"), [handleSaveFor]);
	const handleTestRadarr = useCallback(async () => handleTestFor("radarr"), [handleTestFor]);
	const handleTestSonarr = useCallback(async () => handleTestFor("sonarr"), [handleTestFor]);
	const handleRemoveRadarr = useCallback(async () => handleRemoveFor("radarr"), [handleRemoveFor]);
	const handleRemoveSonarr = useCallback(async () => handleRemoveFor("sonarr"), [handleRemoveFor]);

	const handleRadarrUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setRadarr((prev) => ({ ...prev, url: event.target.value }));
	}, []);

	const handleRadarrApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setRadarr((prev) => ({ ...prev, apiKey: event.target.value }));
	}, []);

	const handleSonarrUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setSonarr((prev) => ({ ...prev, url: event.target.value }));
	}, []);

	const handleSonarrApiKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setSonarr((prev) => ({ ...prev, apiKey: event.target.value }));
	}, []);

	const isConnected = useCallback(
		(serviceType: ServiceType): boolean => {
			if (!connections) {
				return false;
			}
			return connections.some((conn) => conn.serviceType === serviceType);
		},
		[connections],
	);

	return {
		radarr,
		sonarr,
		testResult,
		isSaving,
		isTesting,
		isDeleting,
		handleRadarrUrlChange,
		handleRadarrApiKeyChange,
		handleSonarrUrlChange,
		handleSonarrApiKeyChange,
		handleSaveRadarr,
		handleSaveSonarr,
		handleTestRadarr,
		handleTestSonarr,
		handleRemoveRadarr,
		handleRemoveSonarr,
		isConnected,
	};
};

export { useArrConfig };
