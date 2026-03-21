# Recommendarr MVP Design Spec

## Overview

Recommendarr is an AI-based recommendation engine for Plex users. It uses watch history from a user's Plex server combined with any OpenAI-compatible AI model to generate personalized movie and TV show recommendations through a conversational chat interface.

## Architecture Summary

The app is built as a Fastify + React SSR application with SQLite storage. Features are built as vertical slices in this order:

1. Session management
2. Plex OAuth integration
3. AI provider configuration
4. Recommendation chat
5. Settings page & navigation
6. \*arr integration hooks (design-only)

## Prerequisites

Before implementing the slices above, two foundational issues must be addressed:

1. **Migration strategy** — The current codebase uses raw `CREATE TABLE IF NOT EXISTS` statements. Before adding new tables, switch to Drizzle's migration system so that schema changes are applied safely to existing databases across Docker upgrades.
2. **Fix `dbPlugin` await** — The `dbPlugin` call in `app.ts` is not awaited. Since the plugin is async, the database may not be fully initialized before routes try to use it. This must be fixed before adding session purge-on-startup or any other startup logic.

---

## Section 1: Session Management

### Database

New `sessions` table:

| Column       | Type          | Notes                                       |
| ------------ | ------------- | ------------------------------------------- |
| `id`         | TEXT PK       | Opaque token (crypto.randomUUID or similar) |
| `user_id`    | TEXT NOT NULL | FK to users.id                              |
| `created_at` | TEXT NOT NULL | ISO 8601                                    |
| `expires_at` | TEXT NOT NULL | ISO 8601, default 7 days from creation      |

Expired sessions are purged on server startup.

### API Changes

- `POST /api/auth/login` — creates session row, sets `httpOnly`, `secure`, `sameSite=strict` cookie
- `POST /api/auth/register` — same as login (auto-login after registration)
- `POST /api/auth/logout` — deletes session row, clears cookie
- `GET /api/auth/me` — returns current user from session cookie, or 401

### Auth Middleware

A Fastify `preHandler` hook on all `/api/*` routes except:

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/setup-status`

The middleware reads the session cookie (named `session`), looks up the session in the DB, checks expiry, and attaches `request.user` (`{ id, username, isAdmin }`). Invalid or expired sessions return 401 and clear the cookie.

**Cookie configuration:**

- `httpOnly: true`, `sameSite: "strict"`, `path: "/"`
- `secure: true` only when `NODE_ENV === "production"` (allows HTTP in dev)

### Frontend Changes

- Remove credential storage from Redux auth slice
- On app load, call `GET /api/auth/me` to check session
- Login/register flows rely on cookie being set by the server
- Add logout functionality

---

## Section 2: Plex OAuth Integration

### Plex PIN-Based Auth Flow

1. User clicks "Connect Plex" in settings
2. `POST /api/plex/auth/start` → backend creates a PIN via Plex API, returns `{ pinId, authUrl }`
3. Frontend opens `authUrl` in a new browser window
4. Frontend polls `GET /api/plex/auth/check?pinId=<id>` for PIN status
5. Backend checks PIN status with Plex API. On success, receives auth token → encrypts and stores it
6. `GET /api/plex/servers` → backend uses stored token to list Plex servers
7. `POST /api/plex/servers/select` → user picks a server, backend stores selection

### Database

New `plex_connections` table:

| Column               | Type                 | Notes                                   |
| -------------------- | -------------------- | --------------------------------------- |
| `id`                 | TEXT PK              | UUID                                    |
| `user_id`            | TEXT NOT NULL UNIQUE | FK to users.id, one connection per user |
| `auth_token`         | TEXT NOT NULL        | AES-256-GCM encrypted                   |
| `server_url`         | TEXT                 | Selected server URL                     |
| `server_name`        | TEXT                 | Display name                            |
| `machine_identifier` | TEXT                 | Plex server machine ID                  |
| `created_at`         | TEXT NOT NULL        | ISO 8601                                |
| `updated_at`         | TEXT NOT NULL        | ISO 8601                                |

### API Endpoints

| Method | Path                       | Description                                            |
| ------ | -------------------------- | ------------------------------------------------------ |
| POST   | `/api/plex/auth/start`     | Create Plex PIN, return auth URL                       |
| GET    | `/api/plex/auth/check`     | Poll PIN status (query: pinId), store token on success |
| GET    | `/api/plex/servers`        | List servers using stored token                        |
| POST   | `/api/plex/servers/select` | Save chosen server                                     |
| DELETE | `/api/plex/connection`     | Disconnect Plex, remove stored token                   |
| GET    | `/api/plex/libraries`      | Fetch movie/TV libraries from selected server          |

### Token Encryption

- AES-256-GCM using `ENCRYPTION_KEY` env var
- `ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Used directly as the AES-256 key — no derivation.
- **Required in all environments.** If not set, the server refuses to start with a clear error message. No auto-generation — this prevents data loss from key rotation on restart.
- A CLI helper or startup log message suggests how to generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Used for all stored secrets (Plex token, AI API keys, future \*arr API keys)

