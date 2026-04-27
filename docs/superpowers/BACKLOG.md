# Redesign Backlog (B3 → B7)

**Source:** `claude.ai/design` handoff bundle (`Recommendarr Redesign.html`), received 2026-04-21.
**Status:** B1 (Foundations) shipped in PR #69. B2 (Chat input rework) shipped in PR #74. B3–B7 below are not yet planned or implemented.

Each phase below is sized as a single spec, but most decompose into 2–3 independently-shippable PRs (see "PR breakdown" under each phase).

---

## PR sequencing & dependency map

```
                    ┌──────────────────┐
                    │ B3 (card rework) │  ─── independent
                    └──────────────────┘

  ┌────────────────┐         ┌────────────────┐
  │ B4a backend    │ ──────▶ │ B4b frontend   │  (rows w/o tokens)
  │ /api/convos    │         │ History page   │
  └────────────────┘         └────────────────┘
                                    │
  ┌────────────────┐                ▼
  │ B5a backend    │ ──┬──▶  ┌────────────────┐
  │ schema + chat  │   │     │ B4c history    │  (token totals)
  │ + GET expose   │   │     │ token UI       │
  └────────────────┘   │     └────────────────┘
                       └──▶  ┌────────────────┐
                             │ B5b frontend   │  (badge + subtitle)
                             └────────────────┘

  ┌────────────────┐
  │ B6a edit title │  ─── independent (adds PATCH /api/conversations/:id)
  └────────────────┘

  ┌────────────────┐
  │ B6b picker     │  ─── benefits from B4a (richer convo list)
  └────────────────┘

  ┌────────────────┐
  │ B7 filter      │  ─── independent (B2 shipped; no other deps)
  │   persistence  │
  └────────────────┘
```

**Recommended order** — items on the same line are independent and can ship in parallel:

1. **B3**, **B4a**, **B5a**, **B6a**, **B7** — all independent. Pick by appetite.
2. **B4b** (needs B4a), **B5b** (needs B5a). Independent of each other.
3. **B4c** (needs B4a + B5a), **B6b** (best after B4a so picker rows reuse History row shape).

**Risks to watch:**

- **B4a and B5a both touch `/api/conversations` response shape.** Land them in series, not parallel — second PR rebases on the first.
- **B5a is the only DB migration in the remaining backlog.** Keep it isolated; don't bundle it with unrelated work.
- **B6a needs `PATCH /api/conversations/:id`** — that route does not exist yet (the route file has GET/GET/DELETE only). Add it as part of B6a, not as a separate "verify" step.

---

## B3 — Recommendation card rework

Replace the current card with the prototype's horizontal layout.

**Components touched:** `RecommendationCard.tsx`, `MetadataPanel.tsx` (if still used — may get absorbed), `Recommendations.tsx` (indent unchanged from B1).

**Shape:**

- Horizontal flex row: poster (72×108) on the left, content on the right.
- Header line: title (bold, 15px, letter-spacing -0.2), year (muted), media-type badge pill (`Movie` blue / `TV` purple).
- Genre chip row (pulled from metadata) — small pill chips with border, muted text.
- Synopsis paragraph with 2-line clamp and `More` / `Less` toggle below.
- Action row (below, separated by a top border):
  - `+ Add to Radarr` / `+ Add to Sonarr` button, OR a green "✓ Added to Radarr/Sonarr" badge when added.
  - Spacer.
  - Feedback up/down buttons, each 30×30, with active tinting (green / red).

**Poster:**

- If metadata is loaded and poster URL exists → render it with rounded corners and `object-fit: cover`.
- Otherwise → diagonal-stripe SVG placeholder (from prototype, lines 170–189 of the handoff) with `movie poster` / `show art` centered text.

**Data:**

- Metadata (poster URL, genres, synopsis) already flows through the `/api/metadata/:recommendationId` route added in the TVDB/TMDB phase. Reuse `useGetMetadataQuery` or equivalent.
- `addedToArr` + `feedback` already exist on the recommendation row.

**Accessibility:** title is the primary label; poster is decorative (`alt=""` when it's a placeholder, meaningful `alt` when it's a real poster). Buttons keep accessible names (`Like`, `Dislike`, `Add to Radarr`).

