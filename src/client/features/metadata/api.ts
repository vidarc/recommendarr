import { api } from "../../api.ts";

import type { MetadataResponse, MetadataStatusResponse } from "@shared/schemas/metadata";

const metadataApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getMetadataStatus: builder.query<MetadataStatusResponse, void>({
			query: () => "api/metadata/status",
			providesTags: ["Metadata"],
		}),
		getMetadata: builder.query<MetadataResponse, string>({
			query: (recommendationId) => `api/metadata/${recommendationId}`,
		}),
	}),
});

const { useGetMetadataStatusQuery, useGetMetadataQuery, useLazyGetMetadataQuery } = metadataApi;

export { useGetMetadataQuery, useGetMetadataStatusQuery, useLazyGetMetadataQuery };
