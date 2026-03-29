---
name: project_status
description: Current state of recommendarr — what exists, what's in progress, what's planned
type: project
---

As of 2026-03-29, the project has:

- Fastify backend with /ping, /health, /api/settings, and auth routes (login, register, setup-status, me, logout)
- Registration is gated: only the first user can register (subsequent registrations return 403)
- SQLite database via better-sqlite3 + Drizzle ORM (v1 beta), with WAL mode, 9 tables (settings, users, sessions, plex_connections, ai_configs, conversations, messages, recommendations, arr_connections), Fastify plugin pattern
- Drizzle schema in src/server/schema.ts with auto-generated Zod schemas via drizzle-orm/zod
- Zod validation on all routes via fastify-type-provider-zod (runtime validation + type inference)
- Session-based auth: httpOnly cookies, scrypt password hashing, session management with expiry purging, validated SESSION_DURATION_DAYS
- AES-256-GCM encryption service for stored secrets (ENCRYPTION_KEY env var required), key cached after first read
- React frontend with Redux Toolkit (RTK Query) — auth state comes from /api/auth/me endpoint (session cookies), not Redux state
- Frontend auth flow: useGetMeQuery() checks session, login/register reset RTK Query cache to trigger refetch
- Vite+ toolchain configured with yarn as package manager
- Docker setup targeting Node 24 with native build tools for better-sqlite3
- Plex connection: OAuth flow + manual token entry, server discovery, library listing, watch history — tokens encrypted at rest
- AI configuration backend: per-user ai_configs table, CRUD routes, connection test, API keys encrypted at rest and masked in responses
- AI client service: thin fetch wrapper for OpenAI-compatible /v1/chat/completions endpoint
- Recommendation chat backend: conversations/messages/recommendations tables, POST /api/chat, conversation CRUD, prompt builder and response parser services
- Title generation uses separate user role message with sanitized input (prompt injection mitigation)
- Conversation detail loads recommendations in a single inArray query (no N+1)
- Conversation deletion wrapped in SQLite transaction
- Arr integration: Radarr/Sonarr connection management, testing, media lookup and add, per-service loading state in UI
- App layout with sidebar navigation wrapping authenticated routes
- Settings page with tabbed UI (ARIA tab roles): Plex Connection, AI Configuration, Account, Integrations
- AddToArrModal with accessible focus management, keyboard-navigable result buttons
- AuthFooter uses wouter Link for SPA navigation
- RTK Query endpoints split into feature-scoped API files with granular per-conversation cache tags
- Plex auth polling properly cancelled on component unmount
- E2E test suite with Playwright: shared auth fixture, tests for navigation, admin login, Plex connection, AI config, arr integration, health check
- Mock services Docker container providing fake Plex (port 9090, including /library/all), Radarr (7878), and Sonarr (8989)
- CI runs e2e tests per browser (chromium, firefox, webkit) sequentially, each with a fresh Docker container

**Why:** Tracking project state helps orient future conversations quickly.
**How to apply:** Use this to understand what exists before suggesting new work.
