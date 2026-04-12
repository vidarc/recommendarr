---
name: Standardize null vs undefined
description: Open question about standardizing on undefined vs null across shared schemas and DB boundary
type: project
---

Investigate standardizing on `undefined` vs `null` across the codebase (shared schemas, wire format, client state).

**Why:** User note — "with undefined you don't have to also check if the input is object. however, if the DB has null values, we might just need to go with null." Currently the codebase is inconsistent: Drizzle/SQLite returns `null` for nullable columns, but wire-format responses sometimes convert null→undefined (e.g., `toFeedback` in `src/server/routes/chat.ts`), and Zod schemas mix `.nullable().optional()` vs `.optional()`. The recommendationSchema feedback field was tightened to `.optional()` only because chat/conversation responses never emit null — but `feedbackBodySchema` / `feedbackResponseSchema` (PATCH endpoint) legitimately use `null` to signal "clear feedback".

**How to apply:** When touching shared schemas or adding new nullable fields, flag the decision explicitly: does the wire format need null (semantic "cleared"), or can it be undefined (absence)? Prefer `undefined` at the client boundary to avoid `value === null || value === undefined` checks. If the DB column is nullable, decide whether to convert at the route boundary (like `toFeedback`) or propagate null through the schema. Bring this up as a dedicated pass before adding many more shared schemas.
