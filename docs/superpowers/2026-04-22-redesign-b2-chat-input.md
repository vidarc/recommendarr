# B2 — Chat input rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `ChatInput` + `ChatControls` combo with a consolidated input card: Filters pill + popover (live commits), Genres pill + collapsible strip (staged 3-state selection with explicit Apply / Apply+send), selected-genre chip row, and a textarea with send button. `useChat` and `/api/chat` are unchanged — client-only rework.

**Architecture:** `ChatInput` becomes the only filter/input surface. It owns local state for text input, committed included/excluded genres, staged selections, and a single `openSurface` mutex (`"none" | "popover" | "strip"`). A pure `composeMessage` helper builds the natural-language prompt sent to `onSend`. `ChatControls` is deleted; its `MediaType` type and `LibraryScopeSelect` extract into reusable shapes.

**Tech Stack:** React + Linaria atomic CSS + theme tokens, Vitest (`vite-plus/test`) + `@testing-library/react` + `userEvent` for unit tests, Playwright for e2e (`e2e/` dir).

**Spec reference:** `docs/superpowers/specs/2026-04-22-redesign-b2-chat-input-design.md`.

---

## File map

**Create:**

- `src/client/components/LibraryScopeSelect.tsx` — extracted Plex library `<select>`
- `src/client/components/FiltersPill.tsx`
- `src/client/components/FiltersPopover.tsx` — includes `MediaType` type export
- `src/client/components/GenresPill.tsx`
- `src/client/components/GenreStrip.tsx`
- `src/client/components/SelectedGenresRow.tsx`
- `src/client/utils/compose-message.ts`
- `src/client/utils/__tests__/compose-message.test.ts`
- `src/client/components/__tests__/LibraryScopeSelect.test.tsx`
- `src/client/components/__tests__/FiltersPill.test.tsx`
- `src/client/components/__tests__/FiltersPopover.test.tsx`
- `src/client/components/__tests__/GenresPill.test.tsx`
- `src/client/components/__tests__/GenreStrip.test.tsx`
- `src/client/components/__tests__/SelectedGenresRow.test.tsx`
- `e2e/chat-filters.test.ts`

**Rewrite:**

- `src/client/components/ChatInput.tsx`
- `src/client/components/__tests__/ChatInput.test.tsx`

**Modify:**

- `src/client/hooks/use-chat.ts` — swap `MediaType` import source
- `src/client/pages/Recommendations.tsx` — remove `<ChatControls>`, keep props on `<ChatInput>`

**Delete:**

- `src/client/components/ChatControls.tsx`
- `src/client/components/__tests__/ChatControls.test.tsx`

---

## Task 1: Extract `LibraryScopeSelect` and move `MediaType` export

Prepares for deleting `ChatControls` by carving out the Plex library picker as its own component and moving the `MediaType` type to a new home.

**Files:**

- Create: `src/client/components/LibraryScopeSelect.tsx`
- Create: `src/client/components/__tests__/LibraryScopeSelect.test.tsx`
- Create: `src/client/components/FiltersPopover.tsx` (stub — just the `MediaType` export for now)
- Modify: `src/client/hooks/use-chat.ts:7` (import source)
- Modify: `src/client/components/ChatControls.tsx` (import instead of redefining)

- [ ] **Step 1: Write the failing test for `LibraryScopeSelect`**

Create `src/client/components/__tests__/LibraryScopeSelect.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { store } from "../../store.ts";
import { LibraryScopeSelect } from "../LibraryScopeSelect.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () =>
		HttpResponse.json({
			libraries: [
				{ key: "1", title: "Movies", type: "movie" },
				{ key: "2", title: "TV Shows", type: "show" },
			],
		}),
	),
);

beforeAll(() => server.listen());
afterEach(() => {
	server.resetHandlers();
	store.dispatch(api.util.resetApiState());
});
afterAll(() => server.close());

const renderSelect = (value = "") => {
	const onChange = vi.fn<(value: string) => void>();
	onTestFinished(cleanup);
	render(
		<Provider store={store}>
			<LibraryScopeSelect value={value} onChange={onChange} />
		</Provider>,
	);
	return { onChange };
};

describe(LibraryScopeSelect, () => {
	it("renders 'Whole library' as the default option", async () => {
		renderSelect();
		expect(await screen.findByRole("option", { name: "Whole library" })).toBeInTheDocument();
	});

	it("renders options from /api/plex/libraries", async () => {
		renderSelect();
		expect(await screen.findByRole("option", { name: "Movies" })).toBeInTheDocument();
		expect(await screen.findByRole("option", { name: "TV Shows" })).toBeInTheDocument();
	});

	it("calls onChange with the selected library key", async () => {
		const { onChange } = renderSelect();
		const user = userEvent.setup();
		await screen.findByRole("option", { name: "Movies" });
		await user.selectOptions(screen.getByRole("combobox"), "1");
		expect(onChange).toHaveBeenCalledWith("1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/LibraryScopeSelect.test.tsx`
Expected: FAIL — `LibraryScopeSelect` does not exist.

- [ ] **Step 3: Create `LibraryScopeSelect.tsx`**

Create `src/client/components/LibraryScopeSelect.tsx` — copy the existing `LibraryScopeSelect` body from `ChatControls.tsx:231-252`, promoted to a module:

```tsx
import { css } from "@linaria/atomic";
import { useCallback } from "react";

import { useGetPlexLibrariesQuery } from "../features/plex/api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { ChangeEvent } from "react";

const selectStyle = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 0.85rem;
	outline: none;

	&:focus {
		border-color: ${colors.borderFocus};
	}
`;

interface LibraryScopeSelectProps {
	value: string;
	onChange: (value: string) => void;
	id?: string;
}

const LibraryScopeSelect = ({ value, onChange, id }: LibraryScopeSelectProps) => {
	const { data } = useGetPlexLibrariesQuery();
	const libraries = data?.libraries ?? [];

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<select id={id} className={selectStyle} value={value} onChange={handleChange}>
			<option value="">Whole library</option>
			{libraries.map((lib) => (
				<option key={lib.key} value={lib.key}>
					{lib.title}
				</option>
			))}
		</select>
	);
};

export { LibraryScopeSelect };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/LibraryScopeSelect.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Create `FiltersPopover.tsx` stub and move `MediaType`**

Create `src/client/components/FiltersPopover.tsx` with **only** the type and constants for now (the full component comes in Task 4):

```tsx
const MEDIA_TYPES = [
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "TV Shows" },
	{ value: "any", label: "Either" },
] as const;

type MediaType = (typeof MEDIA_TYPES)[number]["value"];

export type { MediaType };
export { MEDIA_TYPES };
```

- [ ] **Step 6: Update `use-chat.ts` import**

In `src/client/hooks/use-chat.ts:7`, change:

```ts
import type { MediaType } from "../components/ChatControls.tsx";
```

to:

```ts
import type { MediaType } from "../components/FiltersPopover.tsx";
```

- [ ] **Step 7: Update `ChatControls.tsx` to re-export from new source (transitional)**

In `src/client/components/ChatControls.tsx`, remove the local `MEDIA_TYPES` constant and `MediaType` type (lines 116–122). Add at the top:

```ts
import { MEDIA_TYPES, type MediaType } from "./FiltersPopover.tsx";
```

Update the final `export type { MediaType };` at line 345 to re-export from the new source (or remove — `use-chat.ts` no longer needs it here). Keep the re-export temporarily so the existing `ChatControls.test.tsx` keeps passing until Task 9.

- [ ] **Step 8: Run full client tests to verify nothing regressed**

Run: `yarn vp test src/client/`
Expected: PASS (all existing tests including `ChatControls.test.tsx` and `ChatInput.test.tsx` still pass).

- [ ] **Step 9: Commit**

