# Library Exclusion from Recommendations

**Date:** 2026-04-02
**Status:** Approved

## Overview

Exclude content the user already owns (in Plex, Radarr/Sonarr, or previously recommended) from AI recommendations. Uses a dual approach: prompt injection tells the AI what to avoid, and post-parse filtering catches anything it misses.

## Goals

- Avoid recommending movies/shows the user already has in their Plex library
- Avoid recommending content queued/downloaded in Radarr or Sonarr
- Avoid repeating recommendations from past conversations
- Use the user's library to positively inform taste (genre preferences)
- Keep chat latency low via cached library data

## Design Decisions

| Decision          | Choice                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| Exclusion sources | Plex library + Radarr/Sonarr + past recommendations                          |
| Mechanism         | Prompt injection AND post-parse filtering                                    |
| Large libraries   | Capped title list (~500) + genre-based taste summary                         |
| Toggle            | Global setting (default on) with per-conversation override                   |
| Data freshness    | Cached in DB, user-triggered "Sync Now" + configurable auto-refresh interval |

## Data Model

### New `library_items` table

| Column          | Type               | Description                                   |
| --------------- | ------------------ | --------------------------------------------- |
| `id`            | text (UUID)        | Primary key                                   |
| `userId`        | text (FK → users)  | Owner                                         |
| `title`         | text               | Media title                                   |
| `year`          | integer (nullable) | Release year                                  |
| `mediaType`     | text               | `"movie"` or `"show"`                         |
| `source`        | text               | `"plex"`, `"radarr"`, or `"sonarr"`           |
| `plexRatingKey` | text (nullable)    | Plex ID for deduplication                     |
| `externalId`    | text (nullable)    | TMDB/TVDB ID from arr services                |
| `genres`        | text (nullable)    | Comma-separated genres for summary generation |
| `syncedAt`      | text               | ISO timestamp of when this item was synced    |

**Unique constraint:** `(userId, source, title, year)` for clean upserts.

### New `user_settings` table

The existing `settings` table is global (no userId). Library preferences are per-user, so a new table is needed:

| Column                  | Type                      | Description                                                        |
| ----------------------- | ------------------------- | ------------------------------------------------------------------ |
| `id`                    | text (UUID)               | Primary key                                                        |
| `userId`                | text (FK → users, unique) | One row per user                                                   |
| `librarySyncInterval`   | text                      | `"manual"`, `"6h"`, `"12h"`, `"24h"`, `"7d"` (default: `"manual"`) |
| `librarySyncLast`       | text (nullable)           | ISO timestamp of last completed sync                               |
| `excludeLibraryDefault` | integer                   | `1` (true) or `0` (false), default `1`                             |

## Library Sync Service

**New file:** `src/server/services/library-sync.ts`

### `syncLibrary(userId, db, plexConnection, arrConnections)`

Fetches and caches library contents from all connected sources:

1. **Plex sync** — For each library on the user's server:
   - `GET /library/sections/{id}/all` with pagination (`X-Plex-Container-Start`, `X-Plex-Container-Size` of 200)
   - Page through until all items fetched
   - Extract: title, year, type, ratingKey, genres
   - Handle both movie libraries and show libraries

2. **Radarr sync** (if connected) — `GET /api/v3/movie` for all movies. Extract: title, year, tmdbId, genres.

3. **Sonarr sync** (if connected) — `GET /api/v3/series` for all series. Extract: title, year, tvdbId, genres.

4. **Upsert** — Within a transaction: delete existing `library_items` for the user, bulk insert the fresh set, update `librarySyncLast` in `user_settings`.

### `buildExclusionContext(userId, db, options: { mediaType: "movie" | "show" | "either" })`

Called at chat-time. Filters library items by `mediaType` (or includes both for `"either"`). Returns:

```typescript
{
  titles: { title: string; year?: number; mediaType: string }[]  // capped at 500
  summary: { movieCount: number; showCount: number; topGenres: string[] }
  pastRecommendations: { title: string; year?: number }[]
}
```

- Queries `library_items` for the user (capped at 500, sorted by title)
- Aggregates genre counts and total item counts for the summary
- Queries `recommendations` table for all past recommendation titles for this user

