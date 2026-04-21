# Redesign B1 — Foundations

**Date:** 2026-04-21
**Branch target:** `redesign`
**Scope:** Phase 1 of a multi-phase redesign. Frontend-only, no backend or schema changes.

## Context

The design bundle at `claude.ai/design` (fetched from the Anthropic handoff URL) ships a full redesign of Recommendarr as a React/CSS prototype. The design targets the same Night Owl palette already in `src/client/theme.ts` and keeps the app's three pages (Recommendations, History, Settings).

The full redesign is too large for a single plan. It is being decomposed into five phases, each delivered as its own spec → plan → PR → merge:

1. **B1 — Foundations** _(this spec)_: sidebar rework, recommendations page header, chat message bubble rework, loading indicator.
2. **B2 — Input rework**: collapsible `ChatControls` as a popover, collapsible genre/suggestion strip, redesigned input bar with filter/genre pills and icon-only send.
3. **B3 — Card rework**: horizontal recommendation card with poster placeholder, genre chips, More/Less synopsis, decluttered action row.
4. **B4 — History rework**: 760px container, filter pills, preview + top-recs + per-row stats (requires backend list-endpoint expansion).
5. **B5 — Token persistence**: schema migration for per-message token usage; surfaces tokens in the chat message badge and history/header subtitles.

The Tweaks panel from the prototype (sidebar-wide / stacked cards / accent color switch) is design exploration and is explicitly not shipped. The opinionated defaults are: icon-rail sidebar, horizontal cards, teal accent.

## Goals (for B1)

- Replace the 240px labeled sidebar with the design's 60px icon rail.
- Give the Recommendations page a conversation-aware header (title + stats subtitle) and a pill-styled "New" button.
- Reshape chat messages into the design's two-mode pattern: right-aligned user bubble, left-aligned assistant message with logo avatar + label + indented content.
- Replace the "Thinking..." loading bubble with three pulsing dots.
- Adopt `rem` as the unit for all CSS dimensions across B1 files (see the Unit Conventions subsection). Convert `theme.ts` tokens at the same time so the convention is enforced by reaching for tokens first.
- Maintain unit-test coverage on every changed component and keep existing e2e tests green (updating selectors where the accessible names have changed).

## Non-goals (deferred to later phases)

- No changes to `ChatControls`, `ChatInput`, `RecommendationCard` internals. These continue to render inside the new message bubble unchanged.
- No token UI (badge on assistant messages, tokens in page subtitle). Skipped because tokens aren't persisted yet; included in B5.
- No History page changes.
- No schema changes. No new API routes.
- No Tweaks panel. No accent-color switcher, card-layout toggle, or wide-sidebar toggle.

## Implementation structure

**In-place refactor with targeted extraction.** The sidebar grows substantially (icons, tooltip CSS, active accent bar, fixed-width constraints), so it moves out of `src/client/components/AppLayout.tsx` into its own file. Everything else is in-place edits.

### Unit conventions (applies to all B1 files and onward)

All CSS dimensions — `width`, `height`, `padding`, `margin`, `gap`, `font-size`, `border-radius`, `top`/`left`/`right`/`bottom`, `max-width`, etc. — are expressed in `rem` (root font size assumed 16px).

Exceptions kept as `px`:

- Border widths (`border: 1px solid ...`) — `1px` is visually load-bearing and doesn't scale usefully.
- SVG intrinsic `width` / `height` attributes (graphical units, not layout).
- CSS animation numeric properties that aren't dimensions (`opacity`, `transform: scale(n)`, transition seconds).

Prefer the `spacing` / `radii` / `fontSizes` tokens from `theme.ts`. Only fall back to inline `rem` literals for values the tokens don't cover (e.g. the 22px logo tile → `1.375rem`). Pixel values in this spec's body are the design's source-of-truth numbers — divide by 16 when translating to CSS (conversion table below).

**Pixel → rem quick reference** for values used in B1:

| px  | rem       | where used                                      |
| --- | --------- | ----------------------------------------------- |
| 2   | 0.125rem  | tiny padding                                    |
| 4   | 0.25rem   | `radii.sm`, small gap, asymmetric bubble corner |
| 6   | 0.375rem  | logo-mini radius, star gap                      |
| 8   | 0.5rem    | `spacing.sm`, `radii.md`, gap                   |
| 10  | 0.625rem  | bubble padding Y, tooltip padding X             |
| 12  | 0.75rem   | subtitle font, pill font                        |
| 13  | 0.8125rem | pill icon                                       |
| 14  | 0.875rem  | bubble padding X, body font, bubble corner      |
| 15  | 0.9375rem | page-header h1                                  |
| 16  | 1rem      | `spacing.md`                                    |
| 17  | 1.0625rem | default icon                                    |
| 20  | 1.25rem   | active-bar height, logo-block vertical padding  |
| 22  | 1.375rem  | assistant-msg logo tile                         |
| 24  | 1.5rem    | `spacing.lg`                                    |
| 28  | 1.75rem   | sidebar logo tile                               |
| 30  | 1.875rem  | assistant-msg content indent                    |
| 60  | 3.75rem   | sidebar width, nav-item height                  |

### Files changed

- `src/client/theme.ts` — add one color token; convert `spacing` and `radii` values to rem; add a `fontSizes` token group (see Section 8).
- `src/client/global-styles.ts` — add `[data-tooltip]:hover::after` rule (uses rem).
- `src/client/components/AppLayout.tsx` — shrink to a thin shell that composes `<Sidebar />` and `<main>{children}</main>`.
- `src/client/components/Sidebar.tsx` — **new**. Holds the 60px icon-rail.
- `src/client/components/Icon.tsx` — **new**. Name-switched inline SVG component.
- `src/client/components/Logo.tsx` — **new**. Shared logo tile at configurable size (28px in sidebar, 22px in assistant messages).
- `src/client/components/LoadingBubble.tsx` — **new**. Three-dot pulsing indicator, colocated with its keyframes.
- `src/client/components/ChatMessage.tsx` — rewritten.
- `src/client/pages/Recommendations.tsx` — header rewrite; swap inline `LoadingBubble` for the new file; indent assistant recommendation cards by 30px.
- `src/client/hooks/use-chat.ts` — expose `conversationTitle` (one-line add; `conversationData.title` is already fetched internally).

Files deleted: none. Files renamed: none.

## Section 1 — Sidebar

**Shape:** fixed 60px wide, full viewport height, column flex. `background: colors.surface`, `border-right: 1px solid colors.border`, `flex-shrink: 0`.

**Top logo block:** padding `20px 0 16px`, centered. A 28×28 rounded tile (`border-radius: 8px`, `background: colors.accent`) containing a 14×14 star SVG filled with `colors.bg`. Bottom border `1px solid colors.border` separates logo from nav.

**Nav list:** three items, full-flex filling the middle region.

```tsx
const NAV_ITEMS = [
	{ href: "/", label: "Recommendations", icon: "spark" },
	{ href: "/history", label: "History", icon: "clock" },
	{ href: "/settings", label: "Settings", icon: "settings" },
] as const;
```

Each item renders as a wouter `<Link>` with:

- Full-width block, 60px tall, icon centered (no text)
- `aria-label={label}` for screen readers and e2e selectors (`getByRole("link", { name: ... })` continues to work)
- `aria-current="page"` when the route matches current `useLocation()`
- `data-tooltip={label}` — CSS tooltip is visual only; keep the attribute even on the active item for consistency
- **Inactive:** `color: colors.textMuted`, no background
- **Hover (inactive):** `background: colors.surfaceHover`, `color: colors.text`
- **Active:** `background: colors.accentDim`, `color: colors.accent`, plus an absolutely-positioned 3×20 accent bar at the left edge (`position: absolute; left: 0; top: 50%; transform: translateY(-50%); background: colors.accent; border-radius: 0 3px 3px 0`)
- Transition `background 0.15s, color 0.15s`

**Tooltip CSS** (added to `global-styles.ts`, not `Sidebar.tsx`, since the pattern is reusable):

```css
[data-tooltip] {
	position: relative;
}
[data-tooltip]:hover::after {
	content: attr(data-tooltip);
	position: absolute;
	left: calc(100% + 0.625rem);
	top: 50%;
	transform: translateY(-50%);
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	color: ${colors.text};
	font-size: 0.75rem;
	white-space: nowrap;
	padding: 0.25rem 0.625rem;
	border-radius: 0.375rem;
	pointer-events: none;
	z-index: 100;
}
```