```bash
git add src/client/components/LibraryScopeSelect.tsx \
        src/client/components/__tests__/LibraryScopeSelect.test.tsx \
        src/client/components/FiltersPopover.tsx \
        src/client/components/ChatControls.tsx \
        src/client/hooks/use-chat.ts
git commit -m "refactor: extract LibraryScopeSelect and relocate MediaType type

Preparation for B2 chat input rework — extract the Plex library picker
as a standalone component, and move MediaType to FiltersPopover so it
outlives the pending ChatControls deletion."
```

---

## Task 2: `composeMessage` pure helper

Builds the natural-language prompt from committed genres + user text.

**Files:**

- Create: `src/client/utils/compose-message.ts`
- Create: `src/client/utils/__tests__/compose-message.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/client/utils/__tests__/compose-message.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import { composeMessage } from "../compose-message.ts";

describe(composeMessage, () => {
	it("composes included + excluded + text", () => {
		expect(
			composeMessage({
				included: ["thriller", "horror"],
				excluded: ["comedy"],
				text: "something from the 90s",
			}),
		).toBe("Include: thriller, horror. Exclude: comedy. something from the 90s");
	});

	it("drops the exclude clause when none are excluded", () => {
		expect(
			composeMessage({
				included: ["thriller"],
				excluded: [],
				text: "something from the 90s",
			}),
		).toBe("Include: thriller. something from the 90s");
	});

	it("drops the include clause when none are included", () => {
		expect(
			composeMessage({
				included: [],
				excluded: ["comedy"],
				text: "something from the 90s",
			}),
		).toBe("Exclude: comedy. something from the 90s");
	});

	it("uses 'Give me recommendations.' fallback when text is empty but genres set", () => {
		expect(
			composeMessage({
				included: ["thriller"],
				excluded: ["comedy"],
				text: "",
			}),
		).toBe("Include: thriller. Exclude: comedy. Give me recommendations.");
	});

	it("returns trimmed text when no genres", () => {
		expect(composeMessage({ included: [], excluded: [], text: "hello" })).toBe("hello");
	});

	it("treats whitespace-only text as empty", () => {
		expect(composeMessage({ included: ["horror"], excluded: [], text: "   " })).toBe(
			"Include: horror. Give me recommendations.",
		);
	});

	it("trims surrounding whitespace from user text", () => {
		expect(composeMessage({ included: [], excluded: [], text: "  hello world  " })).toBe(
			"hello world",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/utils/__tests__/compose-message.test.ts`
Expected: FAIL — `composeMessage` does not exist.

- [ ] **Step 3: Implement `composeMessage`**

Create `src/client/utils/compose-message.ts`:

```ts
interface ComposeMessageArgs {
	included: readonly string[];
	excluded: readonly string[];
	text: string;
}

const composeMessage = ({ included, excluded, text }: ComposeMessageArgs): string => {
	const parts: string[] = [];
	if (included.length > 0) {
		parts.push(`Include: ${included.join(", ")}.`);
	}
	if (excluded.length > 0) {
		parts.push(`Exclude: ${excluded.join(", ")}.`);
	}
	const trimmed = text.trim();
	if (trimmed.length > 0) {
		parts.push(trimmed);
	} else if (included.length > 0 || excluded.length > 0) {
		parts.push("Give me recommendations.");
	}
	return parts.join(" ");
};

export { composeMessage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/utils/__tests__/compose-message.test.ts`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/client/utils/compose-message.ts \
        src/client/utils/__tests__/compose-message.test.ts
git commit -m "feat: add composeMessage helper for B2 chat input

Pure helper that composes included/excluded genres + user text into the
natural-language prompt format. Falls back to 'Give me recommendations.'
when only genres are provided."
```

---

## Task 3: `FiltersPill` component

Presentational button that opens the filters popover.

**Files:**

- Create: `src/client/components/FiltersPill.tsx`
- Create: `src/client/components/__tests__/FiltersPill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/client/components/__tests__/FiltersPill.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { FiltersPill } from "../FiltersPill.tsx";

const renderPill = (props: Partial<Parameters<typeof FiltersPill>[0]> = {}) => {
	const onClick = vi.fn();
	onTestFinished(cleanup);
	render(
		<FiltersPill mediaType="movie" resultCount={5} expanded={false} onClick={onClick} {...props} />,
	);
	return { onClick };
};

describe(FiltersPill, () => {
	it("renders shorthand label for 'movie' media type", () => {
		renderPill({ mediaType: "movie", resultCount: 5 });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Films · 5");
	});

	it("renders shorthand label for 'tv'", () => {
		renderPill({ mediaType: "tv", resultCount: 8 });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Shows · 8");
	});

	it("renders shorthand label for 'any'", () => {
		renderPill({ mediaType: "any", resultCount: 10 });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Either · 10");
	});

	it("calls onClick when clicked", async () => {
		const { onClick } = renderPill();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /filters/i }));
		expect(onClick).toHaveBeenCalled();
	});

	it("reflects expanded state with aria-expanded", () => {
		renderPill({ expanded: true });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/FiltersPill.test.tsx`
Expected: FAIL — `FiltersPill` does not exist.

- [ ] **Step 3: Implement `FiltersPill`**

Create `src/client/components/FiltersPill.tsx`:

```tsx
import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

import type { MediaType } from "./FiltersPopover.tsx";

const pillButton = css`
	display: inline-flex;
	align-items: center;
	gap: ${spacing.xs};
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	font-size: 0.8rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.text};
	}
`;

const MEDIA_SHORTHAND: Record<MediaType, string> = {
	movie: "Films",
	tv: "Shows",
	any: "Either",
};

interface FiltersPillProps {
	mediaType: MediaType;
	resultCount: number;
	expanded: boolean;
	onClick: () => void;
}

const FiltersPill = ({ mediaType, resultCount, expanded, onClick }: FiltersPillProps) => (
	<button
		type="button"
		className={pillButton}
		aria-label="Filters"
		aria-expanded={expanded}
		onClick={onClick}
	>
		{MEDIA_SHORTHAND[mediaType]} · {resultCount}
	</button>
);

export { FiltersPill };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/FiltersPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/FiltersPill.tsx \
        src/client/components/__tests__/FiltersPill.test.tsx
git commit -m "feat: add FiltersPill for B2 chat input"
```

---

## Task 4: `FiltersPopover` component

Floating panel containing media-type segmented buttons, result-count stepper, exclude-watched switch, library select. Controls edit props live (no staging).

**Files:**

- Rewrite: `src/client/components/FiltersPopover.tsx` (expand beyond Task 1's stub)
- Create: `src/client/components/__tests__/FiltersPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/client/components/__tests__/FiltersPopover.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { store } from "../../store.ts";
import { FiltersPopover } from "../FiltersPopover.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () => HttpResponse.json({ libraries: [] })),
);

beforeAll(() => server.listen());
afterEach(() => {
	server.resetHandlers();
	store.dispatch(api.util.resetApiState());
});
afterAll(() => server.close());

const renderPopover = (overrides: Partial<Parameters<typeof FiltersPopover>[0]> = {}) => {
	const onMediaTypeChange = vi.fn();
	const onResultCountChange = vi.fn();
	const onExcludeLibraryChange = vi.fn();
	const onLibraryIdChange = vi.fn();
	const onClose = vi.fn();

	onTestFinished(cleanup);

	render(
		<Provider store={store}>
			<FiltersPopover
				mediaType="movie"
				resultCount={5}
				excludeLibrary={true}
				libraryId=""
				onMediaTypeChange={onMediaTypeChange}
				onResultCountChange={onResultCountChange}
				onExcludeLibraryChange={onExcludeLibraryChange}
				onLibraryIdChange={onLibraryIdChange}
				onClose={onClose}
				{...overrides}
			/>
		</Provider>,
	);

	return {
		onMediaTypeChange,
		onResultCountChange,
		onExcludeLibraryChange,
		onLibraryIdChange,
		onClose,
	};
};

describe(FiltersPopover, () => {
	it("renders media-type radiogroup with the current value marked", () => {
		renderPopover({ mediaType: "movie" });
		expect(screen.getByRole("radio", { name: "Movies" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "TV Shows" })).not.toBeChecked();
	});

	it("calls onMediaTypeChange when a different button is clicked", async () => {
		const { onMediaTypeChange } = renderPopover();
		const user = userEvent.setup();
		await user.click(screen.getByRole("radio", { name: "TV Shows" }));
		expect(onMediaTypeChange).toHaveBeenCalledWith("tv");
	});

	it("increments result count with + button, clamped at 20", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: 19 });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /increase result count/i }));
		expect(onResultCountChange).toHaveBeenCalledWith(20);
	});

	it("does not increment past 20", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: 20 });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /increase result count/i }));
		expect(onResultCountChange).not.toHaveBeenCalled();
	});

	it("decrements result count with - button, clamped at 1", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: 2 });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /decrease result count/i }));
		expect(onResultCountChange).toHaveBeenCalledWith(1);
	});

	it("does not decrement below 1", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: 1 });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /decrease result count/i }));
		expect(onResultCountChange).not.toHaveBeenCalled();
	});

	it("toggles exclude-watched switch", async () => {
		const { onExcludeLibraryChange } = renderPopover({ excludeLibrary: true });
		const user = userEvent.setup();
		await user.click(screen.getByRole("switch", { name: /exclude watched/i }));
		expect(onExcludeLibraryChange).toHaveBeenCalledWith(false);
	});

	it("calls onClose when Escape pressed", async () => {
		const { onClose } = renderPopover();
		const user = userEvent.setup();
		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onClose when close button clicked", async () => {
		const { onClose } = renderPopover();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /close filters/i }));
		expect(onClose).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/FiltersPopover.test.tsx`
Expected: FAIL — `FiltersPopover` renders nothing yet.

- [ ] **Step 3: Implement `FiltersPopover`**

Rewrite `src/client/components/FiltersPopover.tsx` — keep the existing `MediaType` export, add the full component. Media-type toggle preserves roving tabindex + arrow keys from today's `ChatControls.tsx:129-183`:

```tsx
import { css } from "@linaria/atomic";
import { useCallback, useEffect, useRef } from "react";

