---
name: project_status
description: Current state of recommendarr — what exists, what's in progress, what's planned
type: project
---

As of 2026-03-28, the project has:

- Fastify backend with /ping, /health, /api/settings, and auth routes (login, register, setup-status, me, logout)
- SQLite database via better-sqlite3 + Drizzle ORM (v1 beta), with WAL mode, settings/users/sessions/plex_connections tables, Fastify plugin pattern
- Drizzle schema in src/server/schema.ts with auto-generated Zod schemas via drizzle-orm/zod
- Zod validation on all routes via fastify-type-provider-zod (runtime validation + type inference)
- Session-based auth: httpOnly cookies, scrypt password hashing, session management with expiry purging
- AES-256-GCM encryption service for stored secrets (ENCRYPTION_KEY env var required)
- React frontend with Redux Toolkit (RTK Query) — auth state comes from /api/auth/me endpoint (session cookies), not Redux state
- Frontend auth flow: useGetMeQuery() checks session, login/register reset RTK Query cache to trigger refetch
- Vite+ toolchain configured with yarn as package manager
- Docker setup targeting Node 24 with native build tools for better-sqlite3
- Plex connection: OAuth flow + manual token entry (POST /api/plex/auth/manual), server discovery, library listing, watch history — tokens encrypted at rest
- AI configuration backend: per-user ai_configs table, CRUD routes (GET/PUT/DELETE /api/ai/config), connection test (POST /api/ai/test), API keys encrypted at rest and masked in responses
- AI client service: thin fetch wrapper for OpenAI-compatible /v1/chat/completions endpoint (chatCompletion + testConnection functions, no SDK dependency)
- Recommendation chat backend: conversations/messages/recommendations tables, POST /api/chat (creates conversations, fetches Plex history, calls AI, parses recommendations), GET/DELETE /api/conversations endpoints, prompt builder and response parser services
- Arr integration: Radarr/Sonarr connection management (PUT/DELETE /api/arr/config/:serviceType), connection testing (POST /api/arr/test), media lookup and add (POST /api/arr/lookup, POST /api/arr/add), quality profiles and root folders (GET /api/arr/options/:serviceType)
- App layout with sidebar navigation (Recommendations, History, Settings links + logout) wrapping authenticated routes
- Settings page with tabbed UI: Plex Connection (OAuth flow + manual token + server selection + disconnect), AI Configuration (endpoint/key/model form with advanced temp/tokens, test/save/delete), Account (change password — disabled/coming soon), Integrations (Radarr/Sonarr config/test/remove)
- RTK Query endpoints split into feature-scoped API files (auth, plex, ai, arr, chat) using injectEndpoints with tag-based cache invalidation
- E2E test suite with Playwright: shared auth fixture (`e2e/fixtures.ts`), tests for navigation, admin login, Plex connection, AI config, arr integration, health check
- Mock services Docker container (`e2e/mock-services/`) providing fake Plex (port 9090), Radarr (7878), and Sonarr (8989) endpoints for e2e tests
- CI runs e2e tests per browser (chromium, firefox, webkit) sequentially, each with a fresh Docker container

**Why:** Tracking project state helps orient future conversations quickly.
**How to apply:** Use this to understand what exists before suggesting new work.
