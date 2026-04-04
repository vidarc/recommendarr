---
name: TODO - Audit shared types between API and UI
description: Check for types duplicated between server and client that could be shared
type: project
---

Review whether types like `LibraryStatus`, `SyncResponse`, `LibrarySettingsBody` (defined in both `src/client/features/library/api.ts` and `src/server/routes/library.ts`) can be shared via a common types file.

**Why:** User wants to avoid duplicating types across API and UI boundaries. Currently the Zod schemas on the server and TypeScript interfaces on the client define the same shapes independently.

**How to apply:** When adding new API endpoints, consider whether response/request types should live in `src/client/shared/types.ts` or a new shared location that both server and client can import from.
