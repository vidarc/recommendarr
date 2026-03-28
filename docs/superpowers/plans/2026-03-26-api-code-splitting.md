# API Code-Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `src/client/api.ts` into feature-scoped API files using RTK Query's `injectEndpoints`, with types colocated by feature.

**Architecture:** A slim base `api.ts` defines `createApi` with `baseQuery` and `tagTypes` only. Five feature API files (`auth`, `plex`, `ai`, `chat`, `arr`) each call `api.injectEndpoints()` to register their endpoints and export hooks + types. Shared types (`Recommendation`, `ChatMessageResponse`) live in `src/client/shared/types.ts`.

**Tech Stack:** RTK Query `injectEndpoints`, TypeScript, existing Fastify + React stack

---

## File Structure

### New Files

| File                              | Responsibility                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/client/features/auth/api.ts` | Auth endpoints: login, register, logout, getMe, getSettings, getSetupStatus                                          |
| `src/client/features/plex/api.ts` | Plex endpoints: startPlexAuth, checkPlexAuth, getPlexServers, selectPlexServer, disconnectPlex, getPlexLibraries     |
| `src/client/features/ai/api.ts`   | AI endpoints: getAiConfig, updateAiConfig, deleteAiConfig, testAiConnection                                          |
| `src/client/features/chat/api.ts` | Chat endpoints: sendChatMessage, getConversations, getConversation, deleteConversation                               |
| `src/client/features/arr/api.ts`  | Arr endpoints: getArrConfig, updateArrConfig, deleteArrConfig, testArrConnection, getArrOptions, arrLookup, addToArr |
| `src/client/shared/types.ts`      | Cross-feature types: Recommendation, ChatMessageResponse                                                             |

### Modified Files

| File                                                                                                                                                    | Change                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/client/api.ts`                                                                                                                                     | Strip to base `createApi` shell (remove all endpoints, types, hook exports) |
| `src/client/App.tsx`                                                                                                                                    | Update import path                                                          |
| `src/client/components/AppLayout.tsx`                                                                                                                   | Split import: base `api` + auth hooks                                       |
| `src/client/components/ChatControls.tsx`                                                                                                                | Update import path                                                          |
| `src/client/components/RecommendationCard.tsx`                                                                                                          | Update import paths (arr api + shared types)                                |
| `src/client/components/AddToArrModal.tsx`                                                                                                               | Update import paths (arr api + shared types)                                |
| `src/client/hooks/use-chat.ts`                                                                                                                          | Update import paths (chat api + shared types)                               |
| `src/client/hooks/use-conversations.ts`                                                                                                                 | Update import paths (chat api + shared types)                               |
| `src/client/hooks/use-plex-auth.ts`                                                                                                                     | Update import path                                                          |
| `src/client/hooks/use-ai-config.ts`                                                                                                                     | Update import path                                                          |
| `src/client/hooks/use-arr-config.ts`                                                                                                                    | Update import path                                                          |
| `src/client/pages/Login.tsx`                                                                                                                            | Split import: base `api` + auth hooks                                       |
| `src/client/pages/Register.tsx`                                                                                                                         | Split import: base `api` + auth hooks                                       |
| `src/client/pages/History.tsx`                                                                                                                          | Update import path (shared types)                                           |
| `src/client/pages/Recommendations.tsx`                                                                                                                  | Update import path (shared types)                                           |
| `src/client/pages/settings/PlexTab.tsx`                                                                                                                 | Update import path                                                          |
| All test files under `src/client/__tests__/`, `src/client/components/__tests__/`, `src/client/pages/__tests__/`, `src/client/pages/settings/__tests__/` | Update `api` import path                                                    |

---

### Task 1: Create shared types file

**Files:**

- Create: `src/client/shared/types.ts`

- [ ] **Step 1: Create `src/client/shared/types.ts`**