**Logout button** (bottom): same 60px-tall shape as nav items but not a link. Top border `1px solid colors.border`. Icon `logout` sized 16. Default color `colors.textDim`; hover color `colors.red`. `aria-label="Log out"` and `data-tooltip="Log out"`. On click, runs the existing `useLogoutMutation` + `api.util.resetApiState()` logic lifted from the current `AppLayout`.

**Accessibility:** buttons and links have `aria-label`; the decorative tooltip is purely visual. Keyboard focus shows a standard outline (no custom focus style in B1).

## Section 2 — Icon component

**New file `src/client/components/Icon.tsx`.** A single name-switched component rendering inline SVG. B1 ships five names; further icons land in later phases.

Common props: `size` (default 17), `color` (default `"currentColor"`). All paths use `stroke="currentColor"`, `fill="none"`, `strokeWidth="1.3"`, `strokeLinecap="round"`, `strokeLinejoin="round"` where applicable. SVG path data is lifted verbatim from the prototype.

Names to implement in B1: `spark`, `clock`, `settings`, `logout`, `plus`.

Unknown names: render `null` (not an error). Easier to extend without touching types when adding later phases' icons.

## Section 3 — Logo component

**New file `src/client/components/Logo.tsx`.** Renders the rounded star tile used in two places:

- Sidebar: `size={28}`, inner star SVG `14×14`, tile `border-radius: 8px`.
- Assistant message header: `size={22}`, inner star SVG `10×10`, tile `border-radius: 6px`.

Both sizes are hardcoded cases inside the component (no derivation math — only two call sites exist). Background is `colors.accent`; star fill is `colors.bg`. The star path data is lifted verbatim from the prototype.

## Section 4 — AppLayout

Reduced to:

```tsx
export const AppLayout = ({ children }) => (
	<div className={layoutWrapper}>
		<Sidebar />
		<main className={mainContent}>{children}</main>
	</div>
);
```

`layoutWrapper`: `display: flex; min-height: 100vh`. `mainContent`: `flex: 1; overflow-y: auto`. All sidebar-specific styles move to `Sidebar.tsx`.

## Section 5 — Recommendations page header

**Layout:** flex row, `justify-content: space-between`, `align-items: center`, `padding: 12px 20px`, `border-bottom: 1px solid colors.border`, `background: colors.bg`, `flex-shrink: 0`.

**Left column:**

- `<h1>` — `font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: colors.text`.
  - Content: `conversationTitle ?? "New conversation"`.
- `<p>` — `font-size: 12px; color: colors.textDim; margin-top: 1px`.
  - Content: when `messageCount === 0`, `"No messages yet"`. Otherwise `"${recCount} recommendations · ${messageCount} messages"`. Pluralization: the design uses the plural form even at `1`; we match (no `s` stripping).

**Right column:** "New" pill button.

- `padding: 6px 12px; border-radius: 8px; background: none; border: 1px solid colors.border; color: colors.textMuted; font-size: 12px; display: flex; gap: 6px; align-items: center`.
- Children: `<Icon name="plus" size={13} />` + text `New`.
- Hover: border and text both shift to `colors.accent`.
- Click handler is unchanged: `chat.handleNewConversation`.

**Data plumbing:**

- `useChat()` gains a `conversationTitle` field:
  - It already uses `useGetConversationQuery(urlConversationId ?? "", ...)` internally. Expose `conversationData?.title` as `conversationTitle` in the hook's return value.
- `messageCount = chat.messages.length`.
- `recCount = chat.messages.reduce((n, m) => n + m.recommendations.length, 0)`. Compute inside the `PageHeader` sub-component, not in the hook.

## Section 6 — Chat message bubble

**Signature unchanged:** `<ChatMessage content={string} role={"user" | "assistant"} />`. Recommendation cards continue to be rendered by `Recommendations.tsx`'s `MessageItem` wrapper, not by `ChatMessage`.

**User message (right-aligned bubble):**

- Outer: `display: flex; justify-content: flex-end; margin-bottom: 20px`.
- Bubble:
  - `max-width: 70%`
  - `background: colors.accentDim`
  - `border: 1px solid rgba(127,219,202,0.2)` _(inline literal; no new token since it appears only here)_
  - `border-radius: 14px 14px 4px 14px`
  - `padding: 10px 14px`
  - `font-size: 14px; color: colors.text; line-height: 1.55`
