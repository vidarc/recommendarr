import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

interface User {
	id: string;
	username: string;
	isAdmin: boolean;
}

interface Settings {
	[key: string]: string;
}

interface Credentials {
	username: string;
	password: string;
}

interface SetupStatus {
	needsSetup: boolean;
}

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

interface AiConfig {
	endpointUrl: string;
	apiKey: string;
	modelName: string;
	temperature: number;
	maxTokens: number;
}

interface AiTestResult {
	success: boolean;
	error?: string;
}

const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
	tagTypes: ["PlexConnection", "AiConfig"],
	endpoints: (builder) => ({
		getSettings: builder.query<Settings, void>({
			query: () => "api/settings",
		}),
		getSetupStatus: builder.query<SetupStatus, void>({
			query: () => "api/auth/setup-status",
		}),
		login: builder.mutation<User, Credentials>({
			query: (body) => ({
				url: "api/auth/login",
				method: "POST",
				body,
			}),
		}),
		register: builder.mutation<User, Credentials>({
			query: (body) => ({
				url: "api/auth/register",
				method: "POST",
				body,
			}),
		}),
		getMe: builder.query<User, void>({
			query: () => "api/auth/me",
		}),
		logout: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/auth/logout",
				method: "POST",
			}),
		}),
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
		getAiConfig: builder.query<AiConfig, void>({
			query: () => "api/ai/config",
			providesTags: ["AiConfig"],
		}),
		updateAiConfig: builder.mutation<{ success: boolean }, AiConfig>({
			query: (body) => ({
				url: "api/ai/config",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["AiConfig"],
		}),
		deleteAiConfig: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/ai/config",
				method: "DELETE",
			}),
			invalidatesTags: ["AiConfig"],
		}),
		testAiConnection: builder.mutation<AiTestResult, void>({
			query: () => ({
				url: "api/ai/test",
				method: "POST",
			}),
		}),
	}),
});

const {
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLoginMutation,
	useRegisterMutation,
	useGetMeQuery,
	useLogoutMutation,
	useStartPlexAuthMutation,
	useLazyCheckPlexAuthQuery,
	useGetPlexServersQuery,
	useSelectPlexServerMutation,
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
	useGetAiConfigQuery,
	useUpdateAiConfigMutation,
	useDeleteAiConfigMutation,
	useTestAiConnectionMutation,
} = api;

export {
	api,
	useDeleteAiConfigMutation,
	useDisconnectPlexMutation,
	useGetAiConfigQuery,
	useGetMeQuery,
	useGetPlexLibrariesQuery,
	useGetPlexServersQuery,
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLazyCheckPlexAuthQuery,
	useLoginMutation,
	useLogoutMutation,
	useRegisterMutation,
	useSelectPlexServerMutation,
	useStartPlexAuthMutation,
	useTestAiConnectionMutation,
	useUpdateAiConfigMutation,
};
export type { AiConfig, PlexServer, User };