```ts
interface Recommendation {
	id: string;
	title: string;
	year?: number;
	mediaType: string;
	synopsis?: string;
	tmdbId?: number;
	addedToArr: boolean;
}

interface ChatMessageResponse {
	id: string;
	content: string;
	role: string;
	createdAt: string;
	recommendations: Recommendation[];
}

export type { ChatMessageResponse, Recommendation };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/shared/types.ts
git commit -m "refactor: add shared types for cross-feature use"
```

---

### Task 2: Create auth feature API

**Files:**

- Create: `src/client/features/auth/api.ts`

- [ ] **Step 1: Create `src/client/features/auth/api.ts`**

```ts
import { api } from "../../api.ts";

interface User {
	id: string;
	username: string;
	isAdmin: boolean;
}

type Settings = Record<string, string>;

interface Credentials {
	username: string;
	password: string;
}

interface SetupStatus {
	needsSetup: boolean;
}

const authApi = api.injectEndpoints({
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
} = authApi;

export {
	useGetMeQuery,
	useGetSettingsQuery,
	useGetSetupStatusQuery,
	useLoginMutation,
	useLogoutMutation,
	useRegisterMutation,
};
export type { User };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/features/auth/api.ts
git commit -m "refactor: create auth feature API with injectEndpoints"
```

---

### Task 3: Create plex feature API

**Files:**

- Create: `src/client/features/plex/api.ts`

- [ ] **Step 1: Create `src/client/features/plex/api.ts`**

```ts
import { api } from "../../api.ts";

interface PlexAuthStart {
	pinId: number;
	authUrl: string;
}

interface PlexAuthCheck {
	claimed: boolean;
}

interface PlexServer {
	name: string;
	address: string;
	port: number;
	scheme: string;
	uri: string;
	clientIdentifier: string;
	owned: boolean;
}

interface PlexServersResponse {
	servers: PlexServer[];
}

interface SelectPlexServerBody {
	serverUrl: string;
	serverName: string;
	machineIdentifier: string;
}

interface PlexLibrary {
	key: string;
	title: string;
	type: string;
}

interface PlexLibrariesResponse {
	libraries: PlexLibrary[];
}

const plexApi = api.injectEndpoints({
	endpoints: (builder) => ({
		startPlexAuth: builder.mutation<PlexAuthStart, void>({
			query: () => ({
				url: "api/plex/auth/start",
				method: "POST",
			}),
		}),
		checkPlexAuth: builder.query<PlexAuthCheck, number>({
			query: (pinId) => `api/plex/auth/check?pinId=${String(pinId)}`,
		}),
		getPlexServers: builder.query<PlexServersResponse, void>({
			query: () => "api/plex/servers",
			providesTags: ["PlexConnection"],
		}),
		selectPlexServer: builder.mutation<{ success: boolean }, SelectPlexServerBody>({
			query: (body) => ({
				url: "api/plex/servers/select",
				method: "POST",
				body,
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		disconnectPlex: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/plex/connection",
				method: "DELETE",
			}),
			invalidatesTags: ["PlexConnection"],
		}),
		getPlexLibraries: builder.query<PlexLibrariesResponse, void>({
			query: () => "api/plex/libraries",
			providesTags: ["PlexConnection"],
		}),
	}),
});

const {
	useStartPlexAuthMutation,
	useLazyCheckPlexAuthQuery,
	useGetPlexServersQuery,
	useSelectPlexServerMutation,
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
} = plexApi;

export {
	useDisconnectPlexMutation,
	useGetPlexLibrariesQuery,
	useGetPlexServersQuery,
	useLazyCheckPlexAuthQuery,
	useSelectPlexServerMutation,
	useStartPlexAuthMutation,
};
export type { PlexServer };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/features/plex/api.ts
git commit -m "refactor: create plex feature API with injectEndpoints"
```

---

### Task 4: Create AI feature API

**Files:**

- Create: `src/client/features/ai/api.ts`

- [ ] **Step 1: Create `src/client/features/ai/api.ts`**

