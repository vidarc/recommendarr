import { useCallback, useEffect, useState } from "react";

import {
	useDeleteArrConfigMutation,
	useGetArrConfigQuery,
	useTestArrConnectionMutation,
	useUpdateArrConfigMutation,
} from "../features/arr/api.ts";

import type { ChangeEvent } from "react";

type ServiceType = "radarr" | "sonarr";

interface ServiceState {
	url: string;
	apiKey: string;
}

const DEFAULT_STATE: ServiceState = { url: "", apiKey: "" };

const useArrConfig = () => {
	const { data: connections } = useGetArrConfigQuery();
	const [updateConfig] = useUpdateArrConfigMutation();
	const [deleteConfig] = useDeleteArrConfigMutation();
	const [testConnection] = useTestArrConnectionMutation();
	const [activeAction, setActiveAction] = useState<string | undefined>(undefined);

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
			setActiveAction(`saving-${serviceType}`);
			try {
				await updateConfig({ serviceType, url: state.url, apiKey: state.apiKey });
			} finally {
				setActiveAction(undefined);
			}
		},
		[radarr, sonarr, updateConfig],
	);

	const handleTestFor = useCallback(
		async (serviceType: ServiceType) => {
			setTestResult((prev) => ({ ...prev, [serviceType]: "" }));
			setActiveAction(`testing-${serviceType}`);
			try {
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
			} finally {
				setActiveAction(undefined);
			}
		},
		[testConnection],
	);

	const handleRemoveFor = useCallback(
		async (serviceType: ServiceType) => {
			setActiveAction(`deleting-${serviceType}`);
			try {
				await deleteConfig(serviceType);
				if (serviceType === "radarr") {
					setRadarr(DEFAULT_STATE);
				} else {
					setSonarr(DEFAULT_STATE);
				}
				setTestResult((prev) => ({ ...prev, [serviceType]: "" }));
			} finally {
				setActiveAction(undefined);
			}
		},
		[deleteConfig],
	);

	const handleSaveRadarr = useCallback(async () => handleSaveFor("radarr"), [handleSaveFor]);
	const handleSaveSonarr = useCallback(async () => handleSaveFor("sonarr"), [handleSaveFor]);
	const handleTestRadarr = useCallback(async () => handleTestFor("radarr"), [handleTestFor]);
	const handleTestSonarr = useCallback(async () => handleTestFor("sonarr"), [handleTestFor]);
	const handleRemoveRadarr = useCallback(async () => handleRemoveFor("radarr"), [handleRemoveFor]);
	const handleRemoveSonarr = useCallback(async () => handleRemoveFor("sonarr"), [handleRemoveFor]);

	const handleRadarrUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setRadarr((prev) => ({ ...prev, url: event.target.value }));
	}, []);

	const handleRadarrApiKeyChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setRadarr((prev) => ({ ...prev, apiKey: event.target.value }));
	}, []);

	const handleSonarrUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSonarr((prev) => ({ ...prev, url: event.target.value }));
	}, []);

	const handleSonarrApiKeyChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
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

	const isSavingRadarr = activeAction === "saving-radarr";
	const isSavingSonarr = activeAction === "saving-sonarr";
	const isTestingRadarr = activeAction === "testing-radarr";
	const isTestingSonarr = activeAction === "testing-sonarr";
	const isDeletingRadarr = activeAction === "deleting-radarr";
	const isDeletingSonarr = activeAction === "deleting-sonarr";

	return {
		radarr,
		sonarr,
		testResult,
		isSavingRadarr,
		isSavingSonarr,
		isTestingRadarr,
		isTestingSonarr,
		isDeletingRadarr,
		isDeletingSonarr,
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
