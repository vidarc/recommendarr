# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview & Goals

This project is an AI based recommendation engine for use of the \*arr stack (radarr, sonarr, lidarr) and Plex. It will use the watch history of the user from their plex server + their chosen AI model to recommend other movies, TV shows, or music.

## Technology Stack

- Package Manager: `yarn`
- Runtime: Node24
- Language: TypeScript (strictest mode via `@tsconfig/strictest`)
- Backend: Fastify v5
- Frontend: React
- Database: SQLite via better-sqlite3 + Drizzle ORM (v1 beta)
- Validation: Zod (integrated with Drizzle via `drizzle-orm/zod` and Fastify via `fastify-type-provider-zod`)
- Build/Test/Lint: Vite+ (`yarn vp`)
- Docker: This project is built into a docker image
- Formatting: tabs (enforced by Oxfmt in `vite.config.ts`)
- Dependencies use exact version pinning (no semver prefix)

## Docker

- Dockerfile targets Node 24 with pinned versions
- When modifying dependencies or build steps, verify Dockerfile stays consistent

## Common Commands

```bash
yarn dev             # Start dev server (Fastify + Vite SSR middleware)
yarn build           # Build client, SSR bundle, and server
yarn vp test         # Run all tests
yarn vp test <file>  # Run a single test file
yarn vp check        # Run format + lint + typecheck
yarn vp lint         # Lint only
yarn vp fmt          # Format only
```

## Project Structure

- `src/server` — Fastify backend (exists)
- `src/client` — React frontend (exists: `App.tsx`, `index.html`, `entry-client.tsx`, `entry-server.tsx`)
- `src/shared` — Shared types and utilities (planned, not yet created)
- `docs/` — Architecture decisions, API docs, environment variable reference
- Tests are colocated as `*.test.ts` files alongside source (pattern: `src/**/*.test.ts`)

## Workflows

- Always make a plan first, then work on the implementation

## Architecture

### Server

The server uses a factory pattern: `buildServer()` in `src/server/app.ts` creates and returns the Fastify instance, while `src/server/server.ts` is the entry point that calls it, starts listening, and handles graceful shutdown via `close-with-grace`.

Add new routes and plugins by registering them inside `buildServer()` before `await app.ready()`.

`buildServer()` accepts an optional `{ skipSSR?: boolean, skipDB?: boolean }` options object. Tests pass `{ skipSSR: true }` to avoid loading Vite/SSR dependencies. Tests that don't need the database pass `{ skipDB: true }`.

**Database:**

The app uses SQLite via `better-sqlite3` + Drizzle ORM. The `dbPlugin` in `src/server/db.ts`:

- Opens/creates a database at `DATABASE_PATH` env var (default: `./data/recommendarr.db`)
- Enables WAL mode for better concurrency
- Runs migrations (currently: `settings` table)
- Decorates Fastify with `app.db` (Drizzle instance) and `app.sqlite` (raw better-sqlite3 instance) for route access
- Closes the database on server shutdown

Schema is defined in `src/server/schema.ts` using Drizzle's `sqliteTable` builder functions. Zod schemas are auto-generated from the Drizzle schema via `createSelectSchema`/`createInsertSchema` from `drizzle-orm/zod`. Routes use `app.db` with Drizzle queries (e.g. `app.db.select().from(settings).all()`).

**Validation:**

Fastify uses `fastify-type-provider-zod` for request/response validation and type inference. The validator and serializer compilers are set in `buildServer()`. Routes define Zod schemas in their `schema` option for `body`, `querystring`, `params`, and `response` — Fastify auto-validates at runtime and infers TypeScript types in handlers. Use `app.withTypeProvider<ZodTypeProvider>()` when registering routes.

**Current routes:**

- `GET /ping` — health check, returns `{ "status": "ok" }` (also used by Docker health check)
- `GET /health` — returns `{ "status": "ok", "uptimeSeconds": number }` — uptime is measured from when `buildServer()` is called
- `GET /api/settings` — returns all settings from the database as a JSON key-value object
- `GET /*` — SSR catch-all (registered last so API routes take priority)

### SSR

The app uses Vite's built-in SSR with Fastify:

- **Dev**: Vite runs in middleware mode via `@fastify/middie`. `ssrLoadModule` renders `entry-server.tsx` on each request with HMR support.
- **Prod**: Pre-built SSR bundle (`dist/ssr/entry-server.js`) renders HTML. `@fastify/static` serves client assets from `dist/client/assets/`.
- **Entry points**: `entry-client.tsx` (hydration via `hydrateRoot`) and `entry-server.tsx` (server render via `renderToString`).
- **HTML template**: `index.html` contains `<!--ssr-outlet-->` placeholder replaced with rendered HTML.

**Build pipeline** (3 steps, run via `yarn build`):

1. `vp build` — client bundle → `dist/client/`
2. `vp build --ssr` — SSR bundle → `dist/ssr/`
3. `tsc -p tsconfig.server.json` — server TypeScript → `dist/server/`

**Environment variables** (see `docs/README.md` for full list):

- `PORT` — server port (default: `3000`)
- `HOST` — bind address (default: `0.0.0.0`)

### Modules

The project uses ESM (`"type": "module"` in package.json). Use `.ts` extensions in imports (e.g. `import { buildServer } from "./app.ts"`).

## Testing and Quality Standards

- `vitest` is used for all unit testing (imported from `vite-plus/test`)
- `playwright` is used for all e2e testing
- Unit tests should mock as little as possible
  - Minimal use of `vi.fn()`
  - Prefer `mswjs` for HTTP mocks
  - Test as much of the actual code as possible

## Documentation

Documentation is stored in the `docs` folder. This should be kept up to date with information about all major architechural decisions. It should also list APIs and their requirements and responses. The main file in the documentation should have a list of all the environment variables one can use to customize this service (for example being able to overwrite the PORT).

- When adding new routes or endpoints, update route documentation (e.g., README or docs file) to include the new route, method, and description.
- Keep CLAUDE.md architecture overview in sync with structural changes.

## Auto-Update Memory (MANDATORY)

Memory files live in `.claude/memory/` so they are version-controlled and shared across devices/contributors. `.claude/memory/MEMORY.md` is the index — read it first, then follow links.

**Update memory files AS YOU GO, not at the end.** When you learn something new, update immediately.

Each memory file uses frontmatter (`name`, `description`, `type`) so Claude Code can find and use them. Types: `user`, `feedback`, `project`, `decision`, `reference`.

| Trigger                             | Action                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| User shares a fact about themselves | → Create/update a `user` type file in `.claude/memory/`     |
| User states a preference            | → Create/update a `feedback` type file in `.claude/memory/` |
| A decision is made                  | → Create/update a `project` or `decision` file              |
| Completing substantive work         | → Update `.claude/memory/project_status.md`                 |

Create any other memory files that make sense.

**Skip:** Quick factual questions, trivial tasks with no new info.

**DO NOT ASK. Just update the files when you learn something.**
