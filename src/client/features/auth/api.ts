import { api } from "../../api.ts";

import type { Credentials, SetupStatus, UserResponse } from "@shared/schemas/auth";
import type { SuccessResponse } from "@shared/schemas/common";

type Settings = Record<string, string>;

const authApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getSettings: builder.query<Settings, void>({
			query: () => "api/settings",
		}),
		getSetupStatus: builder.query<SetupStatus, void>({
			query: () => "api/auth/setup-status",
		}),
		login: builder.mutation<UserResponse, Credentials>({
			query: (body) => ({
				url: "api/auth/login",
				method: "POST",
				body,
			}),
		}),
		register: builder.mutation<UserResponse, Credentials>({
			query: (body) => ({
				url: "api/auth/register",
				method: "POST",
				body,
			}),
		}),
		getMe: builder.query<UserResponse, void>({
			query: () => "api/auth/me",
		}),
		logout: builder.mutation<SuccessResponse, void>({
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
} = authApi;

export {
	useGetMeQuery,
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLoginMutation,
	useLogoutMutation,
	useRegisterMutation,
};
