---
name: feedback_react19_event_types
description: Use React's own SubmitEvent/ChangeEvent/KeyboardEvent types imported from "react", not global DOM types, for React event handlers
type: feedback
---

For React synthetic event handlers (onSubmit, onChange, onKeyDown, onClick), import event types from `"react"`:

- `onSubmit` → `SubmitEvent<HTMLFormElement>` from `"react"`
- `onChange` → `ChangeEvent<HTMLInputElement>` (or HTMLSelectElement, HTMLTextAreaElement) from `"react"`
- `onKeyDown` → `KeyboardEvent` from `"react"`
- `onClick` → `MouseEvent` from `"react"`

**Why:** React 19 deprecated `React.FormEvent` but still uses its own synthetic event wrappers. The native DOM `SubmitEvent` (global) is NOT compatible with React's `onSubmit` prop type — it needs `React.SubmitEvent<HTMLFormElement>`. Similarly, for `document.addEventListener` handlers, use `globalThis.KeyboardEvent` to avoid conflicts with the React import.

**How to apply:** Always import event types from `"react"` as type imports. For native DOM event listeners (document.addEventListener), use `globalThis.KeyboardEvent` etc. to disambiguate from the React types.
