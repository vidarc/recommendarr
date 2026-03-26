import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

interface User {
	id: string;
	username: string;
	isAdmin: boolean;
}

type Settings = Record<string, string>;

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

interface Recommendation {
	id: string;
	title: string;
	year?: number;
	mediaType: string;
	synopsis?: string;
	tmdbId?: number;
	addedToArr: boolean;
}

interface ChatMessageResponse {
	id: string;
	content: string;
	role: string;
	createdAt: string;
	recommendations: Recommendation[];
}

interface SendChatMessageBody {
	message: string;
	mediaType: string;
	resultCount: number;
	conversationId?: string | undefined;
	libraryIds?: string[] | undefined;
}

interface SendChatMessageResponse {
	conversationId: string;
	message: ChatMessageResponse;
}

interface ConversationSummary {
	id: string;
	title: string;
	mediaType: string;
	createdAt: string;
}

interface ConversationsResponse {
	conversations: ConversationSummary[];
}

interface ConversationDetail {
	conversation: {
		id: string;
		title: string;
		mediaType: string;
		createdAt: string;
		messages: ChatMessageResponse[];
	};
}

interface DeleteConversationResponse {
	success: boolean;
}

interface ArrConnection {
	id: string;
	serviceType: "radarr" | "sonarr";
	url: string;
	apiKey: string;
}

interface ArrOptions {
	rootFolders: { id: number; path: string; freeSpace: number }[];
	qualityProfiles: { id: number; name: string }[];
}

interface ArrLookupResult {
	title: string;
	year: number;
	tmdbId?: number;
	tvdbId?: number;
	overview: string;
	existsInLibrary: boolean;
	arrId: number;
}

interface ArrTestResult {
	success: boolean;
	version?: string;
	error?: string;
}

interface AddToArrParams {
	serviceType: "radarr" | "sonarr";
	recommendationId: string;
	tmdbId?: number;
	tvdbId?: number;
	title: string;
	year: number;
	qualityProfileId: number;
	rootFolderPath: string;
}

const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
	tagTypes: ["PlexConnection", "AiConfig", "ArrConfig", "Conversations"],
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
		testAiConnection: builder.mutation<AiTestResult, AiConfig | void>({
			query: (body) => ({
				url: "api/ai/test",
				method: "POST",
				body: body ?? undefined,
			}),
		}),
		sendChatMessage: builder.mutation<SendChatMessageResponse, SendChatMessageBody>({
			query: (body) => ({
				url: "api/chat",
				method: "POST",
				body,
			}),
			invalidatesTags: ["Conversations"],
		}),
		getConversations: builder.query<ConversationsResponse, void>({
			query: () => "api/conversations",
			providesTags: ["Conversations"],
		}),
		getConversation: builder.query<ConversationDetail, string>({
			query: (id) => `api/conversations/${id}`,
			providesTags: ["Conversations"],
		}),
		deleteConversation: builder.mutation<DeleteConversationResponse, string>({
			query: (id) => ({
				url: `api/conversations/${id}`,
				method: "DELETE",
			}),
			invalidatesTags: ["Conversations"],
		}),
		getArrConfig: builder.query<ArrConnection[], void>({
			query: () => "api/arr/config",
			providesTags: ["ArrConfig"],
		}),
		updateArrConfig: builder.mutation<
			{ success: boolean },
			{ serviceType: string; url: string; apiKey: string }
		>({
			query: ({ serviceType, ...body }) => ({
				url: `api/arr/config/${serviceType}`,
				method: "PUT",
				body,
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		deleteArrConfig: builder.mutation<{ success: boolean }, string>({
			query: (serviceType) => ({
				url: `api/arr/config/${serviceType}`,
				method: "DELETE",
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		testArrConnection: builder.mutation<ArrTestResult, { serviceType: string }>({
			query: (body) => ({
				url: "api/arr/test",
				method: "POST",
				body,
			}),
		}),
		getArrOptions: builder.query<ArrOptions, string>({
			query: (serviceType) => `api/arr/options/${serviceType}`,
		}),
		arrLookup: builder.mutation<
			ArrLookupResult[],
			{ serviceType: string; title: string; year?: number }
		>({
			query: (body) => ({
				url: "api/arr/lookup",
				method: "POST",
				body,
			}),
		}),
		addToArr: builder.mutation<{ success: boolean; error?: string }, AddToArrParams>({
			query: (body) => ({
				url: "api/arr/add",
				method: "POST",
				body,
			}),
			invalidatesTags: ["Conversations"],
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
	useSendChatMessageMutation,
	useGetConversationsQuery,
	useGetConversationQuery,
	useDeleteConversationMutation,
	useGetArrConfigQuery,
	useUpdateArrConfigMutation,
	useDeleteArrConfigMutation,
	useTestArrConnectionMutation,
	useLazyGetArrOptionsQuery,
	useArrLookupMutation,
	useAddToArrMutation,
} = api;

export {
	api,
	useAddToArrMutation,
	useArrLookupMutation,
	useDeleteAiConfigMutation,
	useDeleteArrConfigMutation,
	useDeleteConversationMutation,
	useDisconnectPlexMutation,
	useGetAiConfigQuery,
	useGetArrConfigQuery,
	useGetConversationQuery,
	useGetConversationsQuery,
	useGetMeQuery,
	useGetPlexLibrariesQuery,
	useGetPlexServersQuery,
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLazyCheckPlexAuthQuery,
	useLazyGetArrOptionsQuery,
	useLoginMutation,
	useLogoutMutation,
	useRegisterMutation,
	useSelectPlexServerMutation,
	useSendChatMessageMutation,
	useStartPlexAuthMutation,
	useTestAiConnectionMutation,
	useTestArrConnectionMutation,
	useUpdateAiConfigMutation,
	useUpdateArrConfigMutation,
};
export type {
	AiConfig,
	ArrConnection,
	ArrLookupResult,
	ArrOptions,
	ArrTestResult,
	ChatMessageResponse,
	ConversationSummary,
	PlexServer,
	Recommendation,
	User,
};
