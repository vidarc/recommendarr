---
name: Metadata route follow-ups
description: Two remaining cleanups on src/server/routes/metadata.ts (PR #44 review)
type: project
---

Opportunistic cleanups in `src/server/routes/metadata.ts`. Pick up when touching this file — neither is urgent.

1. **`FIRST = 0` magic-constant workaround.** The route has `const FIRST = 0` purely to appease `no-magic-numbers`. Inline if the lint rule is ever relaxed for array indexing.

2. **Cache parse trust boundary.** `deserializeMetadata` runs `JSON.parse` + `zod.parse` on every cache hit (genres/cast/crew). Cache rows are written by our own `serializeMetadata`, so a trusted fast path would be safe. Only worth doing if profiling shows it matters.

**How to apply:** Self-contained; either can land in a passing-through PR.
