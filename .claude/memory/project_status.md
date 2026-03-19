---
name: project_status
description: Current state of recommendarr — what exists, what's in progress, what's planned
type: project
---

As of 2026-03-19, the project has:

- Fastify backend with /ping, /health, and /api/settings routes
- SQLite database via better-sqlite3 + Drizzle ORM (v1 beta), with WAL mode, settings table, Fastify plugin pattern
- Drizzle schema in src/server/schema.ts with auto-generated Zod schemas via drizzle-orm/zod
- Zod validation on all routes via fastify-type-provider-zod (runtime validation + type inference)
- React frontend with Redux Toolkit (RTK Query) fetching and displaying settings from the API
- Vite+ toolchain configured with yarn as package manager
- Docker setup targeting Node 24 with native build tools for better-sqlite3
- No AI/recommendation logic implemented yet

**Why:** Tracking project state helps orient future conversations quickly.
**How to apply:** Use this to understand what exists before suggesting new work.
