# Arr Integration Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Radarr and Sonarr integration — connection management + add-to-library flow

## Overview

Enable users to connect their Radarr and Sonarr instances, then add AI-recommended movies/shows directly to those services from recommendation cards. The existing database schema (`arrConnections` table, `addedToArr` field on recommendations) and disabled UI placeholders provide the foundation.

## Design Decisions

| Decision            | Choice                                                   | Rationale                                                                  |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Initial scope       | Radarr + Sonarr only                                     | Lidarr deferred — music recommendations not yet supported                  |
| Add-to-library UX   | Quick modal with root folder + quality profile selection | Gives user control without overcomplicating the default path               |
| TMDB/media matching | Lookup at add-time via arr service's built-in search     | Most reliable — arr services handle matching, user confirms correct result |
| Test connection     | Yes, via `/api/v3/system/status`                         | Consistent with existing AI config pattern                                 |
| Duplicate handling  | Show "Already in library" in lookup modal, disable add   | Clean UX — user sees status before committing                              |

## 1. Backend Service: `arr-client.ts`

A service abstracting Radarr/Sonarr behind a common interface. Both use the v3 API structure with `X-Api-Key` header auth. Note: current Radarr (v5.x) and Sonarr (v4.x) releases still serve the v3 API paths. All functions receive `url` and `apiKey` as parameters (decrypted by the route layer).

### Functions

- **`testConnection(url, apiKey)`** — `GET /api/v3/system/status`. Returns success/failure with service version info.
- **`getRootFolders(url, apiKey)`** — `GET /api/v3/rootfolder`. Returns available root folders (id, path, freeSpace).
- **`getQualityProfiles(url, apiKey)`** — `GET /api/v3/qualityprofile`. Returns quality profiles (id, name).
- **`lookupMedia(url, apiKey, serviceType, title, year?)`** — Radarr: `GET /api/v3/movie/lookup?term=...`. Sonarr: `GET /api/v3/series/lookup?term=...`. Returns matches with title, year, overview, and whether the item already exists in the library. Note: images are not included in the response to avoid CSP complications — text-only results in the modal.
- **`addMedia(url, apiKey, serviceType, mediaData)`** — Radarr: `POST /api/v3/movie`. Sonarr: `POST /api/v3/series`. Adds the selected media with the user's chosen root folder and quality profile. Radarr calls include `minimumAvailability: "released"` as the default. Sonarr calls include `monitored: true`, `seasonFolder: true`, and `seriesType: "standard"` as defaults.

### Post-add: persist `tmdbId`

After a successful add, update the recommendation's `tmdbId` field with the TMDB ID from the arr lookup result. This avoids re-lookup in future and enables potential TMDB linking later. Note: the client `api.ts` types `tmdbId` as `string` while the schema column is `integer` — fix this type mismatch during implementation.

## 2. Backend Routes: `arr-routes.ts`

Registered as `arrRoutes(app)` in `app.ts`. All endpoints behind `authMiddleware`.

### Endpoints