import { colors, radii, spacing } from "../theme.ts";
import { LibraryScopeSelect } from "./LibraryScopeSelect.tsx";

import type { KeyboardEvent } from "react";

const NOT_FOUND = -1;
const STEP = 1;
const ACTIVE_TAB_INDEX = 0;
const MIN_RESULTS = 1;
const MAX_RESULTS = 20;

const MEDIA_TYPES = [
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "TV Shows" },
	{ value: "any", label: "Either" },
] as const;

type MediaType = (typeof MEDIA_TYPES)[number]["value"];

const popoverBox = css`
	position: absolute;
	bottom: calc(100% + 0.5rem);
	left: 0;
	min-width: 22rem;
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	padding: ${spacing.md};
	display: flex;
	flex-direction: column;
	gap: ${spacing.md};
	box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.35);
	z-index: 10;
`;

const row = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
`;

const rowLabel = css`
	font-size: 0.75rem;
	color: ${colors.textMuted};
	text-transform: uppercase;
	letter-spacing: 0.05rem;
`;

const segmentedGroup = css`
	display: flex;
`;

const segmentedButton = css`
	padding: ${spacing.xs} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.85rem;
	transition:
		background 0.15s ease,
		color 0.15s ease;

	&:first-child {
		border-radius: ${radii.sm} 0 0 ${radii.sm};
	}
	&:last-child {
		border-radius: 0 ${radii.sm} ${radii.sm} 0;
	}
	&:not(:last-child) {
		border-right: 0;
	}
`;

const segmentedActive = css`
	background: ${colors.accent};
	color: ${colors.bg};
	border-color: ${colors.accent};
`;

const stepperRow = css`
	display: inline-flex;
	align-items: center;
	gap: ${spacing.xs};
`;

const stepperButton = css`
	width: 2rem;
	height: 2rem;
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	cursor: pointer;

	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
`;

const stepperValue = css`
	min-width: 2rem;
	text-align: center;
	font-variant-numeric: tabular-nums;
	color: ${colors.text};
`;

const switchRow = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${spacing.sm};
`;

const switchToggle = css`
	position: relative;
	width: 2.5rem;
	height: 1.25rem;
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: 0.625rem;
	cursor: pointer;

	&[aria-checked="true"] {
		background: ${colors.accent};
		border-color: ${colors.accent};
	}
`;

const switchKnob = css`
	position: absolute;
	top: 0.125rem;
	left: 0.125rem;
	width: 0.875rem;
	height: 0.875rem;
	background: ${colors.bg};
	border-radius: 50%;
	transition: transform 0.15s ease;

	[aria-checked="true"] > & {
		transform: translateX(1.25rem);
	}
`;

const closeRow = css`
	display: flex;
	justify-content: flex-end;
`;

const closeButton = css`
	background: none;
	border: none;
	color: ${colors.textMuted};
	cursor: pointer;
	padding: ${spacing.xs} ${spacing.sm};
	font-size: 0.8rem;

	&:hover {
		color: ${colors.text};
	}
`;

interface FiltersPopoverProps {
	mediaType: MediaType;
	resultCount: number;
	excludeLibrary: boolean;
	libraryId: string;
	onMediaTypeChange: (value: MediaType) => void;
	onResultCountChange: (value: number) => void;
	onExcludeLibraryChange: (value: boolean) => void;
	onLibraryIdChange: (value: string) => void;
	onClose: () => void;
}

const FiltersPopover = ({
	mediaType,
	resultCount,
	excludeLibrary,
	libraryId,
	onMediaTypeChange,
	onResultCountChange,
	onExcludeLibraryChange,
	onLibraryIdChange,
	onClose,
}: FiltersPopoverProps) => {
	const buttonRefs = useRef(new Map<MediaType, HTMLButtonElement>());
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleKey = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => {
			window.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	const handleArrow = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const currentIndex = MEDIA_TYPES.findIndex((item) => item.value === mediaType);
			if (currentIndex === NOT_FOUND) return;
			let nextIndex = currentIndex;
			if (event.key === "ArrowRight" || event.key === "ArrowDown") {
				nextIndex = (currentIndex + STEP) % MEDIA_TYPES.length;
			} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
				nextIndex = (currentIndex - STEP + MEDIA_TYPES.length) % MEDIA_TYPES.length;
			} else {
				return;
			}
			event.preventDefault();
			const nextValue = MEDIA_TYPES[nextIndex]?.value;
			if (nextValue !== undefined) {
				onMediaTypeChange(nextValue);
				buttonRefs.current.get(nextValue)?.focus();
			}
		},
		[mediaType, onMediaTypeChange],
	);

	const handleDec = useCallback(() => {
		if (resultCount > MIN_RESULTS) onResultCountChange(resultCount - STEP);
	}, [resultCount, onResultCountChange]);
	const handleInc = useCallback(() => {
		if (resultCount < MAX_RESULTS) onResultCountChange(resultCount + STEP);
	}, [resultCount, onResultCountChange]);
	const handleToggleExclude = useCallback(() => {
		onExcludeLibraryChange(!excludeLibrary);
	}, [excludeLibrary, onExcludeLibraryChange]);

	return (
		<div ref={boxRef} className={popoverBox} role="dialog" aria-label="Filters">
			<div className={row}>
				<span className={rowLabel} id="filters-media-type-label">
					Media Type
				</span>
				<div
					role="radiogroup"
					aria-labelledby="filters-media-type-label"
					className={segmentedGroup}
					onKeyDown={handleArrow}
				>
					{MEDIA_TYPES.map((item) => (
						<MediaTypeButton
							key={item.value}
							item={item}
							isActive={mediaType === item.value}
							onChange={onMediaTypeChange}
							buttonRefs={buttonRefs}
						/>
					))}
				</div>
			</div>

			<div className={row}>
				<span className={rowLabel}>Results</span>
				<div className={stepperRow}>
					<button
						type="button"
						className={stepperButton}
						aria-label="Decrease result count"
						onClick={handleDec}
						disabled={resultCount <= MIN_RESULTS}
					>
						−
					</button>
					<span className={stepperValue}>{resultCount}</span>
					<button
						type="button"
						className={stepperButton}
						aria-label="Increase result count"
						onClick={handleInc}
						disabled={resultCount >= MAX_RESULTS}
					>
						+
					</button>
				</div>
			</div>

			<div className={row}>
				<span className={rowLabel}>Library</span>
				<LibraryScopeSelect value={libraryId} onChange={onLibraryIdChange} />
			</div>

			<div className={switchRow}>
				<span className={rowLabel}>Exclude Watched</span>
				<button
					type="button"
					role="switch"
					aria-label="Exclude Watched"
					aria-checked={excludeLibrary}
					className={switchToggle}
					onClick={handleToggleExclude}
				>
					<span className={switchKnob} />
				</button>
			</div>

			<div className={closeRow}>
				<button type="button" className={closeButton} onClick={onClose} aria-label="Close filters">
					Close
				</button>
			</div>
		</div>
	);
};

