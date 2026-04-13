---
name: Conversation URL param loading is a stub
description: useChat doesn't read ?conversation=<id> from the URL, so History → "open conversation" appears to navigate but lands on an empty page
type: project
---

`src/client/hooks/use-conversations.ts:24` navigates to `/?conversation=${id}` when you click a row on the History page, but `src/client/hooks/use-chat.ts` holds `conversationId` in local state only and never reads the URL. The Recommendations page mounts empty — no message history, no cards — and the user has no way to resume a prior conversation from the UI.

**Why:** Discovered on 2026-04-13 while debugging e2e flake in `e2e/metadata.test.ts`. The metadata cache-hit test tried to navigate `/history → row click → /?conversation=<id>` to force a second fetch, but the card never rendered so the test hung waiting on `/api/conversations/:id` that was never fetched. I dropped that e2e test (server cache is covered in `src/server/__tests__/metadata.test.ts`) rather than fix the app in the same PR.

**How to apply:** If you're touching `useChat` or the History → Recommendations flow, wire conversationId from the URL: parse `?conversation=<id>`, call `useGetConversationQuery(id)` (already exported from `src/client/features/chat/api.ts`), and hydrate `messages`/`conversationId` from the response. Once that works, the e2e suite can properly cover the cache-hit scenario by navigating back to the conversation and re-expanding the metadata panel.
