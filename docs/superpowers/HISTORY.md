# Recommendarr — Feature History

Chronological log of major work. Each entry links to its design spec (kept in `specs/`). The detailed implementation plans that used to live under `plans/` were removed on 2026-04-21 — the code is the source of truth for what shipped; these summaries plus the specs preserve the decisions.

Git history (`git log`, `git blame`, merged PRs on GitHub) remains authoritative for _when_ and _how_ each phase landed.

---

## 2026-03-20 — Folder restructure

Reorganized `src/server/` and `src/client/` into the layered `routes/ services/ middleware/ components/ pages/ features/` shape the project still uses. Pure refactor; no behavior change.

Spec: no spec (mechanical change). Plan: `plans/2026-03-20-folder-restructure.md` (removed).

## 2026-03-21 — Recommendarr MVP

First end-to-end slice. Delivered session-based auth (scrypt, httpOnly cookies, sessions table), Plex OAuth + server/library discovery, AI provider configuration (encrypted API keys at rest via AES-256-GCM), recommendation chat (conversations/messages/recommendations tables, `POST /api/chat`, prompt builder, response parser), and the settings page with tabs (Plex / AI / Account / Integrations).

Spec: [`specs/2026-03-20-recommendarr-mvp-design.md`](specs/2026-03-20-recommendarr-mvp-design.md).

## 2026-03-26 — API code splitting

Split the monolithic `src/client/api.ts` (407 lines, 26 endpoints) into feature-scoped modules using RTK Query's `injectEndpoints` pattern. Base `api` became a shell holding only tag types + reducer registration.

Spec: [`specs/2026-03-26-api-code-splitting-design.md`](specs/2026-03-26-api-code-splitting-design.md).

## 2026-03-26 — Arr integration (Radarr + Sonarr)

Added connection management (`/api/arr/config`), test route (`/api/arr/test`), lookup (`/api/arr/lookup`), and add-to-library flow (`/api/arr/add`) for Radarr and Sonarr. Recommendation cards gained an Add-to-Library button with a quick modal for root folder + quality profile selection. Lidarr deferred (music recommendations not supported yet).

Spec: [`specs/2026-03-26-arr-integration-design.md`](specs/2026-03-26-arr-integration-design.md). Merged in PR #15.

## 2026-03-28 — E2E expansion + mock services

Introduced `/api/plex/auth/manual` (bypasses OAuth for local servers and testing), Docker Compose mock services for Plex/Radarr/Sonarr (ports 9090/7878/8989), and new Playwright suites for navigation, admin login, Plex connection, AI config. Migrated arr tests from browser-level mocking to server-level. CI now runs e2e per-browser (chromium/firefox/webkit) with a fresh Docker container per run.

Spec: [`specs/2026-03-28-e2e-expansion-design.md`](specs/2026-03-28-e2e-expansion-design.md).

## 2026-04-02 — Library exclusion

Dual-approach filter for recommendations already owned, in-queue, or previously recommended: prompt injection warns the AI, post-parse filtering catches what slips through. Uses cached library data (Plex + arr) to keep chat latency low. Adds a user-level toggle for "exclude library" with a default stored in `user_settings`.

Spec: [`specs/2026-04-02-library-exclusion-design.md`](specs/2026-04-02-library-exclusion-design.md).

## 2026-04-05 — Feedback loop

Thumbs-up/down on recommendations, stored as a nullable `feedback` column on the existing `recommendations` table (`"liked" | "disliked" | null`). The most recent 50 feedback items are injected into the system prompt so the AI learns preferences across conversations. Exposed via `PATCH /api/recommendations/:id/feedback`.

Spec: [`specs/2026-04-05-feedback-loop-design.md`](specs/2026-04-05-feedback-loop-design.md).

## 2026-04-12 — TVDB & TMDB metadata

External metadata enrichment for recommendation cards. New `tvdb-client.ts` and `tmdb-client.ts` service clients, a `metadata_cache` table with TTL-based expiry, and `GET /api/metadata/:recommendationId` / `GET /api/metadata/status` routes. Both API keys are optional env vars — app degrades gracefully when either or both are missing.

Spec: [`specs/2026-04-12-tvdb-tmdb-metadata-design.md`](specs/2026-04-12-tvdb-tmdb-metadata-design.md).

## 2026-04-21 — Redesign B1: Foundations (PR #69)

First phase of the `claude.ai/design` handoff. Shipped:

- 60px icon-rail sidebar (`Sidebar.tsx`) with accent-bar active state and hover tooltips.
- New `Icon`, `Logo`, `LoadingBubble` components (TDD).
- Rewritten `ChatMessage` — right-aligned user bubble, left-aligned assistant with logo + label + 30px indent.
- Conversation-aware Recommendations page header (title + stats subtitle + "New" pill button).
- Theme token rem-conversion (`spacing`, `radii`, `fontSizes`). New `accentDim` color token.
- Global `[data-tooltip]:hover::after` rule.
- E2E selectors updated for the new header.

Spec: [`specs/2026-04-21-redesign-b1-foundations-design.md`](specs/2026-04-21-redesign-b1-foundations-design.md).

Phases **B2–B7** (chat input rework, card rework, history rework, token persistence, conversation picker + editable title, per-conversation filter persistence) are tracked in [`BACKLOG.md`](BACKLOG.md).

---

## About the removed `plans/` folder

Between the MVP (2026-03-21) and Redesign B1 (2026-04-21) the project used a `plans/` folder alongside `specs/`. Plans were long step-by-step execution logs (1k–3k lines each). Removed on 2026-04-21 because the code — plus git history for each merged PR — is the authoritative record of _what_ was built, and the `specs/` folder keeps the _why_.

Going forward: spec-and-ship. Write a spec, reference it in the PR, land the work, add a one-paragraph entry here.