### Watch History

Fetched on-demand from Plex API during recommendation generation. Not cached initially — can add caching later if performance is a concern.

**Bounds:** Fetch at most the 200 most recently watched items. If the resulting text exceeds the AI model's context budget, truncate oldest items first. The system prompt should target no more than ~2000 tokens for watch history.

---

## Section 3: AI Configuration

### Settings

Users configure their AI provider with:

- **Endpoint URL** — any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
- **API key** — encrypted at rest
- **Model name** — free text (no hardcoded list)
- **Temperature** — default 0.7
- **Max tokens** — default 2048

### Database

New `ai_configs` table:

| Column         | Type                          | Notes                               |
| -------------- | ----------------------------- | ----------------------------------- |
| `id`           | TEXT PK                       | UUID                                |
| `user_id`      | TEXT NOT NULL UNIQUE          | FK to users.id, one config per user |
| `endpoint_url` | TEXT NOT NULL                 | e.g. `https://api.openai.com/v1`    |
| `api_key`      | TEXT NOT NULL                 | AES-256-GCM encrypted               |
| `model_name`   | TEXT NOT NULL                 | e.g. `gpt-4o`, `llama3`             |
| `temperature`  | REAL NOT NULL DEFAULT 0.7     |                                     |
| `max_tokens`   | INTEGER NOT NULL DEFAULT 2048 |                                     |
| `created_at`   | TEXT NOT NULL                 | ISO 8601                            |
| `updated_at`   | TEXT NOT NULL                 | ISO 8601                            |

### API Endpoints

| Method | Path             | Description                           |
| ------ | ---------------- | ------------------------------------- |
| GET    | `/api/ai/config` | Get user's AI config (API key masked) |
| PUT    | `/api/ai/config` | Create or update AI config            |
| DELETE | `/api/ai/config` | Remove AI config                      |
| POST   | `/api/ai/test`   | Test connection with a simple prompt  |

### AI Client

A thin wrapper around the OpenAI-compatible chat completions API (`/v1/chat/completions`). Uses `fetch` directly — no SDK dependency. This keeps the app truly provider-agnostic.

---

## Section 4: Recommendation Chat

### User Interface

The chat interface is the main experience after setup. It has:

**Top controls:**

- Media type toggle: Movies / TV Shows / Either
- Library scope: Whole library or select specific Plex libraries
- Result count: Number of recommendations desired (default 10)

**Conversation area:**

- Genre buttons (action, comedy, thriller, horror, sci-fi, drama, romance, documentary, animation, etc.)
- Predefined prompt buttons ("more from this director", "similar actors", "this film style")
- Free-text input for custom descriptions
- Streaming or full AI responses with recommendation cards

**Recommendation cards:** Each card displays:

- Title
- Year
- Synopsis
- Media type badge (movie/TV)
- "Add to Radarr" / "Add to Sonarr" button (disabled until \*arr integration)

### Conversational Flow

Users can refine recommendations iteratively:

1. Set scope (media type, libraries, count)
2. Start with a genre pick, predefined prompt, or free-text description
3. Receive recommendations
4. Refine: "less mainstream", "more recent", "something darker", etc.
5. Get updated recommendations
6. Continue or start a new conversation

### Database

New `conversations` table:

| Column       | Type          | Notes                               |
| ------------ | ------------- | ----------------------------------- |
| `id`         | TEXT PK       | UUID                                |
| `user_id`    | TEXT NOT NULL | FK to users.id                      |
| `media_type` | TEXT NOT NULL | `movie`, `tv`, or `either`          |
| `title`      | TEXT          | Auto-generated conversation summary |
| `created_at` | TEXT NOT NULL | ISO 8601                            |

New `messages` table:

| Column            | Type          | Notes                            |
| ----------------- | ------------- | -------------------------------- |
| `id`              | TEXT PK       | UUID                             |
| `conversation_id` | TEXT NOT NULL | FK to conversations.id           |
| `role`            | TEXT NOT NULL | `user`, `assistant`, or `system` |
| `content`         | TEXT NOT NULL | Message text                     |
| `created_at`      | TEXT NOT NULL | ISO 8601                         |

New `recommendations` table:

| Column         | Type                       | Notes                    |
| -------------- | -------------------------- | ------------------------ |
| `id`           | TEXT PK                    | UUID                     |
| `message_id`   | TEXT NOT NULL              | FK to messages.id        |
| `title`        | TEXT NOT NULL              |                          |
| `year`         | INTEGER                    |                          |
| `media_type`   | TEXT NOT NULL              | `movie` or `tv`          |
| `synopsis`     | TEXT                       |                          |
| `tmdb_id`      | INTEGER                    | For future \*arr lookups |
| `added_to_arr` | INTEGER NOT NULL DEFAULT 0 | Boolean                  |

### API Endpoints

