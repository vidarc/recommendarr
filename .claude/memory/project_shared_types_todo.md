---
name: Shared types audit (mostly done)
description: Status of shared types between API and UI — library + chat + metadata are already shared via src/shared/schemas/
type: project
---

**Status as of 2026-04-13:** most of the API/UI type duplication has already been resolved.

`src/shared/schemas/` holds zod schemas + inferred types for `ai`, `arr`, `auth`, `chat`, `common`, `library`, `metadata`, `plex`. Client features import types via the `@shared/schemas/<name>` alias (e.g. `src/client/features/library/api.ts` imports `LibraryStatus`, `LibrarySyncResponse`, `LibrarySettingsBody` from `@shared/schemas/library`), and the server routes validate against the same schemas.

**Why:** User wanted API/UI type parity. The original TODO was written before the `shared/schemas/` directory existed.

**How to apply:** When adding new API endpoints, define the zod schemas in `src/shared/schemas/<name>.ts` and import them from both the server route and the client RTK Query endpoint. Don't introduce new parallel TypeScript interfaces for wire-format types.

**Remaining trivial local dups** (not worth hoisting — they're local contracts, not wire format):

- `UpdateFeedbackArgs` in `src/client/features/chat/api.ts` — RTK mutation arg shape that wraps `FeedbackBody` with client-only `conversationId`/`recommendationId` fields.
- `Settings = Record<string, string>` in `src/client/features/auth/api.ts` — type alias for the `/api/settings` response.
