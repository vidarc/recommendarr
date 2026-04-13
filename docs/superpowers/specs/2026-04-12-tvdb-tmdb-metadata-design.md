# TVDB & TMDB Metadata Integration

**Date:** 2026-04-12
**Status:** Approved

## Overview

Add external metadata enrichment to recommendation cards using TVDB (TV shows) and TMDB (movies). Both API keys are optional environment variables — the app degrades gracefully when either or both are missing.

**Primary goal:** Enrich recommendation cards with posters, overviews, genres, ratings, and cast/crew data.
**Secondary goal:** Opportunistically feed cached cast/crew data into AI prompts when the user asks for actor/director-based recommendations.

## Architecture

Two new service clients (`tvdb-client.ts` and `tmdb-client.ts`) fetch metadata from their respective APIs and normalize it into a shared `MediaMetadata` shape. A `metadata_cache` database table stores fetched metadata with TTL-based expiry. New API routes expose metadata to the frontend on demand.

### Service Clients

#### `tvdb-client.ts`

TVDB v4 API (`https://api4.thetvdb.com/v4`):

- Authenticates with the API key at `/login` to get a bearer token
- Token cached in memory, refreshed on expiry
- Methods: `searchSeries(query, year?)`, `getSeriesById(tvdbId)`, `getSeriesExtended(tvdbId)` (for cast/crew)
- Returns normalized `MediaMetadata`

#### `tmdb-client.ts`

TMDB API (`https://api.themoviedb.org/3`):

- No auth flow — API key passed as query parameter
- Methods: `searchMovie(query, year?)`, `getMovieById(tmdbId)`, `getMovieCredits(tmdbId)`
- Returns normalized `MediaMetadata`

#### Shared Types

```ts
interface MediaMetadata {
	externalId: number;
	source: "tvdb" | "tmdb";
	title: string;
	overview: string | undefined;
	posterUrl: string | undefined;
	genres: string[];
	rating: number | undefined;
	year: number | undefined;
	cast: CreditPerson[];
	crew: CreditPerson[];
	status: string | undefined;
}

interface CreditPerson {
	name: string;
	role: string;
	character: string | undefined;
}
```

Both clients throw on network errors but return `undefined` for 404s (media not found). The route layer handles fallback logic.

## Database

### `metadata_cache` Table

| Column     | Type    | Notes                                |
| ---------- | ------- | ------------------------------------ |
| id         | integer | Primary key, autoincrement           |
| externalId | integer | Not null                             |
| source     | text    | `"tvdb"` or `"tmdb"`, not null       |
| mediaType  | text    | `"movie"` or `"show"`, not null      |
| title      | text    | Not null                             |
| overview   | text    | Nullable                             |
| posterUrl  | text    | Nullable                             |
| genres     | text    | JSON array stored as string          |
| rating     | real    | Nullable                             |
| year       | integer | Nullable                             |
| cast       | text    | JSON array of `CreditPerson`         |
| crew       | text    | JSON array of `CreditPerson`         |
| status     | text    | Nullable (e.g., "Ended", "Released") |
| fetchedAt  | integer | Unix timestamp, not null             |

- Unique constraint on `(externalId, source)`
- TTL: re-fetch if `fetchedAt` is older than 7 days

JSON fields (`genres`, `cast`, `crew`) are serialized strings parsed on read.

## Schema Changes to Existing Tables

### `recommendations` Table

The existing `recommendations` table has a `tmdbId` column but no `tvdbId`. This implementation adds:

- `tvdbId` (integer, nullable) — populated when media is looked up via Sonarr or resolved via TVDB search

**Metadata route lookup strategy:**

- **Movies:** Use the existing `tmdbId` to query TMDB directly by ID. If `tmdbId` is null, fall back to search by title+year.
- **TV shows:** Use `tvdbId` to query TVDB directly by ID. If `tvdbId` is null, fall back to search by title+year. When a search resolves a TVDB ID, backfill the `tvdbId` on the recommendation for future lookups.

## API Routes

New route file: `src/server/routes/metadata.ts` (behind existing auth middleware).

### `GET /api/metadata/:recommendationId`

Primary endpoint for the frontend.

1. Looks up the recommendation to get title, year, media type, and external IDs (`tmdbId`/`tvdbId`)
2. Determines source: `tmdb` for movies, `tvdb` for shows
3. Checks `metadata_cache` for a non-expired entry (by external ID if available, or title+year+source)
   - Cached and fresh: return it
   - Missing or expired: fetch from appropriate API client (by ID or title+year search), upsert into cache, return it
4. If a search resolved an external ID and the recommendation lacks one, backfill the ID on the recommendation
5. If the relevant API key is not configured: returns `{ available: false }`
6. If the API call fails (network error, not found): returns `{ available: false }`

### `GET /api/metadata/status`

Returns which metadata sources are available based on configured env vars.

```json
{ "tvdb": true, "tmdb": false }
```

The frontend uses this to conditionally show/hide metadata UI elements and avoid unnecessary per-card requests.

## Frontend Integration

The existing `RecommendationCard` component gains optional metadata enrichment:

- On mount (or user interaction), calls `GET /api/metadata/:recommendationId`
- If `available: true`: displays poster image, overview, genres, rating, and a collapsible cast/crew section
- If `available: false`: card looks exactly as it does today
- Uses `/api/metadata/status` (fetched once on app load) to skip per-card requests when no keys are configured

No new pages or settings UI needed — API keys are env vars.

## AI Prompt Enrichment

Opportunistic enrichment using cached metadata:

- When the user's message contains keywords suggesting cast/director interest (e.g., "actor", "director", "cast", "starring", "same crew"), the chat route pulls cached metadata for relevant watch history items
- A new helper in `prompt-builder.ts` formats a concise cast/crew summary to append to the system prompt
- Only uses already-cached metadata — does not trigger new API fetches at chat time
- Detection is simple keyword matching, not AI-powered intent detection

## Environment Variables

### New Variables (both optional)

| Variable       | Description                          |
| -------------- | ------------------------------------ |
| `TVDB_API_KEY` | TVDB v4 API key for TV show metadata |
| `TMDB_API_KEY` | TMDB API key for movie metadata      |

### Constants (in code)

| Constant                  | Value | Description                               |
| ------------------------- | ----- | ----------------------------------------- |
| `METADATA_CACHE_TTL_DAYS` | 7     | Days before cached metadata is re-fetched |
| `CAST_LIMIT`              | 10    | Max cast members stored per item          |
| `CREW_LIMIT`              | 5     | Max crew members stored per item          |

### Graceful Degradation

| TVDB key | TMDB key | Behavior                                      |
| -------- | -------- | --------------------------------------------- |
| Set      | Set      | Full metadata for both movies and TV shows    |
| Set      | Missing  | TV show metadata only, movies show basic info |
| Missing  | Set      | Movie metadata only, TV shows show basic info |
| Missing  | Missing  | App works exactly as it does today            |

## Future Enhancement: Admin Settings UI

**Not in scope for this implementation.**

- Admin-only section in the Settings page to configure TVDB/TMDB API keys through the UI
- Keys encrypted at rest using the existing `encryption.ts` service
- Stored in a new table or the existing `settings` table
- UI-configured keys take precedence over env vars (env vars serve as defaults)
- Only admin users can view/modify these settings

## Documentation Updates

- Add `TVDB_API_KEY` and `TMDB_API_KEY` to `docs/` env var reference and root README
- Update CLAUDE.md architecture section with new routes and services
