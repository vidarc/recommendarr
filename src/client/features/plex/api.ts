import { api } from "../../api.ts";

import type { SuccessResponse } from "@shared/schemas/common";
import type {
	PlexAuthCheckResponse,
	PlexAuthStartResponse,
	PlexLibrariesResponse,
	PlexManualAuthBody,
	PlexSelectServerBody,
	PlexServersResponse,
} from "@shared/schemas/plex";

const plexApi = api.injectEndpoints({
	endpoints: (builder) => ({
		startPlexAuth: builder.mutation<PlexAuthStartResponse, void>({
			query: () => ({
				url: "api/plex/auth/start",
				method: "POST",
			}),
		}),
		checkPlexAuth: builder.query<PlexAuthCheckResponse, number>({
			query: (pinId) => `api/plex/auth/check?pinId=${String(pinId)}`,
		}),
		getPlexServers: builder.query<PlexServersResponse, void>({
			query: () => "api/plex/servers",
			providesTags: ["PlexConnection"],
		}),
		selectPlexServer: builder.mutation<SuccessResponse, PlexSelectServerBody>({
			query: (body) => ({
				url: "api/plex/servers/select",
				method: "POST",
				body,
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		disconnectPlex: builder.mutation<SuccessResponse, void>({
			query: () => ({
				url: "api/plex/connection",
				method: "DELETE",
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		manualPlexAuth: builder.mutation<SuccessResponse, PlexManualAuthBody>({
			query: (body) => ({
				url: "api/plex/auth/manual",
				method: "POST",
				body,
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		getPlexLibraries: builder.query<PlexLibrariesResponse, void>({
			query: () => "api/plex/libraries",
			providesTags: ["PlexConnection"],
		}),
	}),
});

const {
	useStartPlexAuthMutation,
	useLazyCheckPlexAuthQuery,
	useGetPlexServersQuery,
	useSelectPlexServerMutation,
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
	useManualPlexAuthMutation,
} = plexApi;

export {
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
	useGetPlexServersQuery,
	useLazyCheckPlexAuthQuery,
	useManualPlexAuthMutation,
	useSelectPlexServerMutation,
	useStartPlexAuthMutation,
};
