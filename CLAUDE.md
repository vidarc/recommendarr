# recommendarr

## Project Overview & Goals

This project is an AI based recommendation engine for use of the \*arr stack (radarr, sonarr, lidarr) and Plex. It will use the watch history of the user from their plex server + their chosen AI model to recommend other movies, TV shows, or music.

## Technology Stack

- Package Manager: `yarn`
- Language: Typescript
- Backend: Fastify
- Frontend: React
- Database: SQLite

## Project Structure

- Server code is kept in `src/server`
- Fronend code is kept in `src/client`
- Any shared code is kept in `src/shared`
- Tests are colocated under the `__tests__` folder

## Development Workflow

- Use `yarn` to install packages
- Use `yarn vp` to run all the vite-plus commands

## Testing and Quality Standards

- `vitest` is used for all unit testing
- `playwright` is used for all e2e testing
- Unit tests should mock as little as possible
  - Minimal use of `vi.fn()`
  - Instead make use of mocking libraries like `mswjs` for mocks
  - test as much of the actual code as possible

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
