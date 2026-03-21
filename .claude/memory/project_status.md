---
name: project_status
description: Current state of recommendarr — what exists, what's in progress, what's planned
type: project
---

As of 2026-03-21, the project has:

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
- Plex OAuth backend: PIN-based auth flow, server discovery, library listing, watch history — tokens encrypted at rest
- AI configuration backend: per-user ai_configs table, CRUD routes (GET/PUT/DELETE /api/ai/config), connection test (POST /api/ai/test), API keys encrypted at rest and masked in responses
- AI client service: thin fetch wrapper for OpenAI-compatible /v1/chat/completions endpoint (chatCompletion + testConnection functions, no SDK dependency)
- Recommendation chat backend: conversations/messages/recommendations tables, POST /api/chat (creates conversations, fetches Plex history, calls AI, parses recommendations), GET/DELETE /api/conversations endpoints, prompt builder and response parser services
- App layout with sidebar navigation (Recommendations, History, Settings links + logout) wrapping authenticated routes; Dashboard page replaced by placeholder pages pending Tasks 8-10

**Why:** Tracking project state helps orient future conversations quickly.
**How to apply:** Use this to understand what exists before suggesting new work.
