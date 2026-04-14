---
name: Use zod/mini with namespace import
description: Always import zod as `import * as z from "zod/mini"` and use its functional API
type: feedback
---

Always import zod via `import * as z from "zod/mini"`. Never use `import { z } from "zod"` or `import * as z from "zod"`.

**Why:** `zod/mini` provides the best tree-shaking for zod v4 — the namespace-star import combined with the functional API lets bundlers drop unused validators from the final build. The project was explicitly refactored onto this pattern.

**How to apply:** Use the functional API, not chained methods:

- `z.string().min(n)` → `z.string().check(z.minLength(n))`
- `z.number().min(n).max(m)` → `z.number().check(z.gte(n), z.lte(m))`
- `z.string().url()` → `z.url()`
- `z.number().int()` → `z.int()`
- `schema.optional()` → `z.optional(schema)`
- `schema.nullable()` → `z.nullable(schema)`
- `schema.default(v)` → `z._default(schema, v)`
- `a.or(b)` → `z.union([a, b])` (or `z.optional(z.nullable(...))` when representing "nullable and optional")
- `schema.transform(fn)` → `z.pipe(schema, z.transform(fn))`

`z.object`, `z.array`, `z.enum`, `z.literal`, `z.discriminatedUnion`, `z.coerce.*`, `z.infer` are unchanged.

`drizzle-orm/zod` and `fastify-type-provider-zod` interop with zod/mini schemas via the shared `$ZodType` base — no adapter needed. `src/server/schema.ts` is the one exception: it uses `createSelectSchema`/`createInsertSchema` from `drizzle-orm/zod` which internally generates regular zod schemas. That's fine — leave it alone.
