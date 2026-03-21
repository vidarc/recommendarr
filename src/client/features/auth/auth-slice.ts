import { createSlice } from "@reduxjs/toolkit";

interface User {
	id: string;
	username: string;
	isAdmin: boolean;
}

interface AuthState {
	user: User | undefined;
}

const initialState: AuthState = {
	user: undefined,
};

const authSlice = createSlice({
	name: "auth",
	initialState,
	reducers: {
		clearUser: (state) => {
			state.user = undefined;
		},
	},
});

const { clearUser } = authSlice.actions;

export { authSlice, clearUser };
export type { User };
