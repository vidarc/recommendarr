# Memory Index

## Project

- [project_status.md](project_status.md) — Current focus pointer; where to find context before suggesting work
- [project_future_features.md](project_future_features.md) — Redesign backlog pointer + older brainstormed feature ideas
- [project_metadata_route_followups.md](project_metadata_route_followups.md) — Two remaining cleanups on /api/metadata route

## User

## Feedback

- [feedback_testing.md](feedback_testing.md) — Testing preferences: use onTestFinished for cleanup, msw for HTTP mocks, avoid mocking hooks
- [feedback_react19_event_types.md](feedback_react19_event_types.md) — Import SubmitEvent/ChangeEvent/KeyboardEvent from "react", not global DOM types
- [feedback_e2e_patterns.md](feedback_e2e_patterns.md) — E2E patterns: shared auth fixture, WebKit quirks, serial test design, mock-services vs page.route
- [feedback_encryption_cache.md](feedback_encryption_cache.md) — Encryption key is cached; tests must call resetKeyCache() after stubbing env vars
- [feedback_lint_patterns.md](feedback_lint_patterns.md) — Oxlint strict rules: magic numbers, init-declarations, jsx-props-no-spreading, react-perf
- [feedback_db_transactions.md](feedback_db_transactions.md) — Multi-step DB mutations must be wrapped in transactions
- [feedback_zod_mini.md](feedback_zod_mini.md) — Always `import * as z from "zod/mini"` and use its functional API for best tree-shaking

## Decisions

## TODOs

- [project_shared_types_todo.md](project_shared_types_todo.md) — Audit and share types between server and client
- [project_null_vs_undefined.md](project_null_vs_undefined.md) — Standardize on undefined vs null across shared schemas and DB boundary

## References

- [project_conversation_url_loading.md](project_conversation_url_loading.md) — useChat URL hydration + race-condition invariants
- `docs/superpowers/HISTORY.md` — chronological log of shipped phases (MVP → Redesign B1)
- `docs/superpowers/BACKLOG.md` — Redesign B2–B7 (chat input / card / history / tokens / picker / filters)
- `docs/superpowers/specs/` — design specs for each phase (source of truth for _why_ decisions were made; `plans/` folder deleted 2026-04-22)
