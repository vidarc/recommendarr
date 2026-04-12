# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview & Goals

This project is an AI based recommendation engine for use of the \*arr stack (radarr, sonarr, lidarr) and Plex. It will use the watch history of the user from their plex server + their chosen AI model to recommend other movies, TV shows, or music.

## Technology Stack

- Package Manager: `yarn`
- Runtime: Node24
- Language: TypeScript (strictest mode via `@tsconfig/strictest`)
- Backend: Fastify v5
- Frontend: React + wouter (routing)
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

- `src/server` — Fastify backend
  - `routes/` — Route handlers (auth, health, plex, ai, chat)
  - `services/` — Business logic (auth-utils, session, encryption, plex-api, ai-client, prompt-builder, response-parser)
  - `middleware/` — Request middleware (auth — session-based authentication via httpOnly cookies)
  - Root: app factory, entry point, db plugin, SSR plugin, schema
- `src/client` — React frontend
  - `pages/` — Route-level page components (Login, Register, Settings, Recommendations, History)
  - `components/` — Reusable UI primitives (FormField, AuthFooter, AppLayout, ChatControls, ChatInput, ChatMessage, RecommendationCard)
  - `features/` — Feature-scoped state (auth/auth-slice)
  - Root: entry points, store, api, theme, global styles
- `docs/` — Architecture decisions, API docs, environment variable reference
- Tests: `__tests__/` folders colocated with source (e.g., `src/client/pages/__tests__/Login.test.tsx`)

## Workflows

- Always make a plan first, then work on the implementation
- When modifying files, keep changes scoped to what was requested. Do not fix or refactor unrelated code unless explicitly asked. If you discover pre-existing issues, mention them but ask before fixing.

## TypeScript Standards

- This is a TypeScript project. All source files use TypeScript.
- Use modern types — avoid deprecated React types (e.g., use `SubmitEvent` not `React.FormEvent` or `SyntheticEvent`).
- Fix all lint errors before considering a task complete.

## Testing

- Always run the full test suite after changes: `yarn vp test`
- Test files use `.test.ts` / `.test.tsx` naming (NOT `.spec.ts`)
- When fixing test failures, check for ALL occurrences of changed patterns (e.g., status codes, error types) across the entire test suite, not just the first match.

## Environment & Ports

- Always read .env file before assuming ports or connection strings. The code defaults to port 3000, but `.env` overrides it to 8080 for local dev.
- For local dev: `yarn dev`. For Docker: check docker-compose.yml.

## Project Conventions

- When modifying tsconfig files, preserve `extends` fields unless explicitly asked to remove them

## Logging

- All new features and bug fixes should include appropriate log statements
- Use `request.log` in route handlers (inherits request context like reqId)
- Use `app.log` in plugins/startup code where no request is available
- Log levels:
  - `debug` — verbose operational detail (API calls, fetched counts, intermediate steps)
  - `info` — significant actions (user login, config saved, sync completed, media added)
  - `warn` — recoverable issues (failed login, expired session, missing config)
  - `error` — unexpected failures (caught exceptions, background task failures)
- Never log sensitive data (passwords, API keys, auth tokens, encryption keys)
- Include structured context as the first argument: `request.log.info({ userId, title }, "media added")`

## Debugging Approach

- When fixing browser-specific issues (especially WebKit), investigate ALL related CSP/security directives, not just the obvious ones
- When tracing UI bugs (e.g., HTML nesting warnings), search the actual rendered component tree, not just test files
- Scope fixes to what was requested — don't expand to fix pre-existing issues without asking first

## Git & Commits

- Keep commits simple and fast. Do not add unnecessary steps before committing.
- When asked to commit, just stage and commit — don't re-run full verification unless explicitly asked.

## Architecture

### Server

The server uses a factory pattern: `buildServer()` in `src/server/app.ts` creates and returns the Fastify instance, while `src/server/server.ts` is the entry point that calls it, starts listening, and handles graceful shutdown via `close-with-grace`.

Add new routes and plugins by registering them inside `buildServer()` before `await app.ready()`.

`buildServer()` accepts an optional `{ skipSSR?: boolean, skipDB?: boolean }` options object. Tests pass `{ skipSSR: true }` to avoid loading Vite/SSR dependencies. Tests that don't need the database pass `{ skipDB: true }`.

**Database:**

The app uses SQLite via `better-sqlite3` + Drizzle ORM. The `dbPlugin` in `src/server/db.ts`:

- Opens/creates a database at `DATABASE_PATH` env var (default: `./data/recommendarr.db`)
- Enables WAL mode for better concurrency
- Runs migrations (tables: `settings`, `users`, `sessions`, `plex_connections`, `ai_configs`, `conversations`, `messages`, `recommendations`, `arr_connections`, `library_items`, `user_settings`)
- Decorates Fastify with `app.db` (Drizzle instance) and `app.sqlite` (raw better-sqlite3 instance) for route access
- Closes the database on server shutdown

