import { api } from "../../api.ts";

import type { SuccessResponse } from "@shared/schemas/common";
import type {
	LibrarySettingsBody,
	LibraryStatus,
	LibrarySyncResponse,
} from "@shared/schemas/library";

const libraryApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getLibraryStatus: builder.query<LibraryStatus, void>({
			query: () => "api/library/status",
			providesTags: ["Library"],
		}),
		syncLibrary: builder.mutation<LibrarySyncResponse, void>({
			query: () => ({
				url: "api/library/sync",
				method: "POST",
			}),
			invalidatesTags: ["Library"],
		}),
		updateLibrarySettings: builder.mutation<SuccessResponse, LibrarySettingsBody>({
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