```ts
import { api } from "../../api.ts";

interface AiConfig {
	endpointUrl: string;
	apiKey: string;
	modelName: string;
	temperature: number;
	maxTokens: number;
}

interface AiTestResult {
	success: boolean;
	error?: string;
}

const aiApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getAiConfig: builder.query<AiConfig, void>({
			query: () => "api/ai/config",
			providesTags: ["AiConfig"],
		}),
		updateAiConfig: builder.mutation<{ success: boolean }, AiConfig>({
			query: (body) => ({
				url: "api/ai/config",
				method: "PUT",
				body,
			}),
			invalidatesTags: ["AiConfig"],
		}),
		deleteAiConfig: builder.mutation<{ success: boolean }, void>({
			query: () => ({
				url: "api/ai/config",
				method: "DELETE",
			}),
			invalidatesTags: ["AiConfig"],
		}),
		testAiConnection: builder.mutation<AiTestResult, AiConfig | void>({
			query: (body) => ({
				url: "api/ai/test",
				method: "POST",
				body: body ?? undefined,
			}),
		}),
	}),
});

const {
	useGetAiConfigQuery,
	useUpdateAiConfigMutation,
	useDeleteAiConfigMutation,
	useTestAiConnectionMutation,
} = aiApi;

export {
	useDeleteAiConfigMutation,
	useGetAiConfigQuery,
	useTestAiConnectionMutation,
	useUpdateAiConfigMutation,
};
export type { AiConfig };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/features/ai/api.ts
git commit -m "refactor: create AI feature API with injectEndpoints"
```

---

### Task 5: Create chat feature API

**Files:**

- Create: `src/client/features/chat/api.ts`

- [ ] **Step 1: Create `src/client/features/chat/api.ts`**

```ts
import { api } from "../../api.ts";

import type { ChatMessageResponse } from "../../shared/types.ts";

interface SendChatMessageBody {
	message: string;
	mediaType: string;
	resultCount: number;
	conversationId?: string | undefined;
	libraryIds?: string[] | undefined;
}

interface SendChatMessageResponse {
	conversationId: string;
	message: ChatMessageResponse;
}

interface ConversationSummary {
	id: string;
	title: string;
	mediaType: string;
	createdAt: string;
}

interface ConversationsResponse {
	conversations: ConversationSummary[];
}

interface ConversationDetail {
	conversation: {
		id: string;
		title: string;
		mediaType: string;
		createdAt: string;
		messages: ChatMessageResponse[];
	};
}

interface DeleteConversationResponse {
	success: boolean;
}

const chatApi = api.injectEndpoints({
	endpoints: (builder) => ({
		sendChatMessage: builder.mutation<SendChatMessageResponse, SendChatMessageBody>({
			query: (body) => ({
				url: "api/chat",
				method: "POST",
				body,
			}),
			invalidatesTags: ["Conversations"],
		}),
		getConversations: builder.query<ConversationsResponse, void>({
			query: () => "api/conversations",
			providesTags: ["Conversations"],
		}),
		getConversation: builder.query<ConversationDetail, string>({
			query: (id) => `api/conversations/${id}`,
			providesTags: ["Conversations"],
		}),
		deleteConversation: builder.mutation<DeleteConversationResponse, string>({
			query: (id) => ({
				url: `api/conversations/${id}`,
				method: "DELETE",
			}),
			invalidatesTags: ["Conversations"],
		}),
	}),
});

const {
	useSendChatMessageMutation,
	useGetConversationsQuery,
	useGetConversationQuery,
	useDeleteConversationMutation,
} = chatApi;

export {
	useDeleteConversationMutation,
	useGetConversationQuery,
	useGetConversationsQuery,
	useSendChatMessageMutation,
};
export type { ConversationSummary };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/features/chat/api.ts
git commit -m "refactor: create chat feature API with injectEndpoints"
```

---

### Task 6: Create arr feature API

**Files:**

- Create: `src/client/features/arr/api.ts`

- [ ] **Step 1: Create `src/client/features/arr/api.ts`**