Schema is defined in `src/server/schema.ts` using Drizzle's `sqliteTable` builder functions. Zod schemas are auto-generated from the Drizzle schema via `createSelectSchema`/`createInsertSchema` from `drizzle-orm/zod`. Routes use `app.db` with Drizzle queries (e.g. `app.db.select().from(settings).all()`).

**Validation:**

Fastify uses `fastify-type-provider-zod` for request/response validation and type inference. The validator and serializer compilers are set in `buildServer()`. Routes define Zod schemas in their `schema` option for `body`, `querystring`, `params`, and `response` — Fastify auto-validates at runtime and infers TypeScript types in handlers. Use `app.withTypeProvider<ZodTypeProvider>()` when registering routes.

**Current routes:**

- `GET /ping` — health check, returns `{ "status": "ok" }` (also used by Docker health check)
- `GET /health` — returns `{ "status": "ok", "uptime": number }` — uptime in seconds via `process.uptime()`
- `GET /api/auth/setup-status` — returns `{ "needsSetup": boolean }` indicating if any users exist
- `POST /api/auth/register` — creates a new user; first user becomes admin, sets session cookie
- `POST /api/auth/login` — authenticates a user by username/password, sets session cookie
- `GET /api/auth/me` — returns the currently authenticated user from session cookie
- `POST /api/auth/logout` — deletes the server-side session and clears the session cookie
- `GET /api/settings` — returns all settings from the database as a JSON key-value object
- `POST /api/plex/auth/start` — initiates Plex OAuth flow, returns PIN ID and auth URL
- `GET /api/plex/auth/check` — checks if a Plex PIN has been claimed, stores encrypted auth token
- `GET /api/plex/servers` — returns available Plex servers for the user
- `POST /api/plex/servers/select` — saves the selected Plex server
- `POST /api/plex/auth/manual` — stores a manually-provided Plex auth token and server URL
- `DELETE /api/plex/connection` — removes the user's Plex connection
- `GET /api/plex/libraries` — returns libraries on the selected Plex server
- `GET /api/ai/config` — returns the user's AI configuration (API key masked)
- `PUT /api/ai/config` — creates or updates AI configuration (API key encrypted)
- `DELETE /api/ai/config` — removes the user's AI configuration
- `POST /api/ai/test` — tests the saved AI configuration by connecting to the endpoint
- `POST /api/chat` — sends a message for AI recommendations, creates/continues conversations
- `GET /api/conversations` — lists all conversations for the user
- `GET /api/conversations/:id` — returns a conversation with all messages and recommendations
- `DELETE /api/conversations/:id` — deletes a conversation and its messages/recommendations
- `GET /api/arr/config` — returns the user's arr connections (API keys masked)
- `PUT /api/arr/config/:serviceType` — creates or updates an arr connection (API key encrypted)
- `DELETE /api/arr/config/:serviceType` — removes an arr connection
- `POST /api/arr/test` — tests a saved arr connection
- `GET /api/arr/options/:serviceType` — returns root folders and quality profiles for an arr service
- `POST /api/arr/lookup` — searches an arr service for media
- `POST /api/arr/add` — adds media to an arr service, updates recommendation
- `PATCH /api/recommendations/:id/feedback` — sets, toggles, or clears thumbs-up/thumbs-down feedback on a recommendation
- `POST /api/library/sync` — triggers manual library sync, returns item counts
- `GET /api/library/status` — returns last synced time, interval, item counts, and exclude default
- `PUT /api/library/settings` — updates sync interval and exclude-library default
- `GET /*` — SSR catch-all (registered last so API routes take priority)

### SSR

The app uses Vite's built-in SSR with Fastify:

- **Dev**: Vite runs in middleware mode via `@fastify/middie`. `ssrLoadModule` renders `entry-server.tsx` on each request with HMR support.
- **Prod**: Pre-built SSR bundle (`dist/ssr/entry-server.js`) renders HTML. `@fastify/static` serves client assets from `dist/client/assets/`.
- **Entry points**: `entry-client.tsx` (hydration via `hydrateRoot`) and `entry-server.tsx` (server render via `renderToString`). The SSR entry accepts a URL string for wouter's `<Router ssrPath>` prop.
- **HTML template**: `index.html` contains `<!--ssr-outlet-->` placeholder replaced with rendered HTML.

**Build pipeline** (3 steps, run via `yarn build`):

1. `vp build` — client bundle → `dist/client/`
2. `vp build --ssr` — SSR bundle → `dist/ssr/`
3. `tsc -p tsconfig.server.json` — server TypeScript → `dist/server/`

**Authentication:**

