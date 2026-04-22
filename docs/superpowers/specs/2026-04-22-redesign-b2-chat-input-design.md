---
status: approved
phase: B2 (Chat input rework)
supersedes: BACKLOG.md § B2
---

# B2 — Chat input rework

Rebuild the chat input to match the prototype's consolidated pattern: a single input card that owns filter controls (popover), genre selection (collapsible strip), a selected-genre chip row, and the text input + send button. Replaces `ChatInput.tsx` and deletes `ChatControls.tsx`. `useChat` and `/api/chat` stay untouched.

## Decisions (resolved during brainstorming)

1. **Library scope.** Keep the existing Plex library picker (by library key, populated from `/api/plex/libraries`). Drop the backlog's proposed `Whole library | Movies | TV Shows` 3-option scope — the media-type segmented buttons already cover that axis.
2. **Message composition.** Natural language. `Include: A, B. Exclude: C. user text`. Clauses drop out cleanly when empty.
3. **Genre list.** Expand to a static 15–20 standard genres matching the TMDB / TVDB vocabulary metadata is tagged with.
4. **Commit model.** Genre strip selections are **staged** while open. Two commit buttons: `Apply` (commit, close) and `Apply + send` (commit, close, send). `Clear` resets staged selections. Click-outside / Escape / re-click Genres pill = cancel staged. Popover controls edit committed state directly (no staging).
5. **Empty-text send.** When genres are committed but text is empty, compose with a fallback: `Include: thriller. Give me recommendations.`

## Architecture

### Component structure

```
ChatInput.tsx                     (rewrite — outer card, owns state)
  ├── FiltersPill.tsx             (new — "Films · 5" button)
  ├── FiltersPopover.tsx          (new — media type, result count, exclude-watched, library select)
  ├── GenresPill.tsx              (new — "# Genres (3·−1)" button)
  ├── GenreStrip.tsx              (new — 3-state chip grid, quick-prompts, Clear/Apply/Apply+send)
  ├── SelectedGenresRow.tsx       (new — committed chips + × remove, visible when strip collapsed)
  └── LibraryScopeSelect.tsx      (extracted from ChatControls — reused by popover)

ChatControls.tsx                  (DELETE)
__tests__/ChatControls.test.tsx   (DELETE)

utils/compose-message.ts          (new — pure helper, unit-tested)
```

`Recommendations.tsx` loses the `<ChatControls ... />` render. Its filter props continue flowing into `<ChatInput />` instead.

### State & data flow

`useChat` keeps owning committed filter state: `mediaType`, `libraryId`, `resultCount`, `excludeLibrary`. These are passed into `ChatInput` and flow to `/api/chat` exactly as today.

`ChatInput` owns new local state:

```ts
textInput: string;
includedGenres: Set<string>; // committed — rendered in SelectedGenresRow, included in send
excludedGenres: Set<string>; // committed — same
stagedIncluded: Set<string>; // only while strip is open; seeded from committed on open
stagedExcluded: Set<string>; // same
openSurface: "none" | "popover" | "strip";
```

**Popover controls edit committed state live** (media type, library, result count, exclude-watched flip immediately). Only the genre strip stages.

**Send flow:**

1. `ChatInput` calls `composeMessage({ includedGenres, excludedGenres, text })` → composed string.
2. Invokes the existing `onSend(composed)` prop (signature unchanged).
3. Clears `textInput`, `includedGenres`, `excludedGenres`.

**Dismissal:**

- Popover: click outside / Escape / close button → `openSurface = "none"`. No cancel semantics (state is already live).
- Strip: click outside / Escape / re-click Genres pill → discard staged. Apply / Apply+send → copy staged to committed, then close (and send, for the second).

Mutual exclusion enforced by the single `openSurface` field.

## Behavior

### Send-enabled rule

`text.trim().length > 0 || includedGenres.size + excludedGenres.size > 0` (committed, not staged).

### Compose rules

| Includes             | Excludes   | Text                     | Result                                                               |
| -------------------- | ---------- | ------------------------ | -------------------------------------------------------------------- |
| `[thriller, horror]` | `[comedy]` | `something from the 90s` | `Include: thriller, horror. Exclude: comedy. something from the 90s` |
| `[thriller]`         | `[]`       | `something from the 90s` | `Include: thriller. something from the 90s`                          |
| `[]`                 | `[comedy]` | `something from the 90s` | `Exclude: comedy. something from the 90s`                            |
| `[thriller]`         | `[comedy]` | ``                       | `Include: thriller. Exclude: comedy. Give me recommendations.`       |
| `[]`                 | `[]`       | `hello`                  | `hello`                                                              |
| `[]`                 | `[]`       | ``                       | _(send disabled; no composition needed)_                             |

