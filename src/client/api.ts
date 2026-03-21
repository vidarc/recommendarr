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
		getMe: builder.query<User, void>({
			query: () => "api/auth/me",
		}),
		logout: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/auth/logout",
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
} = api;

export {
	api,
	useGetMeQuery,
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLoginMutation,
	useLogoutMutation,
	useRegisterMutation,
};
export type { User };