### `shouldAutoSync(userId, db)`

- Reads `librarySyncInterval` and `librarySyncLast` from `user_settings`
- Returns `true` if the configured interval has elapsed since last sync
- Called at the start of each chat request; if stale, triggers `syncLibrary()` before proceeding

## Prompt Builder Changes

**Updated `buildSystemPrompt()` signature** — accepts optional `exclusionContext` parameter.

New prompt sections injected after watch history, before format instructions:

1. **Library taste profile:**

   > "Based on the user's library of {movieCount} movies and {showCount} shows, their favorite genres are: {topGenres}. Prioritize recommendations that align with these tastes. Recommend content the user is likely to enjoy based on their library."

2. **Exclusion list** (up to 500 titles):

   > "The user already owns the following titles — do NOT recommend any of these:"
   > "- The Matrix (1999) [movie]"
   > "- Breaking Bad (2008) [show]"

3. **Past recommendations:**
   > "The following have already been recommended in previous conversations — avoid repeating them unless the user specifically asks:"
   > "- Interstellar (2014)"

The taste profile drives _what to recommend_ (positive signal). The exclusion list and past recommendations drive _what to avoid_ (negative signal). Three distinct jobs.

## Post-Parse Filter

**New function in `src/server/services/response-parser.ts`:** `filterExcludedRecommendations()`

1. Takes parsed recommendations array
2. Checks each against `library_items` (title + year) and past `recommendations`
3. Title matching: case-insensitive, trimmed. Exact match on title + year when year is present; title-only match as fallback
4. Returns `{ kept: Recommendation[], filtered: Recommendation[] }`

**Backfill flow** (in the chat route):

1. If `filtered.length > 0`, make a follow-up AI call requesting replacement recommendations
2. Parse and filter the backfill response (one retry only to avoid infinite loops)
3. Combine kept + backfill results
4. Save the final set to the database

## Chat Route Changes

### Updated `POST /api/chat` request schema

New optional field: `excludeLibrary?: boolean` — per-conversation override.

### Updated flow

1. Load AI config _(existing)_
2. Load/create conversation _(existing)_
3. **Resolve exclusion toggle** — if `excludeLibrary` provided, use it; otherwise read `excludeLibraryDefault` from `user_settings` (defaults to `true`)
4. **If exclusion enabled:** call `shouldAutoSync()`, run `syncLibrary()` if stale, then call `buildExclusionContext()`
5. Fetch Plex watch history _(existing)_
6. Build system prompt with `exclusionContext` _(updated)_
7. Call AI _(existing)_
8. Parse response _(existing)_
9. **If exclusion enabled:** run `filterExcludedRecommendations()`, backfill if needed
10. Save to database _(existing)_
11. Return response _(existing)_

### New endpoints

- `POST /api/library/sync` — triggers manual library sync, returns item counts
- `GET /api/library/status` — returns `{ lastSynced, interval, itemCount, excludeDefault }`
- `PUT /api/library/settings` — updates sync interval and exclude-library default

## UI Changes

### Settings Page — new "Library" tab

- **Sync status:** "Last synced: {timestamp}" or "Never synced"
- **Item counts:** "{X} movies, {Y} shows cached from Plex/Radarr/Sonarr"
- **"Sync Now" button** — triggers `POST /api/library/sync`, shows spinner, updates status on completion
- **Refresh interval dropdown:** Manual only, Every 6 hours, Every 12 hours, Every 24 hours, Weekly
- **"Exclude library from recommendations" toggle** — global default (on by default)
- **Save button** for interval + toggle changes

### Chat UI — per-conversation toggle

- Small toggle near existing chat controls (media type, result count): "Exclude my library"
- Defaults to the global setting value
- Sent as `excludeLibrary` in the chat request body

## Testing Strategy

- **Unit tests:** library-sync service (mock Plex/arr API responses), buildExclusionContext, filterExcludedRecommendations, updated prompt builder
- **Integration tests:** chat route with exclusion enabled/disabled, backfill flow, auto-sync trigger
- **E2E tests:** Settings Library tab sync flow, chat toggle behavior