```ts
import { api } from "../../api.ts";

interface ArrConnection {
	id: string;
	serviceType: "radarr" | "sonarr";
	url: string;
	apiKey: string;
}

interface ArrOptions {
	rootFolders: { id: number; path: string; freeSpace: number }[];
	qualityProfiles: { id: number; name: string }[];
}

interface ArrLookupResult {
	title: string;
	year: number;
	tmdbId?: number;
	tvdbId?: number;
	overview: string;
	existsInLibrary: boolean;
	arrId: number;
}

interface ArrTestResult {
	success: boolean;
	version?: string;
	error?: string;
}

interface AddToArrParams {
	serviceType: "radarr" | "sonarr";
	recommendationId: string;
	tmdbId?: number;
	tvdbId?: number;
	title: string;
	year: number;
	qualityProfileId: number;
	rootFolderPath: string;
}

const arrApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getArrConfig: builder.query<ArrConnection[], void>({
			query: () => "api/arr/config",
			providesTags: ["ArrConfig"],
		}),
		updateArrConfig: builder.mutation<
			{ success: boolean },
			{ serviceType: string; url: string; apiKey: string }
		>({
			query: ({ serviceType, ...body }) => ({
				url: `api/arr/config/${serviceType}`,
				method: "PUT",
				body,
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		deleteArrConfig: builder.mutation<{ success: boolean }, string>({
			query: (serviceType) => ({
				url: `api/arr/config/${serviceType}`,
				method: "DELETE",
			}),
			invalidatesTags: ["ArrConfig"],
		}),
		testArrConnection: builder.mutation<ArrTestResult, { serviceType: string }>({
			query: (body) => ({
				url: "api/arr/test",
				method: "POST",
				body,
			}),
		}),
		getArrOptions: builder.query<ArrOptions, string>({
			query: (serviceType) => `api/arr/options/${serviceType}`,
		}),
		arrLookup: builder.mutation<
			ArrLookupResult[],
			{ serviceType: string; title: string; year?: number }
		>({
			query: (body) => ({
				url: "api/arr/lookup",
				method: "POST",
				body,
			}),
		}),
		addToArr: builder.mutation<{ success: boolean; error?: string }, AddToArrParams>({
			query: (body) => ({
				url: "api/arr/add",
				method: "POST",
				body,
			}),
			invalidatesTags: ["Conversations"],
		}),
	}),
});

const {
	useGetArrConfigQuery,
	useUpdateArrConfigMutation,
	useDeleteArrConfigMutation,
	useTestArrConnectionMutation,
	useLazyGetArrOptionsQuery,
	useArrLookupMutation,
	useAddToArrMutation,
} = arrApi;

export {
	useAddToArrMutation,
	useArrLookupMutation,
	useDeleteArrConfigMutation,
	useGetArrConfigQuery,
	useLazyGetArrOptionsQuery,
	useTestArrConnectionMutation,
	useUpdateArrConfigMutation,
};
export type { ArrConnection, ArrLookupResult, ArrOptions, ArrTestResult };
```

- [ ] **Step 2: Commit**

```bash
git add src/client/features/arr/api.ts
git commit -m "refactor: create arr feature API with injectEndpoints"
```

---

### Task 7: Slim down base `api.ts` and update all consumers

This is the atomic switchover — base file, all consumers, and all tests update together so nothing is broken between commits.

**Files:**