**Tweaks panel (not shipped):** the prototype has a horizontal/stacked toggle. We're shipping horizontal only.

**PR breakdown:** ship as **one PR**. The card is a single component — splitting horizontal layout / header / synopsis / actions into separate PRs forces each one to rewrite the same JSX and creates rebase churn. The only reasonable precursor split is the `PosterPlaceholder` SVG component if it'll be reused (e.g. by B6b's picker thumbnails).

---

## B4 — History page rework

Redesign `History.tsx` to match the prototype's richer list rows. Requires backend expansion.

**Backend changes:**

- Expand the conversation list response (today's `GET /api/conversations`) to include per-conversation:
  - `preview` — the first user message content, truncated to ~140 chars
  - `topRecs` — up to 3 recommendation titles (by earliest assistant message, then order)
  - `messageCount`, `recCount`, `addedCount`, `likedCount`
  - `tokensIn`, `tokensOut` — **blocked on B5** (token persistence). Until B5 ships, omit these fields from the response and gate the UI on their presence.
- Keep the list endpoint under one round-trip — aggregate in SQL (subqueries or grouped joins) rather than per-conversation queries. Watch for N+1.

**Frontend changes:**

- Page container: `max-width: 760px`, centered, `padding: 24px 32px 48px`.
- Header:
  - H1 `History` (22px, bold, letter-spacing -0.4).
  - Totals line (small, dim): `N conversations · M recommendations · K added to library`.
  - Token totals line (mono, dim) — gated on B5.
  - Filter pills on the right: `All | Movies | TV`.
- Row shape (`grid-template-columns: 1fr auto`):
  - Left: media-type badge, title, "· 2 hours ago", preview quote in italics, top-recs chip row, per-row stats (`M messages · R recs · ↑L · +A added · Tk tok`).
  - Right (visible on hover): delete (trash) icon button.
- Empty state: "No conversations yet. Start a new recommendation on the Recommendations page."

**Delete flow:** the button calls the existing `DELETE /api/conversations/:id` and optimistically removes the row.

**Testing:** unit tests for row rendering with/without token data. E2E: filter pill interactions, delete-with-confirm, click-through to recommendations page loads the conversation.

**PR breakdown:**

- **B4a — backend.** Expand `GET /api/conversations` with `preview`, `topRecs`, `messageCount`, `recCount`, `addedCount`, `likedCount`. Update the shared schema; the existing UI ignores the new fields. One round-trip, aggregate in SQL. **No deps.**
- **B4b — frontend rows.** New page layout, header with totals (sans tokens), filter pills, redesigned row with preview + topRecs + stats, hover-delete. **Depends on B4a.**
- **B4c — token totals.** Wire `tokensIn`/`tokensOut` into the header totals line and per-row stats. Small, additive. **Depends on B4a + B5a** (B5a exposes the fields server-side).

---

## B5 — Token persistence + token UI

Unlocks the "blocked on B5" bits in B4 and the assistant-message token badge.

**Schema change** (drizzle migration):

- Add `tokensIn` (integer) and `tokensOut` (integer) columns to the `messages` table, nullable for backfill.
- No backfill of existing rows — they keep `null` and the UI hides the badge when either field is missing.

**Backend changes:**

- `POST /api/chat` route: when the AI response comes back with usage data (OpenAI-compatible `usage.prompt_tokens` / `usage.completion_tokens`), write both onto the assistant message row.
- `GET /api/conversations/:id` and `GET /api/conversations`: include token fields.
- Handle providers that don't return usage — leave null, don't throw.

**Frontend changes:**

- Assistant message header: new token badge on the right-hand side of the header row — `↓ {in} · ↑ {out} tok`, monospace, muted, with a title tooltip showing raw counts.
- Recommendations page header subtitle: append `· 3,420 tok in · 1,180 tok out` (mono, right-leaning) when the conversation has aggregated tokens.
- History page: enable the token columns in totals + per-row stats.

**Testing:** unit-test the chat route handler writes tokens when usage is present and doesn't throw when it's absent. E2E: send a chat and verify the badge renders (mock the AI response with usage).

**PR breakdown:**

- **B5a — backend.** Drizzle migration adds nullable `tokensIn` / `tokensOut` to `messages`. `POST /api/chat` writes from `usage.prompt_tokens` / `usage.completion_tokens` when present (no-op when absent). `GET /api/conversations/:id` and `GET /api/conversations` include the fields. **No deps.** Keep this PR isolated — it's the only DB migration in the remaining backlog.
- **B5b — frontend.** Assistant message token badge + recommendations header subtitle aggregate. **Depends on B5a.**
- (History page token UI lives in B4c, not here.)

---

## B6 — Conversation picker & editable title

Two header-level affordances from the prototype that don't fit neatly into B2–B5.

**Conversation picker dropdown:**

- A `Switch ▾` button in the Recommendations page header, to the left of the title.
- On open: a popover (width ~300, maxHeight ~360, scrollable) with a "New conversation" button at the top and a list of recent conversations (same shape as the History row, compact).
- Clicking a conversation navigates to that conversation (routing via wouter + `?conversation=<id>` — already supported).

**Editable conversation title:**

- Click the header `h1` to edit inline. Autosize input, commit on blur or `Enter`, cancel on `Escape`.
- `PATCH /api/conversations/:id` with `{ title }` — **route does not exist yet.** Add it as part of B6a (auth + ownership check, update + return the row, shared schema entry, `docs/api.md` update).
- Optimistic RTK Query update so the sidebar picker and URL don't flash.

**Out of scope for B6:** moving the title-generation logic into here. Auto-generated titles still land server-side on conversation creation.

**PR breakdown:**

- **B6a — editable title.** Adds `PATCH /api/conversations/:id`, inline-edit `h1` on the Recommendations header, optimistic update. **No deps.**
- **B6b — picker dropdown.** New `Switch ▾` button + popover listing recent conversations. Reuses wouter's `?conversation=<id>` flow. **No hard deps**, but ships better after B4a so the picker rows can use the same shape as History rows (preview + topRecs + counts).

---

## B7 — Per-conversation filter persistence

The prototype stores filter state keyed by conversation ID in `localStorage`. We'll match the behavior but land it in two steps.

**Phase 1 — client-only:**

- Redux slice (or RTK Query cached selector) keyed by conversation ID: `{ mediaType, resultCount, excludeLibrary, libraryScope }`.
- Persist to `localStorage` under `recommendarr:filters-by-convo`.
- New conversations seed with defaults (`{ movie, 5, true, "whole" }`) so they don't inherit.

**Phase 2 — server-side (optional follow-up):**

- If we want filters to follow the user across devices, move storage to a `conversation_filters` table (one row per conversation) or an `agent_state` JSON column on `conversations`. Gate on user demand — Phase 1 is probably enough for most use.

**Testing:** unit-test the slice / hook around conversation switching. E2E: set filters on convo A, switch to convo B, verify defaults, switch back, verify restoration.

**PR breakdown:** ship Phase 1 as **one PR** — Redux slice + localStorage persistence + ChatInput wiring + tests are tightly coupled. Phase 2 (server-side) stays deferred until there's user demand for cross-device sync.

---

## Cross-cutting notes

- **Unit convention:** keep the rem-over-px rule from B1. Theme `fontSizes` token group landed in B1 — extend it only if a new size is genuinely needed.
- **Tweaks panel:** the prototype includes an edit-mode tweaks panel (card layout, sidebar style, accent color). Not shipped in any phase. Opinionated defaults are: icon-rail sidebar, horizontal cards, teal accent.
- **Prototype fidelity vs. codebase fit:** match the visual output, not the prototype's internal structure. In particular, don't inline styles — keep using Linaria atomic classes + theme tokens.
- **Test discipline:** unit tests for every changed component, update affected e2e selectors in the same PR. Don't expand e2e coverage unless a gap appears.

## When a phase starts

Spec-and-ship: write a spec in `docs/superpowers/specs/YYYY-MM-DD-redesign-bN-<shortname>-design.md`, reference it in the PR, land the work. Merge the backlog item out of this file into HISTORY.md as a one-paragraph entry once the PR ships. No long-form plan files — git history + the merged PR are the authoritative record of _what_ was built; the spec preserves the _why_.
