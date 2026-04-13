---
name: Metadata route follow-ups
description: Deferred cleanups on /api/metadata/:recommendationId — most landed 2026-04-13, two remain
type: project
---

Follow-ups for `src/server/routes/metadata.ts` logged during PR #44 review.

**Why:** The metadata enrichment PR shipped with ownership scoping, tmdbId backfill, and a MetadataPanel unit test. The items below are code-hygiene / UX refinements that didn't justify blocking the merge.

**How to apply:** Pick up one at a time when touching `routes/metadata.ts` or when doing a broader cleanup sweep. Each is self-contained.

### Landed 2026-04-13

1. **Differentiate upstream failures from "not found".** ✅ The catch-all now returns `502 BAD_GATEWAY` with `{ error: "Metadata provider unavailable" }` and logs `errorName` + `errorMessage`. Only the genuine "search returned nothing" branches still emit `{ available: false }`. Client (`MetadataPanel`) still renders "No additional info available." on error since RTK Query sets `data` to undefined — retry is possible by collapsing + re-expanding the panel.

2. **`metadata_cache.mediaType` column.** ✅ Dropped via migration `drizzle/20260413164250_stale_eddie_brock`. Removed from `serializeMetadata` in the route.

3. **`resolveMetadata` inline rec type.** ✅ Replaced with `Pick<typeof recommendations.$inferSelect, "mediaType" | "tmdbId" | "tvdbId" | "title" | "year">` via a `RecommendationForMetadata` type alias.

### Still open

3. **`FIRST = 0` magic-constant workaround.** `routes/metadata.ts` still has `const FIRST = 0` purely to appease `no-magic-numbers`. Inline if the lint rule is ever relaxed for array indexing.

4. **Cache parse trust boundary.** `deserializeMetadata` still runs `JSON.parse` + `zod.parse` on every cache hit (genres/cast/crew). Since cache rows are written by our own `serializeMetadata`, a trusted fast path would be safe but only worth doing if profiling shows it matters.