- No avatar, no label.

**Assistant message (left-aligned with header):**

- Outer: block element, `margin-bottom: 20px`.
- Header row: `display: flex; align-items: center; gap: 8px; margin-bottom: 8px`
  - `<Logo size={22} />`
  - `<span>Recommendarr</span>` — `font-size: 12px; color: colors.textDim; font-weight: 500`
  - (Token badge: omitted in B1.)
- Content paragraph: `font-size: 14px; color: colors.textMuted; line-height: 1.6; padding-left: 30px; margin-bottom: 12px`.

**Recommendation-card indent in `Recommendations.tsx`:** `MessageItem` wraps recommendation cards in a `<div style={{ paddingLeft: 30 }}>` when the role is assistant, matching the design's 30px alignment between logo-avatar column and content column. User-role messages never have recommendations, so the conditional is a non-issue.

## Section 7 — LoadingBubble

**New file `src/client/components/LoadingBubble.tsx`.** Encapsulates the indicator and its `@keyframes pulse`.

- Container: `padding-left: 30px; margin-bottom: 16px` — matches assistant-message indent.
- Bubble: `display: inline-flex; gap: 4px; padding: 8px 14px; background: colors.surface; border: 1px solid colors.border; border-radius: 10px`.
- Three dots, each `width: 6px; height: 6px; border-radius: 50%; background: colors.accent; opacity: 0.7`.
- `@keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`.
- Animation `pulse 1s ease-in-out infinite`; stagger via `animation-delay: 0s / 0.15s / 0.3s` across the three dots.

Usage in `Recommendations.tsx`: `{chat.isLoading ? <LoadingBubble /> : undefined}`, replacing the current inline `LoadingBubble` sub-component.

## Section 8 — Theme & global styles additions

**`src/client/theme.ts` changes:**

