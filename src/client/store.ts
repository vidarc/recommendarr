import { configureStore } from "@reduxjs/toolkit";
import { settingsApi } from "./api.ts";

const store = configureStore({
	reducer: {
		[settingsApi.reducerPath]: settingsApi.reducer,
	},
	middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(settingsApi.middleware),
});

export { store };
