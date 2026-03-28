# E2E Test Expansion: Manual Plex Token, Mock Services, and New Test Suites

## Summary

Expand e2e test coverage by:

1. Adding a manual Plex auth token feature (bypasses OAuth for local servers and testing)
2. Introducing Docker Compose mock services for Plex, Radarr, and Sonarr
3. Writing new e2e test suites for Plex connection, AI configuration, and navigation
4. Migrating existing arr integration tests from browser-level mocking to server-level mocking

## Feature: Manual Plex Token Entry

### API

New endpoint: `POST /api/plex/auth/manual`

**Request body:**

```json
{
	"authToken": "string",
	"serverUrl": "string (URL)",
	"serverName": "string"
}
```

**Behavior:**

- Requires authentication (session cookie)
- Encrypts `authToken` using existing AES-256-GCM encryption
- Upserts into `plex_connections` table with `authToken`, `serverUrl`, `serverName`, and a generated `machineIdentifier` (since manual connections don't have one from Plex discovery)
- Returns `{ "success": true }` on success
- Same result as completing the OAuth flow + server selection — downstream code (libraries, watch history) works identically

**Validation:** Zod schema enforces `serverUrl` is a valid URL, `authToken` and `serverName` are non-empty strings.

### UI

Changes to `PlexTab.tsx` — specifically the `PlexNotConnected` component:

- Below the existing "Connect Plex" button, add a collapsible "Manual Connection" section using the same expand/collapse pattern as "Show Advanced Settings" in the AI tab
- When expanded, shows three fields:
  - Auth Token (password input)
  - Server URL (text input, placeholder: `http://192.168.1.100:32400`)
  - Server Name (text input, placeholder: `My Plex Server`)
- "Connect" button submits to `POST /api/plex/auth/manual`
- On success, the UI transitions to the existing `PlexConnectedCard` component showing the server name and Disconnect button
- The existing OAuth flow is unchanged — both paths write to the same `plex_connections` table

### Client API

New RTK Query mutation in `src/client/features/plex/api.ts`:

```typescript
manualPlexAuth: builder.mutation<{ success: boolean }, ManualPlexAuthBody>({
	query: (body) => ({
		url: "api/plex/auth/manual",
		method: "POST",
		body,
	}),
	invalidatesTags: ["PlexConnection"],
});
```

The `invalidatesTags: ["PlexConnection"]` ensures `getPlexServers` refetches after manual connection, which triggers the UI to show the connected state.

## Mock Services

### Architecture

A single Fastify application in `e2e/mock-services/` that creates three server instances on different ports, matching the real service topology:

| Service     | Port | Purpose               |
| ----------- | ---- | --------------------- |
| Mock Plex   | 9090 | Plex media server API |
| Mock Radarr | 7878 | Radarr v3 API         |
| Mock Sonarr | 8989 | Sonarr v3 API         |

### Files

- `e2e/mock-services/mock-server.ts` — main entry point, creates three Fastify instances
- `e2e/mock-services/Dockerfile.mock` — builds from `node:24-slim`, installs fastify, runs the mock server
- `e2e/mock-services/package.json` — minimal package.json with fastify dependency
- `e2e/mock-services/tsconfig.json` — minimal TS config for building the mock

### Health Check

Each mock server instance exposes `GET /healthz` (no auth required) returning `200 OK`. The Docker healthcheck hits the Radarr instance's `/healthz` to confirm the process is ready.

### Mock Plex Endpoints (port 9090)

All endpoints validate that the `X-Plex-Token` header is present (returns 401 if missing).

**`GET /library/sections`**

Returns a `MediaContainer` with two libraries:

```json
{
	"MediaContainer": {
		"Directory": [
			{ "key": "1", "title": "Movies", "type": "movie" },
			{ "key": "2", "title": "TV Shows", "type": "show" }
		]
	}
}
```

**`GET /library/sections/:id/allLeaves`**

Returns a `MediaContainer` with 5-10 fake watch history items:

```json
{
	"MediaContainer": {
		"Metadata": [
			{
				"title": "The Shawshank Redemption",
				"type": "movie",
				"year": 1994,
				"ratingKey": "1001",
				"viewedAt": 1711500000
			}
		]
	}
}
```

### Mock Radarr Endpoints (port 7878)

All endpoints validate the `X-Api-Key` header is present (returns 401 if missing).

| Endpoint                     | Response                                                         |
| ---------------------------- | ---------------------------------------------------------------- |
| `GET /api/v3/system/status`  | `{ "version": "5.3.6" }`                                         |
| `GET /api/v3/rootfolder`     | `[{ "id": 1, "path": "/movies", "freeSpace": 100000000000 }]`    |
| `GET /api/v3/qualityprofile` | `[{ "id": 1, "name": "HD-1080p" }]`                              |
| `GET /api/v3/movie/lookup`   | Array of 2 fake movie results with tmdbId, title, year, overview |
| `POST /api/v3/movie`         | `{ "id": 1 }`                                                    |

### Mock Sonarr Endpoints (port 8989)

Same structure as Radarr with series-oriented paths:

| Endpoint                     | Response                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| `GET /api/v3/system/status`  | `{ "version": "4.0.1" }`                                          |
| `GET /api/v3/rootfolder`     | `[{ "id": 1, "path": "/tv", "freeSpace": 100000000000 }]`         |
| `GET /api/v3/qualityprofile` | `[{ "id": 1, "name": "HD-1080p" }]`                               |
| `GET /api/v3/series/lookup`  | Array of 2 fake series results with tvdbId, title, year, overview |
| `POST /api/v3/series`        | `{ "id": 1 }`                                                     |

### Docker Compose Integration

Update `scripts/docker-compose.yml` to add the mock services container:

```yaml
services:
  mock-services:
    build:
      context: ../e2e/mock-services
      dockerfile: Dockerfile.mock
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:7878/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ]
      interval: 2s
      timeout: 3s
      start_period: 5s
      retries: 3

  recommendarr:
    image: recommendarr:e2e
    depends_on:
      mock-services:
        condition: service_healthy
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      ENCRYPTION_KEY: "97edee5ae27e974c3705ef05bd4a11f6cd1e233ee088de4892bf4417fca402f0"
      NODE_ENV: "production"
    tmpfs:
      - /app/data
```

The app container reaches mocks via the Docker network at `http://mock-services:9090`, `http://mock-services:7878`, `http://mock-services:8989`. No env vars needed — tests configure URLs through the UI.

## New E2E Test Suites

### `e2e/plex-connection.test.ts` (serial)

1. Register a user
2. Navigate to Settings > Plex Connection tab
3. Verify "Connect Plex" button and collapsed "Manual Connection" section are visible
4. Expand manual connection section
5. Fill in auth token, server URL (`http://mock-services:9090`), and server name
6. Click Connect — verify UI transitions to connected state showing the server name
7. Navigate away and back to Settings — verify connection persists
8. Click Disconnect — verify UI returns to not-connected state

### `e2e/ai-config.test.ts` (serial)

1. Register a user
2. Navigate to Settings > AI Configuration tab
3. Fill in endpoint URL, API key, model name and click Save
4. Reload page — verify fields persist (key is masked)
5. Expand advanced settings — verify temperature slider and max tokens field are present
6. Click Test Connection (browser-mocked via `page.route("/api/ai/test")` since the OpenAI SDK is too different from simple REST to mock with a service)
7. Verify success message
8. Click Remove — verify fields clear

### `e2e/navigation.test.ts` (parallel)

1. Register a user, verify landing on `/` (Recommendations page with heading)
2. Click Settings in sidebar — verify `/settings` URL and Settings heading
3. Click History in sidebar — verify `/history` URL and History heading
4. Click Recommendations in sidebar — verify `/` URL and Recommendations heading
5. Navigate to unknown route — verify redirect to `/`

### Changes to `e2e/arr-integration.test.ts`

Replace browser-level `page.route("/api/arr/test")` mock with the real server flow:

- When saving Radarr config, use URL `http://mock-services:7878` instead of `http://radarr.local:7878`
- The "test Radarr connection" test removes the `page.route` intercept entirely — the request flows through Fastify auth middleware, DB lookup, encryption/decryption, arr-client `testConnection()`, and hits the mock Radarr's `/api/v3/system/status`
- This exercises the full server code path

### What Stays Browser-Mocked

- **AI test connection** — the OpenAI SDK client construction is fundamentally different from a REST mock
- **Plex OAuth PIN flow** — the whole point of adding manual token entry is to avoid needing this in tests

## Testing

- All existing e2e tests continue to pass
- New test suites pass across Chromium, Firefox, and WebKit
- Mock services respond correctly with auth validation
- The arr integration test exercises real server code instead of browser intercepts
