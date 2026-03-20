import { configureStore } from "@reduxjs/toolkit";

import { api } from "./api.ts";
import { authSlice } from "./auth-slice.ts";

const createStore = () =>
	configureStore({
		reducer: {
			[api.reducerPath]: api.reducer,
			[authSlice.reducerPath]: authSlice.reducer,
		},
		middleware: (getDefaultMiddleware) =>
			// oxlint-disable-next-line unicorn/prefer-spread
			getDefaultMiddleware().concat(api.middleware),
	});

const store = createStore();

type RootState = ReturnType<typeof store.getState>;

export { createStore, store };
export type { RootState };
