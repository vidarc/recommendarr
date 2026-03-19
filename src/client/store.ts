import { configureStore } from "@reduxjs/toolkit";
import { settingsApi } from "./api.ts";

const createStore = () =>
	configureStore({
		reducer: {
			[settingsApi.reducerPath]: settingsApi.reducer,
		},
		middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(settingsApi.middleware),
	});

const store = createStore();

export { createStore, store };
