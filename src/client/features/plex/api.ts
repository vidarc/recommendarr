import { api } from "../../api.ts";

interface PlexAuthStart {
	pinId: number;
	authUrl: string;
}

interface PlexAuthCheck {
	claimed: boolean;
}

interface PlexServer {
	name: string;
	address: string;
	port: number;
	scheme: string;
	uri: string;
	clientIdentifier: string;
	owned: boolean;
}

interface PlexServersResponse {
	servers: PlexServer[];
}

interface SelectPlexServerBody {
	serverUrl: string;
	serverName: string;
	machineIdentifier: string;
}

interface PlexLibrary {
	key: string;
	title: string;
	type: string;
}

interface PlexLibrariesResponse {
	libraries: PlexLibrary[];
}

const plexApi = api.injectEndpoints({
	endpoints: (builder) => ({
		startPlexAuth: builder.mutation<PlexAuthStart, void>({
			query: () => ({
				url: "api/plex/auth/start",
				method: "POST",
			}),
		}),
		checkPlexAuth: builder.query<PlexAuthCheck, number>({
			query: (pinId) => `api/plex/auth/check?pinId=${String(pinId)}`,
		}),
		getPlexServers: builder.query<PlexServersResponse, void>({
			query: () => "api/plex/servers",
			providesTags: ["PlexConnection"],
		}),
		selectPlexServer: builder.mutation<{ success: boolean }, SelectPlexServerBody>({
			query: (body) => ({
				url: "api/plex/servers/select",
				method: "POST",
				body,
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		disconnectPlex: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/plex/connection",
				method: "DELETE",
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
} = plexApi;

export {
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
	useGetPlexServersQuery,
	useLazyCheckPlexAuthQuery,
	useSelectPlexServerMutation,
	useStartPlexAuthMutation,
};
export type { PlexServer };
