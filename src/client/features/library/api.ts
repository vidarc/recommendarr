import { api } from "../../api.ts";

interface LibraryStatus {
	lastSynced: string | undefined;
	interval: string;
	itemCount: number;
	movieCount: number;
	showCount: number;
	excludeDefault: boolean;
}

interface SyncResponse {
	movieCount: number;
	showCount: number;
	totalCount: number;
}

interface LibrarySettingsBody {
	interval: string;
	excludeDefault: boolean;
}

const libraryApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getLibraryStatus: builder.query<LibraryStatus, void>({
			query: () => "api/library/status",
			providesTags: ["Library"],
		}),
		syncLibrary: builder.mutation<SyncResponse, void>({
			query: () => ({
				url: "api/library/sync",
				method: "POST",
			}),
			invalidatesTags: ["Library"],
		}),
		updateLibrarySettings: builder.mutation<LibraryStatus, LibrarySettingsBody>({
			query: (body) => ({
				url: "api/library/settings",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["Library"],
		}),
	}),
});

const { useGetLibraryStatusQuery, useSyncLibraryMutation, useUpdateLibrarySettingsMutation } =
	libraryApi;

export { useGetLibraryStatusQuery, useSyncLibraryMutation, useUpdateLibrarySettingsMutation };
