import { librarySyncIntervalSchema } from "@shared/schemas/library";
import { useCallback, useEffect, useState } from "react";

import {
	useGetLibraryStatusQuery,
	useSyncLibraryMutation,
	useUpdateLibrarySettingsMutation,
} from "../features/library/api.ts";

import type { LibrarySyncInterval } from "@shared/schemas/library";
import type { ChangeEvent } from "react";

const DEFAULT_INTERVAL: LibrarySyncInterval = "manual";

export const useLibrarySettings = () => {
	const { data: status } = useGetLibraryStatusQuery();
	const [syncLibrary, { isLoading: isSyncing }] = useSyncLibraryMutation();
	const [updateSettings, { isLoading: isSaving }] = useUpdateLibrarySettingsMutation();

	const [syncInterval, setSyncInterval] = useState<LibrarySyncInterval>(DEFAULT_INTERVAL);
	const [excludeDefault, setExcludeDefault] = useState(false);
	const [syncResult, setSyncResult] = useState("");

	useEffect(() => {
		if (status) {
			setSyncInterval(status.interval);
			setExcludeDefault(status.excludeDefault);
		}
	}, [status]);

	const handleIntervalChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const parsed = librarySyncIntervalSchema.safeParse(event.target.value);
		if (parsed.success) {
			setSyncInterval(parsed.data);
		}
	}, []);

	const handleExcludeToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setExcludeDefault(event.target.checked);
	}, []);

	const handleSync = useCallback(async () => {
		setSyncResult("");
		const result = await syncLibrary();
		if ("data" in result && result.data) {
			setSyncResult(
				`Synced successfully: ${result.data.movieCount} movies, ${result.data.showCount} shows`,
			);
		} else {
			setSyncResult("Sync failed. Please try again.");
		}
	}, [syncLibrary]);

	const handleSave = useCallback(async () => {
		await updateSettings({ interval: syncInterval, excludeDefault });
	}, [updateSettings, syncInterval, excludeDefault]);

	return {
		status,
		interval: syncInterval,
		excludeDefault,
		syncResult,
		isSyncing,
		isSaving,
		handleIntervalChange,
		handleExcludeToggle,
		handleSync,
		handleSave,
	};
};
