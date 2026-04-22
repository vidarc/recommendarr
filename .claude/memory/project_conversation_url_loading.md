---
name: useChat URL conversation loading
description: How src/client/hooks/use-chat.ts hydrates from ?conversation=<id> and the hydration race it avoids
type: reference
---

`useChat` reads `?conversation=<id>` via wouter's `useSearch`, calls `useGetConversationQuery(id, { skip: !id })`, and hydrates local `messages` / `conversationId` from the response via `useEffect`. First send on a new conversation pushes `/?conversation=<newId>` via `setLocation`. `handleNewConversation` clears local state and resets the URL to `/`.

**Non-obvious invariants if you touch this hook:**

- `urlConversationId` is the source of truth for which conversation to load.
- When `urlConversationId` changes, messages are cleared first (via effect), then hydrated when `conversationData.id === urlConversationId`. This avoids showing stale messages from the previous conversation during the fetch.
- If a user manually strips `?conversation=` from the URL without using "New conversation", local state is **not** auto-cleared — intentional, to avoid racing `handleSend`'s URL push.
- The metadata cache-hit e2e scenario depends on this flow (navigate back to a conversation → re-expand metadata panel).
