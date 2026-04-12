---
name: Metadata route follow-ups
description: Deferred cleanups on /api/metadata/:recommendationId identified during PR #44 review
type: project
---

Follow-ups for `src/server/routes/metadata.ts` logged during PR #44 review. None are blocking correctness; defer to a cleanup pass.

**Why:** The metadata enrichment PR shipped with ownership scoping, tmdbId backfill, and a MetadataPanel unit test. The items below are code-hygiene / UX refinements that didn't justify blocking the merge.

**How to apply:** Pick up one at a time when touching `routes/metadata.ts` or when doing a broader cleanup sweep. Each is self-contained.

1. **Differentiate upstream failures from "not found".** The catch-all at the end of the fetch path logs and returns `{ available: false }` for any thrown error — TMDB rate limits, TVDB auth failures, and zod parse errors on malformed upstream responses all look identical to "genuinely no match". Consider a 502 for transient failures so the client can retry, or at least include `err.message` in the structured log and return a reason field.

2. **`metadata_cache.mediaType` column is written but never read.** `serializeMetadata` sets it, but `deserializeMetadata` doesn't project it, and the route derives `isMovie` from the recommendation row instead of the cache row. Either drop the column in a follow-up migration or read it back for symmetry. Low priority.

3. **`FIRST = 0` magic-constant workaround.** `routes/metadata.ts:29` exists only because the lint rule flags `results[0]`. If we ever relax `no-magic-numbers` for array indexing this can be inlined.

4. **Cache parse trust boundary.** The JSON.parse + zod.parse on every cache read is correct but adds validation cost to the hot path. Since the cache is written by our own code, a fast path that skips validation for trusted writes would be cheap — only needed if profiling shows it matters.

5. **`resolveMetadata` inline rec type.** Uses a hand-rolled structural type. Could use `Pick<typeof recommendations.$inferSelect, "mediaType" | "tmdbId" | "tvdbId" | "title" | "year">` to stay in sync with schema drift.
