import { api } from "../../api.ts";

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

const arrApi = api.injectEndpoints({
	endpoints: (builder) => ({
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
	useGetArrConfigQuery,
	useUpdateArrConfigMutation,
	useDeleteArrConfigMutation,
	useTestArrConnectionMutation,
	useLazyGetArrOptionsQuery,
	useArrLookupMutation,
	useAddToArrMutation,
} = arrApi;

export {
	useAddToArrMutation,
	useArrLookupMutation,
	useDeleteArrConfigMutation,
	useGetArrConfigQuery,
	useLazyGetArrOptionsQuery,
	useTestArrConnectionMutation,
	useUpdateArrConfigMutation,
};
export type { ArrConnection, ArrLookupResult, ArrOptions, ArrTestResult };
