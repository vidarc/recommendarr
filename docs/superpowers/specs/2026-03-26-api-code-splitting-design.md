# API Code-Splitting Design

Split the monolithic `src/client/api.ts` into feature-scoped API files using RTK Query's `injectEndpoints` pattern.

## Motivation

The current `api.ts` is a single 407-line file containing 26 endpoints, 20+ interface definitions, and hook exports for all features. Breaking it up by feature improves maintainability and keeps each domain's API surface colocated with the UI that uses it.

## Base API

`src/client/api.ts` becomes a minimal shell:

```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/" }),
	tagTypes: ["PlexConnection", "AiConfig", "ArrConfig", "Conversations"],
	endpoints: () => ({}),
});

export { api };
```

`store.ts` remains unchanged — it imports `api` from this base file.

## Feature API Files

Each feature calls `api.injectEndpoints()` to register its endpoints. Hooks are destructured from the return value and re-exported. Types are owned by the feature file unless shared across features.

### `src/client/features/auth/api.ts`

- **Endpoints:** `getSettings`, `getSetupStatus`, `login`, `register`, `getMe`, `logout`
- **Types:** `User`, `Credentials`, `SetupStatus`, `Settings`
- **Tags:** none

### `src/client/features/plex/api.ts`

- **Endpoints:** `startPlexAuth`, `checkPlexAuth`, `getPlexServers`, `selectPlexServer`, `disconnectPlex`, `getPlexLibraries`
- **Types:** `PlexAuthStart`, `PlexAuthCheck`, `PlexServer`, `PlexServersResponse`, `SelectPlexServerBody`, `PlexLibrary`, `PlexLibrariesResponse`
- **Tags:** provides/invalidates `PlexConnection`

### `src/client/features/ai/api.ts`

- **Endpoints:** `getAiConfig`, `updateAiConfig`, `deleteAiConfig`, `testAiConnection`
- **Types:** `AiConfig`, `AiTestResult`
- **Tags:** provides/invalidates `AiConfig`

### `src/client/features/chat/api.ts`

- **Endpoints:** `sendChatMessage`, `getConversations`, `getConversation`, `deleteConversation`
- **Types:** `SendChatMessageBody`, `SendChatMessageResponse`, `ConversationSummary`, `ConversationsResponse`, `ConversationDetail`, `DeleteConversationResponse`
- **Tags:** provides/invalidates `Conversations`

### `src/client/features/arr/api.ts`

- **Endpoints:** `getArrConfig`, `updateArrConfig`, `deleteArrConfig`, `testArrConnection`, `getArrOptions`, `arrLookup`, `addToArr`
- **Types:** `ArrConnection`, `ArrOptions`, `ArrLookupResult`, `ArrTestResult`, `AddToArrParams`
- **Tags:** provides/invalidates `ArrConfig`; `addToArr` also invalidates `Conversations`

## Shared Types

`src/client/shared/types.ts` contains types used across multiple features:

- **`Recommendation`** — used by chat (message responses) and arr (AddToArrModal, RecommendationCard)
- **`ChatMessageResponse`** — used by chat API, `use-chat` hook, and Recommendations page

## Pattern

Each feature API file follows this structure:

```ts
import { api } from "../../api.ts";

// Feature-specific types
interface ExampleType {
	/* ... */
}

const featureApi = api.injectEndpoints({
	endpoints: (builder) => ({
		exampleQuery: builder.query<ExampleType, void>({
			query: () => "api/example",
		}),
	}),
});

const { useExampleQueryQuery } = featureApi;

export { useExampleQueryQuery };
export type { ExampleType };
```

No `overrideExisting` flag is needed — each endpoint is defined exactly once. Endpoints register into the shared `api` instance at import time, so cross-feature tag invalidation (e.g., `addToArr` invalidating `Conversations`) works automatically.

## Consumer Updates

All existing imports from `src/client/api.ts` update to point at the relevant feature API file:

| Consumer                 | Old Import          | New Import                                                                     |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------ |
| `App.tsx`                | `./api.ts`          | `./features/auth/api.ts`                                                       |
| `AppLayout.tsx`          | `../api.ts` (hooks) | `../features/auth/api.ts` (hooks), `../api.ts` (base `api` for state reset)    |
| `Login.tsx`              | `../api.ts`         | `../features/auth/api.ts` (hooks), `../../api.ts` (base `api` for state reset) |
| `Register.tsx`           | `../api.ts`         | `../features/auth/api.ts` (hooks), `../../api.ts` (base `api` for state reset) |
| `PlexTab.tsx`            | `../../api.ts`      | `../../features/plex/api.ts`                                                   |
| `ChatControls.tsx`       | `../api.ts`         | `../features/plex/api.ts`                                                      |
| `use-plex-auth.ts`       | `../api.ts`         | `../features/plex/api.ts`                                                      |
| `use-ai-config.ts`       | `../api.ts`         | `../features/ai/api.ts`                                                        |
| `use-chat.ts`            | `../api.ts`         | `../features/chat/api.ts`                                                      |
| `use-conversations.ts`   | `../api.ts`         | `../features/chat/api.ts`                                                      |
| `History.tsx`            | `../api.ts`         | `../shared/types.ts` (type only)                                               |
| `Recommendations.tsx`    | `../api.ts`         | `../shared/types.ts` (type only)                                               |
| `RecommendationCard.tsx` | `../api.ts`         | `../features/arr/api.ts` + `../shared/types.ts`                                |
| `AddToArrModal.tsx`      | `../api.ts`         | `../features/arr/api.ts` + `../shared/types.ts`                                |
| `use-arr-config.ts`      | `../api.ts`         | `../features/arr/api.ts`                                                       |

Test files update their imports to match.

## What Does Not Change

- `store.ts` — still imports base `api` for reducer and middleware
- Redux store shape — single `api` reducer path, single middleware entry
- Tag invalidation behavior — all features share the same `api` instance
- Hook signatures and usage — consumers call the same hooks with the same args
- No new dependencies required
