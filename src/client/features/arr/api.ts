import { api } from "../../api.ts";

import type {
	ArrAddBody,
	ArrAddResponse,
	ArrConfigBody,
	ArrConnectionResponse,
	ArrLookupBody,
	ArrLookupResult,
	ArrOptionsResponse,
	ArrServiceType,
	ArrTestConnectionBody,
	ArrTestConnectionResponse,
} from "@shared/schemas/arr";
import type { SuccessResponse } from "@shared/schemas/common";

const arrApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getArrConfig: builder.query<ArrConnectionResponse[], void>({
			query: () => "api/arr/config",
			providesTags: ["ArrConfig"],
		}),
		updateArrConfig: builder.mutation<
			SuccessResponse,
			{ serviceType: ArrServiceType } & ArrConfigBody
		>({
			query: ({ serviceType, ...body }) => ({
				url: `api/arr/config/${serviceType}`,
				method: "PUT",
				body,
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		deleteArrConfig: builder.mutation<SuccessResponse, ArrServiceType>({
			query: (serviceType) => ({
				url: `api/arr/config/${serviceType}`,
				method: "DELETE",
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		testArrConnection: builder.mutation<ArrTestConnectionResponse, ArrTestConnectionBody>({
			query: (body) => ({
				url: "api/arr/test",
				method: "POST",
				body,
			}),
		}),
		getArrOptions: builder.query<ArrOptionsResponse, ArrServiceType>({
			query: (serviceType) => `api/arr/options/${serviceType}`,
		}),
		arrLookup: builder.mutation<ArrLookupResult[], ArrLookupBody>({
			query: (body) => ({
				url: "api/arr/lookup",
				method: "POST",
				body,
			}),
		}),
		addToArr: builder.mutation<ArrAddResponse, ArrAddBody>({
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