- `colors`: add one token → `accentDim: "rgba(127,219,202,0.15)"`.
- `spacing`: convert existing values to rem — `xs: "0.25rem"` (4px), `sm: "0.5rem"` (8px), `md: "1rem"` (16px), `lg: "1.5rem"` (24px), `xl: "2rem"` (32px), `xxl: "3rem"` (48px). Names and shape unchanged.
- `radii`: convert existing values to rem — `sm: "0.25rem"` (4px), `md: "0.5rem"` (8px), `lg: "0.75rem"` (12px). Names and shape unchanged.
- `fontSizes`: **new token group** used across B1's new/rewritten components:
  - `xs: "0.75rem"` (12px — subtitle, pill, label)
  - `sm: "0.8125rem"` (13px — icon-button text)
  - `base: "0.875rem"` (14px — body text in messages)
  - `md: "0.9375rem"` (15px — page h1, base body elsewhere)
  - `lg: "1.375rem"` (22px — reserved for future phases; not used in B1 but registered now so later phases don't churn the token)

Existing consumers of `spacing` and `radii` continue to work with zero code change — the values are the same visual size, just declared in rem. This is a one-time swap with no expected visual regression.

**`src/client/global-styles.ts`:** append the `[data-tooltip]:hover::after` rule from Section 1. All dimensions in that rule use rem (`left: calc(100% + 0.625rem)`, `font-size: 0.75rem`, `padding: 0.25rem 0.625rem`, `border-radius: 0.375rem`).

## Testing

### Unit (Vitest via `yarn vp test`)

Colocated `__tests__/` folders. Using existing MSW-based mocks for API queries where relevant.

- **`src/client/components/__tests__/Sidebar.test.tsx`** _(new)_
  - Renders three nav links with accessible names `Recommendations`, `History`, `Settings`.
  - Active route (stubbed via wouter `Router` wrapper with a given path) has `aria-current="page"`.
  - Renders a Logout button with accessible name `Log out`. Clicking it calls the logout mutation and dispatches `api.util.resetApiState()`.
  - `data-tooltip` attribute equals the label on each nav item.
- **`src/client/components/__tests__/Icon.test.tsx`** _(new)_
  - Known names (`spark`, `clock`, `settings`, `logout`, `plus`) render an `<svg>` element.
  - Unknown name renders `null`.
- **`src/client/components/__tests__/Logo.test.tsx`** _(new)_
  - Renders an `<svg>` at the requested size.
- **`src/client/components/__tests__/ChatMessage.test.tsx`** _(new — no current coverage)_
  - User role renders a bubble in a right-aligned wrapper; text is visible.
  - Assistant role renders "Recommendarr" label, a logo SVG, and the content paragraph.
- **`src/client/components/__tests__/LoadingBubble.test.tsx`** _(new)_
  - Renders three elements acting as dots (assert by count of an `aria-hidden` decorative span, or by data attribute).
- **`src/client/pages/__tests__/Recommendations.test.tsx`** _(update existing)_
  - Default state: header shows `New conversation` + `No messages yet`.
  - After messages arrive (seeded via the hook or via MSW response): subtitle shows `N recommendations · N messages` with correct numbers.
  - When `useGetConversationQuery` returns a conversation with a title, the header shows that title.
  - "New" button is clickable and triggers `handleNewConversation`.
- **`src/client/components/__tests__/AppLayout.test.tsx`** _(update if present; otherwise leave; coverage moves to Sidebar.test.tsx)_

### E2E (Playwright)

- **`e2e/navigation.test.ts`** _(update existing)_
  - The landing-page test currently asserts `heading({ name: "Recommendations" })`. This heading no longer exists — update to assert the new `h1` reads either the conversation title or the `New conversation` fallback. Prefer asserting a stable sidebar element (`getByRole("link", { name: "Recommendations", current: "page" })`) to verify landing.
  - Sidebar link tests continue to use `getByRole("link", { name: ... })`; since nav items keep `aria-label`, this selector still matches.
  - Settings/History page heading assertions are unaffected.
- Do not add new navigation e2e tests — existing ones cover the surface after the selector update above.
- Feedback/other e2e tests: audit for any selectors that depend on the 240px sidebar width, visible "Recommendarr" logo text, or "Thinking..." bubble copy. Update any broken selectors; don't add new tests unless an uncovered gap emerges.

### Verification checklist before calling B1 done

- `yarn vp check` passes (format + lint + typecheck).
- `yarn vp test` passes.
- `yarn test:e2e` (runs `./scripts/e2e.sh`) passes.
- Manual smoke: `yarn dev`, log in, verify icon-rail sidebar, active accent bar, tooltips on hover, navigate between pages, send a chat message, observe user bubble + assistant avatar + three-dot loading indicator, click "New".
- Manual smoke for the token rem swap: visit Login, Register, Recommendations, History, Settings; confirm nothing looks visibly off (spacing, corners, type) vs. main. A side-by-side with the pre-B1 branch is sufficient.

## Risks & mitigations

- **Selector drift in e2e.** The landing-page `heading({ name: "Recommendations" })` will break. Mitigation: update that single assertion as part of this PR; don't introduce a "Recommendations" heading just to preserve it. _(Why: the page title is inherently conversation-aware now; faking a heading defeats the design.)_
- **Color-token addition rippling.** Adding `colors.accentDim` is additive; nothing referencing the existing `colors` object breaks.
- **Global tooltip CSS hitting other elements.** The `[data-tooltip]` selector is narrow — only elements we opt in carry the attribute. Low risk.
- **`use-chat` exposing a new field.** Callers that destructure other fields are unaffected. Only the Recommendations page reads `conversationTitle`.
- **Shared `Logo` component hardcodes two sizes.** If a third size is needed later, the component will need to be extended; for B1, only 22 and 28 are used.
- **rem conversion of `spacing` / `radii` tokens is codebase-wide.** Every existing consumer of `spacing.md` / `radii.sm` / etc. gets the rem value automatically. The conversions are visually equivalent at the default 16px root (4px = 0.25rem, 8px = 0.5rem, etc.), so no regression is expected — but since the substitution touches many files indirectly, it's worth a manual smoke of every page (Login, Register, Recommendations, History, Settings) before marking B1 done.
- **Files outside B1's explicit edit list remain using `spacing`/`radii` tokens.** They inherit the rem swap automatically without source changes. Any leftover inline px values in non-B1 files are acceptable for this phase and will migrate opportunistically as later phases rewrite those files.

## Open questions

None at the spec stage. Flag during implementation if:

- An e2e test fails on a selector not foreseen here — update the spec/plan.
- The `useChat` return-type change cascades to test fixtures that stub the hook — adjust fixtures, not the hook signature.
