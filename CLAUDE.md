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
- Database: SQLite
- Build/Test/Lint: Vite+ (`yarn vp`)
- Docker: This project is built into a docker image
- Formatting: tabs (enforced by Oxfmt in `vite.config.ts`)
- Dependencies use exact version pinning (no semver prefix)

## Common Commands

```bash
yarn vp dev          # Start development server
yarn vp build        # Build for production
yarn vp test         # Run all tests
yarn vp test <file>  # Run a single test file
yarn vp check        # Run format + lint + typecheck
yarn vp lint         # Lint only
yarn vp fmt          # Format only
```

## Project Structure

- `src/server` — Fastify backend
- `src/client` — React frontend
- `src/shared` — Shared types and utilities
- Tests are colocated as `*.test.ts` files alongside source (pattern: `src/**/*.test.ts`)

## Workflows

- Always make a plan first, then work on the implementation

## Architecture

### Server

The server uses a factory pattern: `buildServer()` in `src/server/app.ts` creates and returns the Fastify instance, while `src/server/server.ts` is the entry point that calls it, starts listening, and handles graceful shutdown via `close-with-grace`.

Add new routes and plugins by registering them inside `buildServer()` before `await app.ready()`.

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

## Auto-Update Memory (MANDATORY)

**Update memory files AS YOU GO, not at the end.** When you learn something new, update immediately.

| Trigger                             | Action                                   |
| ----------------------------------- | ---------------------------------------- |
| User shares a fact about themselves | → Update `memory-profile.md`             |
| User states a preference            | → Update `memory-preferences.md`         |
| A decision is made                  | → Update `memory-decisions.md` with date |
| Completing substantive work         | → Add to `memory-sessions.md`            |

Create any other types of memory files that make sense.

**Skip:** Quick factual questions, trivial tasks with no new info.

**DO NOT ASK. Just update the files when you learn something.**
