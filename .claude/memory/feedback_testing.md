---
name: feedback_testing
description: User preferences for how tests should be written — cleanup patterns, mocking strategy, and coverage expectations
type: feedback
---

Use `onTestFinished` from vitest for test cleanup instead of `afterEach`. This ensures cleanup runs even if the test fails mid-assertion.
**Why:** The user explicitly requested this pattern for reliability.
**How to apply:** Whenever writing tests that need teardown (closing servers, deleting temp files, resetting env vars, unmounting components), register cleanup via `onTestFinished` inside the test or a setup helper.

Use `msw` (Mock Service Worker) for HTTP mocking instead of mocking hooks or functions with `vi.fn()`.
**Why:** The user prefers testing real code paths end-to-end. Mocking hooks bypasses too much of the actual code. MSW intercepts at the network level so RTK Query hooks, reducers, and middleware all run for real.
**How to apply:** When testing components that make API calls (e.g. via RTK Query), use `setupServer` from `msw/node` with `http.get`/`http.post` handlers. Create fresh stores per test to avoid cache leakage.

These align with the project's CLAUDE.md guidelines: "Unit tests should mock as little as possible" and "Prefer mswjs for HTTP mocks."
