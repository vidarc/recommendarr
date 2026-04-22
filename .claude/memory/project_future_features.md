---
name: Future Feature Ideas
description: Brainstormed feature ideas beyond arr integration to revisit later
type: project
---

## Redesign backlog (B2–B7)

The bulk of the current planned work lives in **`docs/superpowers/BACKLOG.md`** — remaining phases of the 2026-04-21 `claude.ai/design` handoff:

- **B2** — Chat input rework (filter pill, genre pill, ControlsPopover, GenreStrip, selected-chip row)
- **B3** — Recommendation card rework (horizontal layout, poster, inline genres, More/Less, added-state badge)
- **B4** — History page rework (preview, top-recs, per-row stats, delete button) — needs backend list-endpoint expansion
- **B5** — Token persistence (schema migration, `messages.tokensIn/tokensOut`, token badge + header totals); unblocks part of B4
- **B6** — Conversation picker dropdown + editable title
- **B7** — Per-conversation filter persistence (localStorage first, optional server-side later)

Completed phases (B1 = Foundations, PR #69) are logged in **`docs/superpowers/HISTORY.md`**. Design specs in `docs/superpowers/specs/`.

## Smarter Recommendations

- **Feedback loop** — thumbs-up/thumbs-down on recommendations so AI learns preferences
- **Genre/mood preferences** — persistent filters like "lighthearted" or "horror only"
- **Exclude already-in-library** — cross-reference against Plex/arr to avoid suggesting owned content
- **Music support** — schema supports media_type="music" but no music-specific Plex history handling

## Discovery & Social

- **Shared recommendations** — shareable read-only link for recommendation lists
- **Multi-user households** — combine watch histories from multiple Plex users
- **Trending/popular** — surface what other users are getting recommended (opt-in, anonymized)

## UX Improvements

- **Conversation search** — search past recommendations across all conversations
- **Recommendation status tracking** — did you watch it? did you like it?
- **Streaming availability** — show where a recommendation is available (JustWatch API or similar)
- **Poster art** — pull movie/show posters from TMDB for RecommendationCards

## Token Management

- **Token budget / accuracy levels** — let users choose a token usage tier (e.g., "lean" vs "full") that disables or simplifies token-heavy features like feedback injection, exclusion context, or backfill requests. Helps cost-conscious users control AI API spend.

## Power User Features

- **Scheduled recommendations** — weekly email/notification with fresh picks
- **Custom AI prompts** — let users tweak the system prompt
- **Import/export** — export recommendation history as CSV/JSON
- **Watchlist integration** — sync with Plex watchlist or Trakt

**Why:** These came from a full codebase review on 2026-03-26. All are feasible given the current architecture.
**How to apply:** When the user finishes arr integration or asks "what's next", reference these ideas.
