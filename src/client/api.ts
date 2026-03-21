import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { User } from "./features/auth/auth-slice.ts";

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

const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
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
	}),
});

const { useGetSettingsQuery, useGetSetupStatusQuery, useLoginMutation, useRegisterMutation } = api;

export { api, useGetSettingsQuery, useGetSetupStatusQuery, useLoginMutation, useRegisterMutation };
