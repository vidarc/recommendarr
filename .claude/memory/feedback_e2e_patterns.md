---
name: feedback_e2e_patterns
description: E2E testing patterns and pitfalls learned from Playwright test suite — fixtures, WebKit quirks, serial test design
type: feedback
---

Use the shared `e2e/fixtures.ts` for authentication in all e2e tests. It provides an `authenticatedPage` fixture that auto-registers (first use) and logs in (subsequent uses) per test suite + browser project.
**Why:** User explicitly requested extracting repeated login boilerplate into a Playwright fixture. The fixture also handles edge cases like registration failing on retry (user already exists in DB but not tracked in-memory).
**How to apply:** Import `{ test, expect }` from `./fixtures.ts` instead of `@playwright/test`. Use `authenticatedPage` destructured as `page` in test callbacks. Only `admin-login.test.ts` skips the fixture because it tests auth primitives directly.

WebKit is the most fragile browser for e2e tests. Registration and state transitions behave differently than Chromium/Firefox.
**Why:** Multiple CI failures were WebKit-only: registration race conditions, button selector ambiguity, and timing differences in component re-renders after API calls.
**How to apply:** Always verify e2e assertions match actual component rendering (don't assert a button disappears if it's unconditionally rendered). Use `{ exact: true }` on button selectors when button text is a substring of other buttons (e.g., "Connect" vs "Connect Plex").

Serial test suites (`test.describe.configure({ mode: "serial" })`) with `fullyParallel: true` can race across suites.
**Why:** Playwright runs serial suites in parallel with each other. Each serial suite gets its own worker, but they all hit the same database simultaneously.
**How to apply:** The fixture generates unique usernames per suite (`slug-browserName`) to avoid registration collisions. Each browser project gets a fresh Docker container (clean DB) via `scripts/e2e.sh`.

The AI test connection endpoint (`/api/ai/test`) is mocked at the browser level via `page.route()` in e2e tests because the OpenAI SDK is not simple REST.
**Why:** Unlike Radarr/Sonarr which use straightforward REST APIs mockable via Docker services, the AI endpoint uses an SDK that's harder to mock server-side.
**How to apply:** Keep using `page.route("/api/ai/test", ...)` for AI connection tests. Radarr/Sonarr use the `mock-services` Docker container.