| Method | Path                     | Description                                                                       |
| ------ | ------------------------ | --------------------------------------------------------------------------------- |
| POST   | `/api/chat`              | Send message, receive AI response with recommendations (see request schema below) |
| GET    | `/api/conversations`     | List past conversations                                                           |
| GET    | `/api/conversations/:id` | Get full conversation with messages and recommendations                           |
| DELETE | `/api/conversations/:id` | Delete a conversation                                                             |

### `POST /api/chat` Request Schema

```json
{
	"conversationId": "uuid (optional — omit to start a new conversation)",
	"message": "string (user's text, genre pick, or predefined prompt)",
	"mediaType": "movie | tv | either",
	"libraryIds": ["string (optional — Plex library IDs, omit for whole library)"],
	"resultCount": 10
}
```

`mediaType`, `libraryIds`, and `resultCount` are sent with every message (reflecting the current state of the top controls). The conversation's `media_type` column is updated to match the latest `mediaType` sent.

### Response Format

Returns full response (no streaming in MVP). Streaming can be added later as an enhancement.

```json
{
	"conversationId": "uuid",
	"message": "conversational text from AI",
	"recommendations": [
		{ "id": "uuid", "title": "...", "year": 2024, "mediaType": "movie", "synopsis": "..." }
	]
}
```

### Conversation Title Generation

The conversation `title` is auto-generated after the first AI response by asking the AI model to summarize the conversation topic in ≤6 words. This is a separate, cheap API call appended after the main recommendation response.

### Prompt Engineering

System prompt constructed per-request with:

- User's watch history from Plex (recent items, filtered by selected scope/libraries)
- Media type constraint (movie/TV/either)
- Desired recommendation count
- Instruction to return both conversational text AND a structured JSON block of recommendations
- JSON schema for recommendations: `{ title, year, mediaType, synopsis }`

### Response Parsing

The AI response contains conversational text and a structured JSON block. The backend:

1. Parses out the JSON recommendations
2. Saves the full response as a message
3. Saves individual recommendations to the DB
4. Returns both conversational text and structured recommendations to the frontend

---

## Section 5: Settings Page & Navigation

### App Layout

Replace the current bare dashboard with a proper layout:

- Sidebar or top navigation with links to:
  - **Recommendations** (chat interface — main landing page)
  - **History** (past conversations)
  - **Settings**

### Settings Page Sections

**Plex Connection:**

- Connect/disconnect button
- Connected server name and status indicator
- Library list

**AI Configuration:**

- Endpoint URL, API key (masked), model name
- Advanced: temperature, max tokens
- Test connection button

**Account:**

- Change password
- Logout
- Admin users: user management (future)

**Integrations (placeholder):**

- Radarr/Sonarr configuration fields
- Marked as "coming soon" / disabled

---

## Section 6: \*arr Integration Hooks (Design-Only)

Not built in MVP, but schema and UI placeholders are added.

### Database

New `arr_connections` table:

| Column         | Type          | Notes                                      |
| -------------- | ------------- | ------------------------------------------ |
| `id`           | TEXT PK       | UUID                                       |
| `user_id`      | TEXT NOT NULL | FK to users.id                             |
| `service_type` | TEXT NOT NULL | `radarr` or `sonarr` (UNIQUE with user_id) |
| `url`          | TEXT NOT NULL | Service URL                                |
| `api_key`      | TEXT NOT NULL | AES-256-GCM encrypted                      |
| `created_at`   | TEXT NOT NULL | ISO 8601                                   |

### UI

- "Add to Radarr" / "Add to Sonarr" buttons on recommendation cards, rendered but disabled
- Tooltip: "Connect Radarr/Sonarr in Settings to enable"
- Integrations tab in settings with fields for URL and API key, disabled with "coming soon" label

---

## Environment Variables (New)

| Variable                | Required | Default                        | Purpose                                                           |
| ----------------------- | -------- | ------------------------------ | ----------------------------------------------------------------- |
| `ENCRYPTION_KEY`        | Yes      | None (server refuses to start) | 64-char hex string, AES-256-GCM key for encrypting stored secrets |
| `SESSION_DURATION_DAYS` | No       | `7`                            | Session expiry duration                                           |

---

## New Database Tables Summary

| Table              | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `sessions`         | Server-side session storage                 |
| `plex_connections` | Plex auth tokens and server selection       |
| `ai_configs`       | AI provider configuration per user          |
| `conversations`    | Chat conversation metadata                  |
| `messages`         | Individual chat messages                    |
| `recommendations`  | Parsed recommendations from AI responses    |
| `arr_connections`  | \*arr service configs (schema-only for MVP) |

---

## Implementation Order

1. **Session management** — foundation for all authenticated features
2. **Plex OAuth** — connects the data source
3. **AI configuration** — connects the recommendation engine
4. **Recommendation chat** — the core product experience
5. **Settings & navigation** — proper app chrome and configuration UI
6. **\*arr hooks** — schema + disabled UI placeholders