| Method   | Path                            | Description                                                                                                                                                                                                                                |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/arr/config`               | Returns user's arr connections (API keys masked)                                                                                                                                                                                           |
| `PUT`    | `/api/arr/config/:serviceType`  | Create/update connection for `radarr` or `sonarr`. Encrypts API key, upserts into `arrConnections`.                                                                                                                                        |
| `DELETE` | `/api/arr/config/:serviceType`  | Remove a specific arr connection                                                                                                                                                                                                           |
| `POST`   | `/api/arr/test`                 | Test a saved connection. Body: `{ serviceType }`. Decrypts stored key, calls `testConnection()`. Note: unlike the AI test endpoint, this only tests saved connections (no test-before-save) since arr connections only have URL + API key. |
| `GET`    | `/api/arr/options/:serviceType` | Returns root folders + quality profiles for the connected service (populates the add modal)                                                                                                                                                |
| `POST`   | `/api/arr/lookup`               | Body: `{ serviceType, title, year? }`. Searches the arr service, returns matches with "already exists" status.                                                                                                                             |
| `POST`   | `/api/arr/add`                  | Body: `{ serviceType, recommendationId, lookupId, rootFolderId, qualityProfileId }`. Adds to arr service, updates `addedToArr = true` on the recommendation.                                                                               |

### Validation

All request/response schemas defined with Zod via `fastify-type-provider-zod`, consistent with existing routes. `serviceType` validated as `z.enum(["radarr", "sonarr"])`.

## 3. Frontend: Settings IntegrationsTab

Replace the disabled placeholder with a working form, following patterns from the AI config tab.

### Structure

- **Per-service sections** — Radarr and Sonarr each get their own card with URL + API Key fields
- **RTK Query endpoints** — `getArrConfig`, `updateArrConfig`, `deleteArrConfig`, `testArrConnection`. Add `ArrConfig` to `tagTypes` for cache invalidation on save/delete.
- **Save / Delete / Test buttons** — Same pattern as AI tab
- **Connection status indicator** — Show connected/disconnected state per service
- **No root folder / quality profile selection in settings** — Those are chosen per-recommendation in the add modal

## 4. Frontend: Add-to-Arr Modal

Triggered from the RecommendationCard's "Add to Radarr/Sonarr" button.

### Button State

- **Disabled** — No corresponding arr service connected (tooltip: "Connect Radarr/Sonarr in Settings")
- **Enabled** — Service connected, recommendation not yet added
- **"Added" badge** — `addedToArr` is true, replaces button

### Modal Flow

1. Opens with loading spinner, calls `POST /api/arr/lookup` with recommendation's title + year
2. Displays lookup results as a selectable list (title, year, overview from arr lookup). Items already in library show "Already in library" badge and are not selectable.
3. User selects the correct match
4. Two dropdowns appear: root folder and quality profile (fetched from `GET /api/arr/options/:serviceType`)
5. "Add" button calls `POST /api/arr/add`
6. On success: modal closes, recommendation card updates to show "Added" badge

### Edge Cases

- **No results** — "No matches found" message. More likely when recommendations lack a year — title-only lookups may return many false positives or none for common titles.
- **All results already in library** — Show results with badges, no selectable options
- **Lookup API failure** — Inline error message in modal with retry button
- **Add API failure** — Keep modal open, show error inline with retry button. Do not close modal or mark as added.
- **Network timeout** — Error with retry option

## 5. Testing Strategy

### Unit Tests (Vitest + MSW)

- **`arr-client.ts`** — MSW mocks for all Radarr/Sonarr API endpoints. Cover success paths, error cases (bad URL, invalid key, network failure, non-JSON responses).
- **Frontend components** — IntegrationsTab form interactions (save, test, delete state transitions). RecommendationCard button states (no connection, connected, already added). Modal flow with mocked API responses.

### Integration Tests (Vitest)

- **`arr-routes.ts`** — `buildServer({ skipSSR: true })`, inject requests, verify responses. Mock `arr-client` service to isolate route logic. Test auth requirements, API key encryption/decryption, upsert and delete behavior, validation errors.

### E2E Tests (Playwright)

- Use `page.route()` to intercept outbound Radarr/Sonarr API calls
- Full flow: configure arr connection in settings → verify it persists → navigate to recommendations → click "Add to Radarr" → interact with modal → confirm media gets added
- Validates server/frontend/DB integration without requiring real arr instances

## File Changes Summary

### New Files

- `src/server/services/arr-client.ts` — Arr service client
- `src/server/routes/arr.ts` — Arr route handlers
- `src/client/components/AddToArrModal.tsx` — Add-to-arr modal component
- `src/client/hooks/use-arr-config.ts` — Custom hook for IntegrationsTab state (follows `use-ai-config.ts` pattern)
- `src/server/__tests__/arr.test.ts` — Route integration tests (follows existing `ai.test.ts` location)
- `src/server/__tests__/arr-client.test.ts` — Service unit tests
- `src/client/components/__tests__/AddToArrModal.test.tsx` — Modal component tests
- `e2e/arr-integration.test.ts` — E2E test for full arr flow (follows existing `.test.ts` convention)

### Modified Files

- `src/server/app.ts` — Register `arrRoutes`
- `src/client/api.ts` — Add RTK Query endpoints for arr operations + `ArrConfig` tag type + fix `tmdbId` type (`string` → `number`)
- `src/client/pages/settings/IntegrationsTab.tsx` — Replace placeholder with working form
- `src/client/components/RecommendationCard.tsx` — Enable buttons, wire up modal
- `docs/api.md` — Document new endpoints
- `CLAUDE.md` — Update routes list in architecture section

### Schema Migration

- Add `updatedAt` column to `arrConnections` table to match the pattern used by `plexConnections` and `aiConfigs`. Requires a new Drizzle migration.
