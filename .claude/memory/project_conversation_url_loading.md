---
name: Conversation URL param loading — fixed 2026-04-13
description: useChat now reads ?conversation=<id> from the URL and hydrates messages via useGetConversationQuery
type: project
---

**Status:** ✅ Fixed 2026-04-13 in `src/client/hooks/use-chat.ts`.

`useChat` now reads `?conversation=<id>` via wouter's `useSearch`, calls `useGetConversationQuery(id, { skip: !id })`, and hydrates local `messages`/`conversationId` from the response via `useEffect`. First send on a new conversation pushes `/?conversation=<newId>` via `setLocation`. `handleNewConversation` clears local state and resets the URL to `/`.

**How to apply:** If you're touching `useChat` or the History → Recommendations flow, note that:

- `urlConversationId` is the source of truth for which conversation to load.
- When `urlConversationId` changes, messages are cleared first (via effect), then hydrated when `conversationData.id === urlConversationId`. This avoids showing stale messages from the previous conversation during the fetch.
- If a user manually strips `?conversation=` from the URL without using "New conversation", local state is NOT auto-cleared — that's intentional to avoid a race with `handleSend`'s URL push.
- The e2e suite could now properly cover the metadata cache-hit scenario by navigating back to a conversation and re-expanding the metadata panel (previously dropped from `e2e/metadata.test.ts` because this hook was broken).