- Modify: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/AppLayout.tsx`
- Modify: `src/client/components/ChatControls.tsx`
- Modify: `src/client/components/RecommendationCard.tsx`
- Modify: `src/client/components/AddToArrModal.tsx`
- Modify: `src/client/hooks/use-chat.ts`
- Modify: `src/client/hooks/use-conversations.ts`
- Modify: `src/client/hooks/use-plex-auth.ts`
- Modify: `src/client/hooks/use-ai-config.ts`
- Modify: `src/client/hooks/use-arr-config.ts`
- Modify: `src/client/pages/Login.tsx`
- Modify: `src/client/pages/Register.tsx`
- Modify: `src/client/pages/History.tsx`
- Modify: `src/client/pages/Recommendations.tsx`
- Modify: `src/client/pages/settings/PlexTab.tsx`
- Modify: `src/client/__tests__/App.test.tsx`
- Modify: `src/client/components/__tests__/RecommendationCard.test.tsx`
- Modify: `src/client/components/__tests__/ChatControls.test.tsx`
- Modify: `src/client/components/__tests__/AddToArrModal.test.tsx`
- Modify: `src/client/pages/__tests__/Login.test.tsx`
- Modify: `src/client/pages/__tests__/Register.test.tsx`
- Modify: `src/client/pages/__tests__/History.test.tsx`
- Modify: `src/client/pages/__tests__/Recommendations.test.tsx`
- Modify: `src/client/pages/settings/__tests__/PlexTab.test.tsx`
- Modify: `src/client/pages/settings/__tests__/AiTab.test.tsx`
- Modify: `src/client/pages/settings/__tests__/IntegrationsTab.test.tsx`

- [ ] **Step 1: Replace `src/client/api.ts` with base shell**

Replace the entire file contents with:

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

- [ ] **Step 2: Update `src/client/App.tsx`**

Change:

```ts
import { useGetMeQuery, useGetSetupStatusQuery } from "./api.ts";
```

To:

```ts
import { useGetMeQuery, useGetSetupStatusQuery } from "./features/auth/api.ts";
```

- [ ] **Step 3: Update `src/client/components/AppLayout.tsx`**

Change:

```ts
import { api, useLogoutMutation } from "../api.ts";
```

To:

```ts
import { api } from "../api.ts";
import { useLogoutMutation } from "../features/auth/api.ts";
```

- [ ] **Step 4: Update `src/client/components/ChatControls.tsx`**

Change:

```ts
import { useGetPlexLibrariesQuery } from "../api.ts";
```

To:

```ts
import { useGetPlexLibrariesQuery } from "../features/plex/api.ts";
```

- [ ] **Step 5: Update `src/client/components/RecommendationCard.tsx`**

Change:

```ts
import { useGetArrConfigQuery } from "../api.ts";
```

To:

```ts
import { useGetArrConfigQuery } from "../features/arr/api.ts";
```

Change:

```ts
import type { Recommendation } from "../api.ts";
```

To:

```ts
import type { Recommendation } from "../shared/types.ts";
```

- [ ] **Step 6: Update `src/client/components/AddToArrModal.tsx`**

Change:

```ts
import { useAddToArrMutation, useArrLookupMutation, useLazyGetArrOptionsQuery } from "../api.ts";
```

To:

```ts
import {
	useAddToArrMutation,
	useArrLookupMutation,
	useLazyGetArrOptionsQuery,
} from "../features/arr/api.ts";
```

Change:

```ts
import type { ArrLookupResult, ArrOptions, Recommendation } from "../api.ts";
```

To:

```ts
import type { ArrLookupResult, ArrOptions } from "../features/arr/api.ts";
import type { Recommendation } from "../shared/types.ts";
```

- [ ] **Step 7: Update `src/client/hooks/use-chat.ts`**

Change:

```ts
import { useSendChatMessageMutation } from "../api.ts";
```

To:

```ts
import { useSendChatMessageMutation } from "../features/chat/api.ts";
```

Change:

```ts
import type { ChatMessageResponse } from "../api.ts";
```

To:

```ts
import type { ChatMessageResponse } from "../shared/types.ts";
```

- [ ] **Step 8: Update `src/client/hooks/use-conversations.ts`**

Change:

```ts
import { useDeleteConversationMutation, useGetConversationsQuery } from "../api.ts";
```

To:

```ts
import { useDeleteConversationMutation, useGetConversationsQuery } from "../features/chat/api.ts";
```

Change:

```ts
import type { ConversationSummary } from "../api.ts";
```

To:

```ts
import type { ConversationSummary } from "../features/chat/api.ts";
```

- [ ] **Step 9: Update `src/client/hooks/use-plex-auth.ts`**

Change:

```ts
import { useLazyCheckPlexAuthQuery, useStartPlexAuthMutation } from "../api.ts";
```

To:

```ts
import { useLazyCheckPlexAuthQuery, useStartPlexAuthMutation } from "../features/plex/api.ts";
```

- [ ] **Step 10: Update `src/client/hooks/use-ai-config.ts`**

Change the import block that imports from `"../api.ts"` to import from `"../features/ai/api.ts"` instead. The imported names stay the same (`useDeleteAiConfigMutation`, `useGetAiConfigQuery`, `useTestAiConnectionMutation`, `useUpdateAiConfigMutation`, and type `AiConfig`).

- [ ] **Step 11: Update `src/client/hooks/use-arr-config.ts`**

Change the import block that imports from `"../api.ts"` to import from `"../features/arr/api.ts"` instead. The imported names stay the same (`useDeleteArrConfigMutation`, `useGetArrConfigQuery`, `useTestArrConnectionMutation`, `useUpdateArrConfigMutation`, and types `ArrConnection`, `ArrTestResult`).

- [ ] **Step 12: Update `src/client/pages/Login.tsx`**

Change:

```ts
import { api, useLoginMutation } from "../api.ts";
```

To:

```ts
import { api } from "../api.ts";
import { useLoginMutation } from "../features/auth/api.ts";
```

- [ ] **Step 13: Update `src/client/pages/Register.tsx`**

Change:

```ts
import { api, useRegisterMutation } from "../api.ts";
```

To:

```ts
import { api } from "../api.ts";
import { useRegisterMutation } from "../features/auth/api.ts";
```

- [ ] **Step 14: Update `src/client/pages/History.tsx`**

Change:

```ts
import type { ConversationSummary } from "../api.ts";
```

To:

```ts
import type { ConversationSummary } from "../features/chat/api.ts";
```

- [ ] **Step 15: Update `src/client/pages/Recommendations.tsx`**

Change:

```ts
import type { ChatMessageResponse } from "../api.ts";
```

To:

```ts
import type { ChatMessageResponse } from "../shared/types.ts";
```

- [ ] **Step 16: Update `src/client/pages/settings/PlexTab.tsx`**

Change the import block that imports hooks from `"../../api.ts"` to import from `"../../features/plex/api.ts"` instead. The imported names stay the same (`useDisconnectPlexMutation`, `useGetPlexServersQuery`, `useSelectPlexServerMutation`).

Change:

```ts
import type { PlexServer } from "../../api.ts";
```

To:

```ts
import type { PlexServer } from "../../features/plex/api.ts";
```

- [ ] **Step 17: Update all test files**

Test files only import `api` (for `api.util.resetApiState()`) and occasionally types. The `api` import stays pointed at the base file, but the relative path may need updating based on directory depth. Update each:

- `src/client/__tests__/App.test.tsx`: `import { api } from "../api.ts";` — **no change needed**
- `src/client/components/__tests__/RecommendationCard.test.tsx`:
  - `import { api } from "../../api.ts";` — **no change needed**
  - Change `import type { Recommendation } from "../../api.ts";` to `import type { Recommendation } from "../../shared/types.ts";`
- `src/client/components/__tests__/ChatControls.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/components/__tests__/AddToArrModal.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/pages/__tests__/Login.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/pages/__tests__/Register.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/pages/__tests__/History.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/pages/__tests__/Recommendations.test.tsx`: `import { api } from "../../api.ts";` — **no change needed**
- `src/client/pages/settings/__tests__/PlexTab.test.tsx`: `import { api } from "../../../api.ts";` — **no change needed**
- `src/client/pages/settings/__tests__/AiTab.test.tsx`: `import { api } from "../../../api.ts";` — **no change needed**
- `src/client/pages/settings/__tests__/IntegrationsTab.test.tsx`: `import { api } from "../../../api.ts";` — **no change needed**

- [ ] **Step 18: Run typecheck**

Run: `yarn vp check`
Expected: PASS — no type errors, no lint errors

- [ ] **Step 19: Run full test suite**

Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "refactor: split api.ts into feature-scoped API files with injectEndpoints"
```