interface MediaTypeButtonProps {
	item: (typeof MEDIA_TYPES)[number];
	isActive: boolean;
	onChange: (value: MediaType) => void;
	buttonRefs: React.MutableRefObject<Map<MediaType, HTMLButtonElement>>;
}

const MediaTypeButton = ({ item, isActive, onChange, buttonRefs }: MediaTypeButtonProps) => {
	const handleClick = useCallback(() => {
		onChange(item.value);
	}, [item.value, onChange]);

	const handleRef = useCallback(
		(node: HTMLButtonElement | null) => {
			if (node) {
				buttonRefs.current.set(item.value, node);
			} else {
				buttonRefs.current.delete(item.value);
			}
		},
		[item.value, buttonRefs],
	);

	return (
		<button
			ref={handleRef}
			type="button"
			role="radio"
			aria-checked={isActive}
			tabIndex={isActive ? ACTIVE_TAB_INDEX : NOT_FOUND}
			className={`${segmentedButton} ${isActive ? segmentedActive : ""}`}
			onClick={handleClick}
		>
			{item.label}
		</button>
	);
};

export { FiltersPopover, MEDIA_TYPES };
export type { MediaType };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/FiltersPopover.test.tsx`
Expected: PASS (all 9 cases).

- [ ] **Step 5: Commit**

```bash
git add src/client/components/FiltersPopover.tsx \
        src/client/components/__tests__/FiltersPopover.test.tsx
git commit -m "feat: add FiltersPopover for B2 chat input"
```

---

## Task 5: `GenresPill` component

Presentational button that toggles the genre strip.

**Files:**

- Create: `src/client/components/GenresPill.tsx`
- Create: `src/client/components/__tests__/GenresPill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/client/components/__tests__/GenresPill.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { GenresPill } from "../GenresPill.tsx";

const renderPill = (props: Partial<Parameters<typeof GenresPill>[0]> = {}) => {
	const onClick = vi.fn();
	onTestFinished(cleanup);
	render(
		<GenresPill
			includedCount={0}
			excludedCount={0}
			expanded={false}
			onClick={onClick}
			{...props}
		/>,
	);
	return { onClick };
};

describe(GenresPill, () => {
	it("shows '# Genres' when nothing is selected", () => {
		renderPill();
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("shows '# Genres (3·−1)' when selections exist", () => {
		renderPill({ includedCount: 3, excludedCount: 1 });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres (3·−1)");
	});

	it("shows only include count when no excludes", () => {
		renderPill({ includedCount: 2, excludedCount: 0 });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres (2·−0)");
	});

	it("calls onClick when clicked", async () => {
		const { onClick } = renderPill();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		expect(onClick).toHaveBeenCalled();
	});

	it("reflects expanded state with aria-expanded", () => {
		renderPill({ expanded: true });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/GenresPill.test.tsx`
Expected: FAIL — `GenresPill` does not exist.

- [ ] **Step 3: Implement `GenresPill`**

Create `src/client/components/GenresPill.tsx`:

```tsx
import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

const NONE = 0;

const pillButton = css`
	display: inline-flex;
	align-items: center;
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	font-size: 0.8rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.text};
	}
`;

interface GenresPillProps {
	includedCount: number;
	excludedCount: number;
	expanded: boolean;
	onClick: () => void;
}

const formatLabel = (included: number, excluded: number): string => {
	if (included === NONE && excluded === NONE) return "# Genres";
	return `# Genres (${String(included)}·−${String(excluded)})`;
};

const GenresPill = ({ includedCount, excludedCount, expanded, onClick }: GenresPillProps) => (
	<button
		type="button"
		className={pillButton}
		aria-label="Genres"
		aria-expanded={expanded}
		onClick={onClick}
	>
		{formatLabel(includedCount, excludedCount)}
	</button>
);

export { GenresPill };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/GenresPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/GenresPill.tsx \
        src/client/components/__tests__/GenresPill.test.tsx
git commit -m "feat: add GenresPill for B2 chat input"
```

---

## Task 6: `GenreStrip` component

Collapsible section with staged 3-state chip selection, quick-prompt chips, and Clear / Apply / Apply+send buttons.

**Files:**

- Create: `src/client/components/GenreStrip.tsx`
- Create: `src/client/components/__tests__/GenreStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/client/components/__tests__/GenreStrip.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { GenreStrip } from "../GenreStrip.tsx";

const renderStrip = (overrides: Partial<Parameters<typeof GenreStrip>[0]> = {}) => {
	const onApply = vi.fn<(included: string[], excluded: string[]) => void>();
	const onApplyAndSend = vi.fn<(included: string[], excluded: string[]) => void>();
	const onQuickPrompt = vi.fn<(prompt: string) => void>();
	onTestFinished(cleanup);
	render(
		<GenreStrip
			committedIncluded={[]}
			committedExcluded={[]}
			onApply={onApply}
			onApplyAndSend={onApplyAndSend}
			onQuickPrompt={onQuickPrompt}
			{...overrides}
		/>,
	);
	return { onApply, onApplyAndSend, onQuickPrompt };
};

describe(GenreStrip, () => {
	it("renders 18 genre chips", () => {
		renderStrip();
		// The genres list defined in GenreStrip.tsx: 18 entries
		expect(
			screen.getAllByRole("button", {
				name: /^(action|adventure|animation|comedy|crime|documentary|drama|family|fantasy|history|horror|music|mystery|romance|sci-fi|thriller|war|western),/,
			}),
		).toHaveLength(18);
	});

	it("cycles chip through unselected → included → excluded → unselected", async () => {
		renderStrip();
		const user = userEvent.setup();
		const chip = screen.getByRole("button", { name: /horror, not selected/i });

		await user.click(chip);
		expect(screen.getByRole("button", { name: /horror, currently included/i })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /horror, currently included/i }));
		expect(screen.getByRole("button", { name: /horror, currently excluded/i })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /horror, currently excluded/i }));
		expect(screen.getByRole("button", { name: /horror, not selected/i })).toBeInTheDocument();
	});

	it("seeds staged from committed on render", () => {
		renderStrip({ committedIncluded: ["horror"], committedExcluded: ["comedy"] });
		expect(screen.getByRole("button", { name: /horror, currently included/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /comedy, currently excluded/i })).toBeInTheDocument();
	});

	it("Apply calls onApply with staged selections", async () => {
		const { onApply } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /apply$/i }));
		expect(onApply).toHaveBeenCalledWith(["horror"], []);
	});

	it("Apply + send calls onApplyAndSend with staged selections", async () => {
		const { onApplyAndSend } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /apply \+ send/i }));
		expect(onApplyAndSend).toHaveBeenCalledWith(["thriller"], []);
	});

	it("Clear resets staged selections without calling onApply", async () => {
		const { onApply } = renderStrip({ committedIncluded: ["horror"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /clear/i }));
		expect(screen.getByRole("button", { name: /horror, not selected/i })).toBeInTheDocument();
		expect(onApply).not.toHaveBeenCalled();
	});

	it("quick-prompt chip fires onQuickPrompt with the prompt text", async () => {
		const { onQuickPrompt } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "more from this director" }));
		expect(onQuickPrompt).toHaveBeenCalledWith("more from this director");
	});

	it("shows include and exclude counts in the footer", async () => {
		renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /thriller, currently included/i }));
		expect(screen.getByText(/1 included/i)).toBeInTheDocument();
		expect(screen.getByText(/1 excluded/i)).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/GenreStrip.test.tsx`
Expected: FAIL — `GenreStrip` does not exist.

- [ ] **Step 3: Implement `GenreStrip`**

Create `src/client/components/GenreStrip.tsx`:

```tsx
import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { colors, radii, spacing } from "../theme.ts";

