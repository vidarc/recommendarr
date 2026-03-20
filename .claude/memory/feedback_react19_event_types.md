---
name: React 19 event types
description: Use specific event types (SubmitEvent, ChangeEvent, etc.) instead of deprecated FormEvent in React 19
type: feedback
---

Use `React.SubmitEvent<HTMLFormElement>` for form submit handlers, not `React.FormEvent` or `React.SyntheticEvent`. `React.FormEvent` is fully deprecated in React 19 and doesn't exist.

**Why:** React 19 removed `FormEvent` in favor of more specific event types: `ChangeEvent`, `InputEvent`, `SubmitEvent`, `SyntheticEvent`.

**How to apply:** Match the event type to the handler — `onSubmit` → `SubmitEvent`, `onChange` → `ChangeEvent`, etc. Don't fall back to `SyntheticEvent` when a more specific type exists.