### Genre chip 3-state cycle

`unselected → include (teal border/bg) → exclude (red border, strikethrough text) → unselected`. Same chip, one click advances. `aria-label` carries the state:

- `"thriller, not selected"`
- `"thriller, currently included"`
- `"thriller, currently excluded"`

### Quick-prompt chips

`more from this director`, `similar actors`, `based on a novel`. Click **appends** to `textInput` (with a leading space if existing text is non-empty). Does not send. Does not close the strip.

### Pill labels

- **Filters pill:** `{MediaShorthand} · {resultCount}` — `Films` / `Shows` / `Either` based on committed `mediaType`. Example: `Films · 5`.
- **Genres pill:** `# Genres` when nothing committed. `# Genres ({n}·−{m})` when any — e.g. `# Genres (3·−1)`. Reflects committed state, not staged (prevents flicker).

### Selected-genres chip row

Visible only when strip is collapsed AND committed selections exist. Included chips: teal. Excluded chips: red, strikethrough. `×` on each immediately removes from committed state (no staging — strip isn't open).

### Keyboard

- `Enter` in text input → submit.
- `Shift+Enter` → newline. **Requires switching the text field from `<input>` to `<textarea>`** with autosize.
- `Escape` in popover / strip → close.
- Arrow keys within the media-type segmented group: preserved from existing `ChatControls` radiogroup behavior.

### Genre list

18 genres, matching TMDB's standard movie genre vocabulary (our metadata already uses these tags):

```
action, adventure, animation, comedy, crime, documentary, drama, family,
fantasy, history, horror, music, mystery, romance, sci-fi, thriller, war, western
```

Defined as a single `const GENRES` array at the top of `GenreStrip.tsx`. Rendered in grid order (not alphabetical) only if design calls for it — default is alphabetical as listed.

## Testing

### Unit tests (colocated `__tests__/`)

- **`compose-message.test.ts`** — all 5 composition rows (table above), plus "only text", "neither set" (returns empty, caller won't invoke).
- **`ChatInput.test.tsx`** (rewrite) — send clears text + committed genres; send-enabled rule; Enter submits; Shift+Enter inserts newline; mutual exclusion of popover/strip.
- **`FiltersPopover.test.tsx`** — media type updates call handler live; result count stepper clamped 1..20; click outside / Escape close; library select reflects `useGetPlexLibrariesQuery`.
- **`GenreStrip.test.tsx`** — 3-state chip cycle; staged vs committed separation (open, toggle, click outside → committed unchanged); Apply commits + closes; Apply+send commits + invokes `onSend`; Clear resets staged only; quick-prompt chips append to text.
- **`SelectedGenresRow.test.tsx`** — renders included/excluded chips with correct styling; `×` removes from committed state.
- **`ChatControls.test.tsx`** — **deleted** with the component.

### E2E

One flow added to the existing suite:

```
test("filter + send flow"):
  1. Open filters popover, change media type to "TV Shows".
  2. Close popover (click outside).
  3. Open genre strip, include "thriller", exclude "comedy", type "something quiet", click Apply+send.
  4. Assert outbound /api/chat request body:
       { mediaType: "tv",
         message: "Include: thriller. Exclude: comedy. something quiet",
         ... }
  5. Assert text input + committed genres are cleared after send.
```

Existing e2e selectors that touch the old `ChatControls` bar (`data-testid` lookups for media-type buttons, result count, exclude-library) must be updated to open the popover first.

## Out of scope for B2

- **Per-conversation filter persistence** — moved to B7.
- **Edit-mode tweaks panel** (card layout, sidebar style, accent color) — not planned in any phase.
- **Server-side structured filters** — if we ever want the backend to see filters as structured fields instead of composed text, that's a separate spec. Today's server prompt builder treats the composed string as the user message and is untouched.
- **Persistence of selected genres across sends** — they clear on send.

## Cross-cutting notes

- Keep the rem-over-px rule from B1. Use existing `spacing`, `colors`, `radii`, `fontSizes` tokens. Extend tokens only if a new size is genuinely needed.
- Linaria atomic classes only — no inline styles.
- Match visual output of the prototype, not its internal structure.
- All new features include `request.log` / `app.log` entries where they touch the server — B2 is client-only, so no logging changes needed.