The app uses a `users` table with scrypt-hashed passwords (via `node:crypto`). The first user to register becomes admin. Alternatively, set `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` env vars to create an admin on first boot. Auth uses server-side sessions stored in a `sessions` table with httpOnly cookies. Session cookies automatically set the `Secure` flag based on the detected request protocol (`request.protocol`), so they work correctly over both HTTP (dev/testing) and HTTPS (production behind a TLS-terminating proxy). The server uses `trustProxy: "loopback"` so it trusts `X-Forwarded-Proto` from loopback/private IPs. The `authMiddleware` in `src/server/middleware/auth.ts` validates session cookies on all `/api/` routes (except public routes like login, register, setup-status, and logout). Session duration is controlled by `SESSION_DURATION_DAYS` (default: 7). Secrets (Plex tokens, AI API keys) are encrypted at rest using AES-256-GCM via the `ENCRYPTION_KEY` env var. Client-side auth state lives in a Redux slice (`authSlice`).

**Client-side routing:**

The app uses wouter for routing. Routes: `/login`, `/register`, `/` (recommendations), `/history`, `/settings`. Auth gates redirect unauthenticated users to `/login`, and if no users exist yet, `/login` redirects to `/register`. The `AppLayout` component provides shared navigation.

**Environment variables** (see root `README.md` for full list):

- `PORT` — server port (default: `3000`)
- `HOST` — bind address (default: `0.0.0.0`)
- `ENCRYPTION_KEY` — required, 64-character hex string for AES-256-GCM encryption of stored secrets
- `SESSION_DURATION_DAYS` — session lifetime in days (default: `7`)
- `LOG_LEVEL` — server log level (default: `info`; options: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`)
- `LOG_PRETTY` — set to `true` to enable pretty-printed logs via `pino-pretty`

### Modules

The project uses ESM (`"type": "module"` in package.json). Use `.ts` extensions in imports (e.g. `import { buildServer } from "./app.ts"`).

## Styling

- CSS-in-JS: Linaria (`@linaria/atomic` for component styles, `@linaria/core` for global styles)
- Vite plugin: `@wyw-in-js/vite` — requires `babelOptions: { presets: ["@babel/preset-typescript"] }` to parse TS
- CSS reset: `sanitize.css` + `sanitize.css/typography.css` (imported in `entry-client.tsx`)
- Theme tokens: `src/client/theme.ts` (Night Owl color scheme)
- CSS side-effect imports need declarations in `src/client/css.d.ts`

## Lint Gotchas

- `jsx-max-depth` (max 2): Extract sub-components to avoid nesting violations (e.g., `FormField`, `AuthFooter`)
- `import/no-unassigned-import`: CSS imports are allowed via `["error", { allow: ["**/*.css"] }]`
- `import/group-exports`: Use a single `export { a, b }` statement instead of multiple `export const`

## Import Sorting

- Handled by Oxfmt (not Oxlint) in `fmt.sortImports` in `vite.config.ts`
- Groups: node builtins → packages → source code → type imports → styles/side-effects
- Newlines between groups enforced (`newlinesBetween: true`)

## Testing and Quality Standards

- `vitest` is used for all unit testing (imported from `vite-plus/test`)
- `playwright` is used for all e2e testing
- Unit tests should mock as little as possible
  - Minimal use of `vi.fn()`
  - Prefer `mswjs` for HTTP mocks
  - Test as much of the actual code as possible

## Documentation

Documentation is stored in the `docs` folder. This should be kept up to date with information about all major architectural decisions. It should also list APIs and their requirements and responses. The main file in the documentation should have a list of all the environment variables one can use to customize this service (for example being able to overwrite the PORT).

- When adding new routes or endpoints, update route documentation (e.g., README or docs file) to include the new route, method, and description.
- Keep CLAUDE.md architecture overview in sync with structural changes.

## Auto-Update Memory (MANDATORY)

Memory files live in `.claude/memory/` so they are version-controlled and shared across devices/contributors. `.claude/memory/MEMORY.md` is the index — read it first, then follow links.

**Update memory files AS YOU GO, not at the end.** When you learn something new, update immediately.

Each memory file uses frontmatter (`name`, `description`, `type`) so Claude Code can find and use them. Types: `user`, `feedback`, `project`, `reference`.

| Trigger                             | Action                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| User shares a fact about themselves | → Create/update a `user` type file in `.claude/memory/`     |
| User states a preference            | → Create/update a `feedback` type file in `.claude/memory/` |
| A decision is made                  | → Create/update a `project` file                            |
| Completing substantive work         | → Update `.claude/memory/project_status.md`                 |

Create any other memory files that make sense.

**Skip:** Quick factual questions, trivial tasks with no new info.

**DO NOT ASK. Just update the files when you learn something.**
