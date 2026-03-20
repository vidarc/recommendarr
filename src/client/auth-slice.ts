import { createSlice } from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";

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
		setUser: (state, action: PayloadAction<User>) => {
			state.user = action.payload;
		},
		clearUser: (state) => {
			state.user = undefined;
		},
	},
});

const { setUser, clearUser } = authSlice.actions;

export { authSlice, clearUser, setUser };
export type { User };
