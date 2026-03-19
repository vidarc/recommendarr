import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

interface Settings {
	[key: string]: string;
}

const settingsApi = createApi({
	reducerPath: "settingsApi",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
	endpoints: (builder) => ({
		getSettings: builder.query<Settings, void>({
			query: () => "api/settings",
		}),
	}),
});

const { useGetSettingsQuery } = settingsApi;

export { settingsApi, useGetSettingsQuery };