const GENRES = [
	"action",
	"adventure",
	"animation",
	"comedy",
	"crime",
	"documentary",
	"drama",
	"family",
	"fantasy",
	"history",
	"horror",
	"music",
	"mystery",
	"romance",
	"sci-fi",
	"thriller",
	"war",
	"western",
] as const;

type Genre = (typeof GENRES)[number];

const QUICK_PROMPTS = ["more from this director", "similar actors", "based on a novel"] as const;

type ChipState = "none" | "included" | "excluded";

const stripBox = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.md};
	padding: ${spacing.md};
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
`;

const chipGrid = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
`;

const chipBase = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	font-size: 0.8rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease,
		background 0.15s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const chipIncluded = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};
`;

const chipExcluded = css`
	background: transparent;
	border-color: ${colors.red};
	color: ${colors.red};
	text-decoration: line-through;
`;

const quickPromptRow = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
	padding-top: ${spacing.xs};
	border-top: 1px solid ${colors.border};
`;

const footer = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${spacing.sm};
`;

const counts = css`
	font-size: 0.75rem;
	color: ${colors.textMuted};
`;

const footerActions = css`
	display: flex;
	gap: ${spacing.sm};
`;

const btn = css`
	padding: ${spacing.xs} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 0.85rem;
	cursor: pointer;

	&:hover {
		background: ${colors.surfaceHover};
	}
`;

const btnPrimary = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};

	&:hover {
		background: ${colors.accentHover};
	}
`;

interface GenreStripProps {
	committedIncluded: readonly string[];
	committedExcluded: readonly string[];
	onApply: (included: string[], excluded: string[]) => void;
	onApplyAndSend: (included: string[], excluded: string[]) => void;
	onQuickPrompt: (prompt: string) => void;
}

const STATE_LABEL: Record<ChipState, string> = {
	none: "not selected",
	included: "currently included",
	excluded: "currently excluded",
};

const chipClassFor = (state: ChipState): string => {
	if (state === "included") return `${chipBase} ${chipIncluded}`;
	if (state === "excluded") return `${chipBase} ${chipExcluded}`;
	return chipBase;
};

const GenreStrip = ({
	committedIncluded,
	committedExcluded,
	onApply,
	onApplyAndSend,
	onQuickPrompt,
}: GenreStripProps) => {
	const [staged, setStaged] = useState<Map<Genre, ChipState>>(() => {
		const map = new Map<Genre, ChipState>();
		for (const g of committedIncluded) map.set(g as Genre, "included");
		for (const g of committedExcluded) map.set(g as Genre, "excluded");
		return map;
	});

	const cycle = useCallback((genre: Genre) => {
		setStaged((prev) => {
			const next = new Map(prev);
			const current = next.get(genre) ?? "none";
			if (current === "none") next.set(genre, "included");
			else if (current === "included") next.set(genre, "excluded");
			else next.delete(genre);
			return next;
		});
	}, []);

	const collect = useCallback((): { included: string[]; excluded: string[] } => {
		const included: string[] = [];
		const excluded: string[] = [];
		for (const [genre, state] of staged) {
			if (state === "included") included.push(genre);
			else if (state === "excluded") excluded.push(genre);
		}
		return { included, excluded };
	}, [staged]);

	const handleApply = useCallback(() => {
		const { included, excluded } = collect();
		onApply(included, excluded);
	}, [collect, onApply]);

	const handleApplyAndSend = useCallback(() => {
		const { included, excluded } = collect();
		onApplyAndSend(included, excluded);
	}, [collect, onApplyAndSend]);

	const handleClear = useCallback(() => {
		setStaged(new Map());
	}, []);

	const { included, excluded } = collect();

	return (
		<div className={stripBox} role="group" aria-label="Genre filter">
			<div className={chipGrid}>
				{GENRES.map((genre) => {
					const state = staged.get(genre) ?? "none";
					return <GenreChip key={genre} genre={genre} state={state} onCycle={cycle} />;
				})}
			</div>

			<div className={quickPromptRow}>
				{QUICK_PROMPTS.map((prompt) => (
					<QuickPromptChip key={prompt} prompt={prompt} onPick={onQuickPrompt} />
				))}
			</div>

			<div className={footer}>
				<span className={counts}>
					{included.length} included · {excluded.length} excluded
				</span>
				<div className={footerActions}>
					<button type="button" className={btn} onClick={handleClear}>
						Clear
					</button>
					<button type="button" className={btn} onClick={handleApply}>
						Apply
					</button>
					<button type="button" className={`${btn} ${btnPrimary}`} onClick={handleApplyAndSend}>
						Apply + send
					</button>
				</div>
			</div>
		</div>
	);
};

interface GenreChipProps {
	genre: Genre;
	state: ChipState;
	onCycle: (genre: Genre) => void;
}

const GenreChip = ({ genre, state, onCycle }: GenreChipProps) => {
	const handleClick = useCallback(() => {
		onCycle(genre);
	}, [genre, onCycle]);
	return (
		<button
			type="button"
			className={chipClassFor(state)}
			aria-label={`${genre}, ${STATE_LABEL[state]}`}
			onClick={handleClick}
		>
			{genre}
		</button>
	);
};

interface QuickPromptChipProps {
	prompt: string;
	onPick: (prompt: string) => void;
}

const QuickPromptChip = ({ prompt, onPick }: QuickPromptChipProps) => {
	const handleClick = useCallback(() => {
		onPick(prompt);
	}, [prompt, onPick]);
	return (
		<button type="button" className={chipBase} onClick={handleClick}>
			{prompt}
		</button>
	);
};

export { GenreStrip, GENRES, QUICK_PROMPTS };
```

Note: `colors.red` is defined in `src/client/theme.ts` (`"#ef5350"`). No theme additions needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/GenreStrip.test.tsx`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/client/components/GenreStrip.tsx \
        src/client/components/__tests__/GenreStrip.test.tsx
git commit -m "feat: add GenreStrip for B2 chat input

Staged 3-state chip selection (unselected/include/exclude), quick-prompt
chips, and Clear/Apply/Apply+send commit buttons."
```

---

## Task 7: `SelectedGenresRow` component

Row of committed include/exclude chips with per-chip × remove. Visible when strip is collapsed and any committed selections exist.

**Files:**

- Create: `src/client/components/SelectedGenresRow.tsx`
- Create: `src/client/components/__tests__/SelectedGenresRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/client/components/__tests__/SelectedGenresRow.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { SelectedGenresRow } from "../SelectedGenresRow.tsx";

