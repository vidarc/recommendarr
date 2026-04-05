import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
	tagTypes: ["PlexConnection", "AiConfig", "ArrConfig", "Conversations", "Library"],
	endpoints: () => ({}),
});

export { api };
