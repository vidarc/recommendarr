# Memory Index

## Project

- [project_status.md](project_status.md) — Current state of the recommendarr project and what's been built so far
- [project_future_features.md](project_future_features.md) — Brainstormed feature ideas to revisit after arr integration
- [project_metadata_route_followups.md](project_metadata_route_followups.md) — Deferred cleanups on /api/metadata route from PR #44 review
- [project_conversation_url_loading.md](project_conversation_url_loading.md) — useChat reads ?conversation=<id> (fixed 2026-04-13)

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