const renderRow = (overrides: Partial<Parameters<typeof SelectedGenresRow>[0]> = {}) => {
	const onRemove = vi.fn<(genre: string) => void>();
	onTestFinished(cleanup);
	render(<SelectedGenresRow included={[]} excluded={[]} onRemove={onRemove} {...overrides} />);
	return { onRemove };
};

describe(SelectedGenresRow, () => {
	it("renders nothing when no selections", () => {
		const { container } = render(
			<SelectedGenresRow included={[]} excluded={[]} onRemove={vi.fn()} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders included chips with include styling", () => {
		renderRow({ included: ["horror", "thriller"] });
		expect(screen.getByText("horror")).toBeInTheDocument();
		expect(screen.getByText("thriller")).toBeInTheDocument();
	});

	it("renders excluded chips", () => {
		renderRow({ excluded: ["comedy"] });
		expect(screen.getByText("comedy")).toBeInTheDocument();
	});

	it("calls onRemove with the chip's genre when × is clicked", async () => {
		const { onRemove } = renderRow({ included: ["horror"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /remove horror/i }));
		expect(onRemove).toHaveBeenCalledWith("horror");
	});

	it("works for excluded chip removal", async () => {
		const { onRemove } = renderRow({ excluded: ["comedy"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /remove comedy/i }));
		expect(onRemove).toHaveBeenCalledWith("comedy");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/client/components/__tests__/SelectedGenresRow.test.tsx`
Expected: FAIL — `SelectedGenresRow` does not exist.

- [ ] **Step 3: Implement `SelectedGenresRow`**

Create `src/client/components/SelectedGenresRow.tsx`:

```tsx
import { css } from "@linaria/atomic";
import { useCallback } from "react";

import { colors, radii, spacing } from "../theme.ts";

const NONE = 0;

const row = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
`;

const chipBase = css`
	display: inline-flex;
	align-items: center;
	gap: ${spacing.xs};
	padding: ${spacing.xs} ${spacing.sm};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	font-size: 0.8rem;
`;

const chipIncluded = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};
`;

const chipExcluded = css`
	border-color: ${colors.red};
	color: ${colors.red};
	text-decoration: line-through;
`;

const removeButton = css`
	background: none;
	border: none;
	padding: 0;
	color: inherit;
	font-size: 0.9rem;
	line-height: 1;
	cursor: pointer;
`;

interface SelectedGenresRowProps {
	included: readonly string[];
	excluded: readonly string[];
	onRemove: (genre: string) => void;
}

const SelectedGenresRow = ({ included, excluded, onRemove }: SelectedGenresRowProps) => {
	if (included.length === NONE && excluded.length === NONE) {
		return null;
	}
	return (
		<div className={row}>
			{included.map((genre) => (
				<Chip key={`i-${genre}`} genre={genre} variant="included" onRemove={onRemove} />
			))}
			{excluded.map((genre) => (
				<Chip key={`e-${genre}`} genre={genre} variant="excluded" onRemove={onRemove} />
			))}
		</div>
	);
};

interface ChipProps {
	genre: string;
	variant: "included" | "excluded";
	onRemove: (genre: string) => void;
}

const Chip = ({ genre, variant, onRemove }: ChipProps) => {
	const handleClick = useCallback(() => {
		onRemove(genre);
	}, [genre, onRemove]);
	const className =
		variant === "included" ? `${chipBase} ${chipIncluded}` : `${chipBase} ${chipExcluded}`;
	return (
		<span className={className}>
			{genre}
			<button
				type="button"
				className={removeButton}
				aria-label={`Remove ${genre}`}
				onClick={handleClick}
			>
				×
			</button>
		</span>
	);
};

export { SelectedGenresRow };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vp test src/client/components/__tests__/SelectedGenresRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/SelectedGenresRow.tsx \
        src/client/components/__tests__/SelectedGenresRow.test.tsx
git commit -m "feat: add SelectedGenresRow for B2 chat input"
```

---

## Task 8: Rewrite `ChatInput` to compose everything

`ChatInput` becomes the outer card that owns all local state (text, committed genres, `openSurface`) and wires the sub-components together. Switches from `<input>` to `<textarea>`.

**Files:**

- Rewrite: `src/client/components/ChatInput.tsx`
- Rewrite: `src/client/components/__tests__/ChatInput.test.tsx`

- [ ] **Step 1: Write the failing test (rewrite existing)**

Replace `src/client/components/__tests__/ChatInput.test.tsx` entirely:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { store } from "../../store.ts";
import { ChatInput } from "../ChatInput.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () => HttpResponse.json({ libraries: [] })),
);

beforeAll(() => server.listen());
afterEach(() => {
	server.resetHandlers();
	store.dispatch(api.util.resetApiState());
});
afterAll(() => server.close());

const renderInput = (overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) => {
	const onSend = vi.fn<(message: string) => void>();
	const onMediaTypeChange = vi.fn();
	const onResultCountChange = vi.fn();
	const onExcludeLibraryChange = vi.fn();
	const onLibraryIdChange = vi.fn();

	onTestFinished(cleanup);

	render(
		<Provider store={store}>
			<ChatInput
				onSend={onSend}
				isLoading={false}
				mediaType="movie"
				resultCount={5}
				excludeLibrary={true}
				libraryId=""
				onMediaTypeChange={onMediaTypeChange}
				onResultCountChange={onResultCountChange}
				onExcludeLibraryChange={onExcludeLibraryChange}
				onLibraryIdChange={onLibraryIdChange}
				{...overrides}
			/>
		</Provider>,
	);
	return {
		onSend,
		onMediaTypeChange,
		onResultCountChange,
		onExcludeLibraryChange,
		onLibraryIdChange,
	};
};

describe(ChatInput, () => {
	it("renders the textarea with accessible name", () => {
		renderInput();
		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeInTheDocument();
	});

	it("send button is disabled when empty and no genres", () => {
		renderInput();
		expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
	});

	it("send button enables with text", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "hi");
		expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
	});

	it("send composes included/excluded/text into one message", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		// Open the genre strip
		await user.click(screen.getByRole("button", { name: /genres/i }));
		// Stage include: thriller, exclude: comedy
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /comedy, not selected/i }));
		await user.click(screen.getByRole("button", { name: /comedy, currently included/i }));
		// Apply
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		// Type and send
		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "quiet");
		await user.click(screen.getByRole("button", { name: /^send$/i }));
		expect(onSend).toHaveBeenCalledWith("Include: thriller. Exclude: comedy. quiet");
	});

	it("Apply + send commits and sends in one action", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"atmospheric",
		);
		await user.click(screen.getByRole("button", { name: /apply \+ send/i }));
		expect(onSend).toHaveBeenCalledWith("Include: horror. atmospheric");
	});

	it("clears text and committed genres after send", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "hello");
		await user.click(screen.getByRole("button", { name: /^send$/i }));
		expect(textarea).toHaveValue("");
		// GenresPill reflects cleared state
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("Enter submits, Shift+Enter inserts newline", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "line 1{shift>}{enter}{/shift}line 2");
		expect(onSend).not.toHaveBeenCalled();
		await user.type(textarea, "{enter}");
		expect(onSend).toHaveBeenCalledWith("line 1\nline 2");
	});

	it("opening popover closes strip and vice versa", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		expect(screen.getByRole("group", { name: /genre filter/i })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /filters/i }));
		expect(screen.queryByRole("group", { name: /genre filter/i })).not.toBeInTheDocument();
		expect(screen.getByRole("dialog", { name: /filters/i })).toBeInTheDocument();
	});

	it("closing strip without Apply discards staged selections", async () => {
		renderInput();
		const user = userEvent.setup();
		// Open strip, stage horror, click pill to close (cancel)
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /genres/i }));
		// Pill still shows no selections
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("quick-prompt chip appends to textarea", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "I want");
		await user.click(screen.getByRole("button", { name: "similar actors" }));
		expect(textarea).toHaveValue("I want similar actors");
	});

	it("selected-genres row shows committed chips and × removes them", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		// Strip is closed; SelectedGenresRow shows "horror" with × button
		expect(screen.getByRole("button", { name: /remove horror/i })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /remove horror/i }));
		expect(screen.queryByRole("button", { name: /remove horror/i })).not.toBeInTheDocument();
	});

	it("disables everything when isLoading", () => {
		renderInput({ isLoading: true });
		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vp test src/client/components/__tests__/ChatInput.test.tsx`
Expected: FAIL — the old `ChatInput` doesn't have the new shape.

- [ ] **Step 3: Rewrite `ChatInput`**

Replace `src/client/components/ChatInput.tsx` entirely:

```tsx
import { css } from "@linaria/atomic";
import { useCallback, useRef, useState } from "react";

import { composeMessage } from "../utils/compose-message.ts";
import { colors, radii, spacing } from "../theme.ts";
import { FiltersPill } from "./FiltersPill.tsx";
import { FiltersPopover } from "./FiltersPopover.tsx";
import { GenreStrip } from "./GenreStrip.tsx";
import { GenresPill } from "./GenresPill.tsx";
import { SelectedGenresRow } from "./SelectedGenresRow.tsx";

import type { MediaType } from "./FiltersPopover.tsx";
import type { ChangeEvent, KeyboardEvent } from "react";

const EMPTY = 0;

const card = css`
	position: relative;
	border-top: 1px solid ${colors.border};
	background: ${colors.surface};
	padding: ${spacing.md};
	display: flex;
	flex-direction: column;
	gap: ${spacing.sm};
`;

const pillRow = css`
	position: relative;
	display: flex;
	gap: ${spacing.xs};
	flex-wrap: wrap;
`;

const inputRow = css`
	display: flex;
	gap: ${spacing.sm};
	align-items: flex-end;
`;

const textareaStyle = css`
	flex: 1;
	min-height: 2.5rem;
	max-height: 10rem;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	font-family: inherit;
	resize: vertical;
	outline: none;

	&:focus {
		border-color: ${colors.borderFocus};
	}

	&::placeholder {
		color: ${colors.textDim};
	}
`;

const sendButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.accent};
	color: ${colors.bg};
	border: none;
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}
	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

type OpenSurface = "none" | "popover" | "strip";

interface ChatInputProps {
	onSend: (message: string) => void;
	isLoading: boolean;
	mediaType: MediaType;
	resultCount: number;
	excludeLibrary: boolean;
	libraryId: string;
	onMediaTypeChange: (value: MediaType) => void;
	onResultCountChange: (value: number) => void;
	onExcludeLibraryChange: (value: boolean) => void;
	onLibraryIdChange: (value: string) => void;
}

const ChatInput = ({
	onSend,
	isLoading,
	mediaType,
	resultCount,
	excludeLibrary,
	libraryId,
	onMediaTypeChange,
	onResultCountChange,
	onExcludeLibraryChange,
	onLibraryIdChange,
}: ChatInputProps) => {
	const [text, setText] = useState("");
	const [included, setIncluded] = useState<string[]>([]);
	const [excluded, setExcluded] = useState<string[]>([]);
	const [openSurface, setOpenSurface] = useState<OpenSurface>("none");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const hasText = text.trim().length > EMPTY;
	const hasGenres = included.length + excluded.length > EMPTY;
	const canSend = hasText || hasGenres;

	const togglePopover = useCallback(() => {
		setOpenSurface((prev) => (prev === "popover" ? "none" : "popover"));
	}, []);
	const toggleStrip = useCallback(() => {
		setOpenSurface((prev) => (prev === "strip" ? "none" : "strip"));
	}, []);
	const closeAll = useCallback(() => {
		setOpenSurface("none");
	}, []);

	const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setText(event.target.value);
	}, []);

	const fireSend = useCallback(
		(inc: readonly string[], exc: readonly string[]) => {
			const composed = composeMessage({ included: inc, excluded: exc, text });
			if (composed.length === EMPTY) return;
			onSend(composed);
			setText("");
			setIncluded([]);
			setExcluded([]);
		},
		[text, onSend],
	);

	const handleSendClick = useCallback(() => {
		if (!canSend) return;
		fireSend(included, excluded);
	}, [canSend, fireSend, included, excluded]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				handleSendClick();
			}
		},
		[handleSendClick],
	);

	const handleStripApply = useCallback((newIncluded: string[], newExcluded: string[]) => {
		setIncluded(newIncluded);
		setExcluded(newExcluded);
		setOpenSurface("none");
	}, []);

	const handleStripApplyAndSend = useCallback(
		(newIncluded: string[], newExcluded: string[]) => {
			setIncluded(newIncluded);
			setExcluded(newExcluded);
			setOpenSurface("none");
			fireSend(newIncluded, newExcluded);
		},
		[fireSend],
	);

	const handleQuickPrompt = useCallback((prompt: string) => {
		setText((prev) => (prev.length === EMPTY ? prompt : `${prev} ${prompt}`));
		textareaRef.current?.focus();
	}, []);

	const handleRemoveGenre = useCallback((genre: string) => {
		setIncluded((prev) => prev.filter((g) => g !== genre));
		setExcluded((prev) => prev.filter((g) => g !== genre));
	}, []);

	return (
		<div className={card}>
			<div className={pillRow}>
				<FiltersPill
					mediaType={mediaType}
					resultCount={resultCount}
					expanded={openSurface === "popover"}
					onClick={togglePopover}
				/>
				<GenresPill
					includedCount={included.length}
					excludedCount={excluded.length}
					expanded={openSurface === "strip"}
					onClick={toggleStrip}
				/>
				{openSurface === "popover" ? (
					<FiltersPopover
						mediaType={mediaType}
						resultCount={resultCount}
						excludeLibrary={excludeLibrary}
						libraryId={libraryId}
						onMediaTypeChange={onMediaTypeChange}
						onResultCountChange={onResultCountChange}
						onExcludeLibraryChange={onExcludeLibraryChange}
						onLibraryIdChange={onLibraryIdChange}
						onClose={closeAll}
					/>
				) : undefined}
			</div>

			{openSurface === "strip" ? (
				<GenreStrip
					committedIncluded={included}
					committedExcluded={excluded}
					onApply={handleStripApply}
					onApplyAndSend={handleStripApplyAndSend}
					onQuickPrompt={handleQuickPrompt}
				/>
			) : (
				<SelectedGenresRow included={included} excluded={excluded} onRemove={handleRemoveGenre} />
			)}

			<div className={inputRow}>
				<textarea
					ref={textareaRef}
					aria-label="Ask for recommendations"
					placeholder="Ask for recommendations..."
					value={text}
					onChange={handleTextChange}
					onKeyDown={handleKeyDown}
					disabled={isLoading}
					className={textareaStyle}
					rows={1}
				/>
				<button
					type="button"
					className={sendButton}
					onClick={handleSendClick}
					disabled={isLoading || !canSend}
				>
					{isLoading ? "Thinking..." : "Send"}
				</button>
			</div>
		</div>
	);
};

export { ChatInput };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vp test src/client/components/__tests__/ChatInput.test.tsx`
Expected: PASS (all 13 cases).

- [ ] **Step 5: Commit**

```bash
git add src/client/components/ChatInput.tsx \
        src/client/components/__tests__/ChatInput.test.tsx
git commit -m "feat: rewrite ChatInput as consolidated B2 input card

Owns local text + committed genre state + openSurface mutex. Wires
FiltersPill/FiltersPopover, GenresPill/GenreStrip, SelectedGenresRow,
and the textarea+send button. Composes the outbound message via the
composeMessage helper. Switches input to textarea for Shift+Enter."
```

---

## Task 9: Wire into `Recommendations` and delete `ChatControls`

**Files:**

- Modify: `src/client/pages/Recommendations.tsx`
- Delete: `src/client/components/ChatControls.tsx`
- Delete: `src/client/components/__tests__/ChatControls.test.tsx`

- [ ] **Step 1: Update `Recommendations.tsx`**

In `src/client/pages/Recommendations.tsx`:

1. Remove the `import { ChatControls } from "../components/ChatControls.tsx";` line (around line 4).
2. Remove the `<ChatControls ... />` render block (lines 188-197).
3. Update the `<ChatInput ... />` render to pass the filter props:

```tsx
<ChatInput
	onSend={chat.handleSend}
	isLoading={chat.isLoading}
	mediaType={chat.mediaType}
	resultCount={chat.resultCount}
	excludeLibrary={chat.excludeLibrary}
	libraryId={chat.libraryId}
	onMediaTypeChange={chat.handleMediaTypeChange}
	onResultCountChange={chat.handleResultCountChange}
	onExcludeLibraryChange={chat.handleExcludeLibraryChange}
	onLibraryIdChange={chat.handleLibraryIdChange}
/>
```

- [ ] **Step 2: Delete `ChatControls` files**

```bash
rm src/client/components/ChatControls.tsx
rm src/client/components/__tests__/ChatControls.test.tsx
```

- [ ] **Step 3: Run full client tests**

Run: `yarn vp test src/client/`
Expected: PASS (no lingering imports from the deleted module).

- [ ] **Step 4: Run typecheck + lint**

Run: `yarn vp check`
Expected: PASS. If anything fails, fix inline (likely a stray import somewhere).

- [ ] **Step 5: Manually smoke-test the UI**

Run: `yarn dev`

- Navigate to `http://localhost:8080/` (or whatever `.env` says).
- Verify: no persistent control bar above the thread; input card at bottom has `Films · 5` and `# Genres` pills.
- Click Filters pill → popover opens above input with media-type segmented, result-count stepper, library select, exclude-watched switch, close button. Changes flip immediately.
- Click Genres pill → strip opens with 18 chips + quick-prompts + Clear/Apply/Apply+send.
- Cycle a chip horror three times through states; confirm visual.
- Close strip without Apply → committed chips don't appear.
- Re-open, include horror + exclude comedy, click Apply → strip closes, SelectedGenresRow shows both chips. Click × on horror → gone.
- Type "quiet", click Send → thread shows the composed user message; genres + text clear.
- Shift+Enter inserts newline; Enter sends.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/Recommendations.tsx
git add -u src/client/components/ChatControls.tsx src/client/components/__tests__/ChatControls.test.tsx
git commit -m "feat: wire B2 ChatInput into Recommendations; delete ChatControls

Removes the persistent control bar — filters now live inside the input
card via FiltersPopover. ChatControls.tsx and its test are deleted."
```

---

## Task 10: E2E test for filter + send flow

Follows the shape of `e2e/feedback.test.ts` — configure mock AI, navigate to recommendations, interact with the input card, assert outbound request + UI state.

**Files:**

- Create: `e2e/chat-filters.test.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/chat-filters.test.ts`:

```ts
import { expect, test } from "./fixtures.ts";

import type { Page } from "@playwright/test";

const mockAiEndpoint = "http://mock-services:4000";
const mockAiApiKey = "mock-openai-key";
const mockAiModel = "gpt-4";

const configureAi = async (page: Page) => {
	await page.goto("/settings");
	await page.getByRole("tab", { name: "AI Configuration" }).click();
	await page.getByLabel("Endpoint URL").fill(mockAiEndpoint);
	await page.getByLabel("API Key").fill(mockAiApiKey);
	await page.getByLabel("Model Name").fill(mockAiModel);
	await page.getByRole("button", { name: "Save" }).click();
	await expect(page.getByText(/saved|updated/i).first()).toBeVisible();
};

test.describe("B2 chat-input filter + send flow", () => {
	test.beforeEach(async ({ page }) => {
		await configureAi(page);
	});

	test.afterEach(async ({ page }) => {
		await page.request.delete("/api/ai/config");
	});

	test("composes genres and text into the outbound /api/chat request", async ({ page }) => {
		await page.goto("/");

		// Open filters popover, switch to TV
		await page.getByRole("button", { name: "Filters" }).click();
		await page.getByRole("radio", { name: "TV Shows" }).click();
		await page.keyboard.press("Escape"); // close popover

		// Open genre strip, include thriller and exclude comedy
		await page.getByRole("button", { name: "Genres" }).click();
		await page.getByRole("button", { name: /thriller, not selected/i }).click();
		await page.getByRole("button", { name: /comedy, not selected/i }).click();
		await page.getByRole("button", { name: /comedy, currently included/i }).click();

		// Type in textarea, then Apply + send
		await page.getByRole("textbox", { name: /ask for recommendations/i }).fill("something quiet");

		// Intercept the outbound chat POST
		const chatPromise = page.waitForRequest(
			(req) => req.url().includes("/api/chat") && req.method() === "POST",
		);
		await page.getByRole("button", { name: /apply \+ send/i }).click();
		const chatRequest = await chatPromise;

		const body = chatRequest.postDataJSON() as {
			message: string;
			mediaType: string;
		};
		expect(body.mediaType).toBe("tv");
		expect(body.message).toBe("Include: thriller. Exclude: comedy. something quiet");

		// After send, textarea + genre pill clear
		await expect(page.getByRole("textbox", { name: /ask for recommendations/i })).toHaveValue("");
		await expect(page.getByRole("button", { name: "Genres" })).toHaveText("# Genres");
	});
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test:e2e -- chat-filters` (runs `scripts/e2e.sh` which spins up the mock services container and invokes Playwright; the argument narrows to tests matching "chat-filters").
Expected: PASS.

If it fails, likely reasons:

- The textarea selector doesn't match — adjust the aria-label match.
- The "# Genres" post-send text doesn't render fast enough — add `await expect(...)` wait.
- The `postDataJSON` key names don't match: inspect the actual request payload (`body.mediaType` might be `body.media_type` etc). Check `src/client/features/chat/api.ts` for the exact shape.

- [ ] **Step 3: Commit**

```bash
git add e2e/chat-filters.test.ts
git commit -m "test: add e2e coverage for B2 filter + send flow"
```

---

## Task 11: Full verification pass

Catches anything missed by the per-task test runs.

- [ ] **Step 1: Run full test suite**

Run: `yarn vp test`
Expected: PASS across all unit + integration test files.

- [ ] **Step 2: Run format + lint + typecheck**

Run: `yarn vp check`
Expected: PASS. Fix any issues that surfaced from deletions (e.g., unused imports, dead types).

- [ ] **Step 3: Run the full e2e suite**

Run: `yarn test:e2e` (full Playwright suite via `scripts/e2e.sh`).
Expected: PASS. If any existing tests relied on the `ChatControls` bar being above the thread, they'll fail — fix by opening the filters popover first.

- [ ] **Step 4: Manually smoke the golden path in a browser**

`yarn dev`, navigate to `/`, send a recommendation with filters applied. Confirm the outbound request in DevTools network tab matches the composed format and `mediaType`/`libraryIds`/`excludeLibrary` fields.

- [ ] **Step 5: Commit any final fixes**

If any tests were fixed up:

```bash
git add .
git commit -m "chore: final B2 cleanup — fix tests affected by removed ChatControls"
```

---

## Out of scope reminders

- **Per-conversation filter persistence** — B7.
- **Server-side structured filters** — future spec.
- **Tweaks panel** — not planned.
- **Backend changes** — none. `useChat` and `/api/chat` are untouched.
