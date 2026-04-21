# Redesign B1 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the Recommendarr redesign — icon-rail sidebar, conversation-aware Recommendations header, new chat message bubbles, and three-dot loading indicator — with `rem` adopted as the default CSS unit.

**Architecture:** In-place component rewrites with one targeted extraction (`Sidebar` out of `AppLayout`). Four new component files (`Sidebar`, `Icon`, `Logo`, `LoadingBubble`). Theme tokens move from `px` to `rem`; visually equivalent at the default 16px root. No backend or schema changes.

**Tech Stack:** React 18, wouter (routing), Redux Toolkit + RTK Query, Linaria (atomic CSS-in-JS), Vitest (unit), Playwright (e2e), `vp` (Vite+ CLI).

**Spec:** [`docs/superpowers/specs/2026-04-21-redesign-b1-foundations-design.md`](../specs/2026-04-21-redesign-b1-foundations-design.md)

---

## File map

**New files:**

- `src/client/components/Icon.tsx` — name-switched inline SVG component
- `src/client/components/Logo.tsx` — accent-tile with inner star, at `size={28}` or `size={22}`
- `src/client/components/Sidebar.tsx` — 60px icon rail (extracted from `AppLayout`)
- `src/client/components/LoadingBubble.tsx` — three-dot pulsing indicator
- `src/client/components/__tests__/Icon.test.tsx`
- `src/client/components/__tests__/Logo.test.tsx`
- `src/client/components/__tests__/Sidebar.test.tsx`
- `src/client/components/__tests__/LoadingBubble.test.tsx`

**Modified files:**

- `src/client/theme.ts` — add `accentDim` color, convert `spacing`/`radii` to rem, add `fontSizes`
- `src/client/global-styles.ts` — add `[data-tooltip]:hover::after`
- `src/client/components/AppLayout.tsx` — shrink to layout shell
- `src/client/components/ChatMessage.tsx` — rewritten for two-mode rendering
- `src/client/components/__tests__/ChatMessage.test.tsx` — updated for new structure
- `src/client/hooks/use-chat.ts` — expose `conversationTitle`
- `src/client/pages/Recommendations.tsx` — new page header, assistant indent, use new `LoadingBubble`, remove empty-state message
- `src/client/pages/__tests__/Recommendations.test.tsx` — updated for new header / loading / button text / no empty state
- `e2e/navigation.test.ts` — landing-page heading assertion updated

**Unchanged:** all other existing components, pages, backend, schema.

---

## Task 1: Theme tokens — rem + new colors + fontSizes

**Files:**

- Modify: `src/client/theme.ts`

- [ ] **Step 1: Update `theme.ts`**

Replace the full contents of `src/client/theme.ts` with:

```ts
// Night Owl color scheme tokens
const colors = {
	bg: "#011627",
	bgLight: "#0b2942",
	bgLighter: "#13344f",
	surface: "#112b45",
	surfaceHover: "#1a3a5c",
	border: "#1e4976",
	borderFocus: "#7fdbca",

	text: "#d6deeb",
	textMuted: "#7f9bba",
	textDim: "#637777",

	accent: "#7fdbca",
	accentDim: "rgba(127,219,202,0.15)",
	accentHover: "#5cc5b0",
	blue: "#82aaff",
	green: "#addb67",
	yellow: "#ecc48d",
	orange: "#f78c6c",
	red: "#ef5350",
	purple: "#c792ea",
	pink: "#ff5874",
} as const;

const spacing = {
	xs: "0.25rem",
	sm: "0.5rem",
	md: "1rem",
	lg: "1.5rem",
	xl: "2rem",
	xxl: "3rem",
} as const;

const radii = {
	sm: "0.25rem",
	md: "0.5rem",
	lg: "0.75rem",
} as const;

const fontSizes = {
	xs: "0.75rem",
	sm: "0.8125rem",
	base: "0.875rem",
	md: "0.9375rem",
	lg: "1.375rem",
} as const;

const fonts = {
	body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	mono: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
} as const;

export { colors, fonts, fontSizes, radii, spacing };
```

- [ ] **Step 2: Run the unit test suite to confirm the swap is non-breaking**

Run: `yarn vp test`
Expected: all tests pass. The token substitution is visually equivalent at 16px root; no tests should fail.

- [ ] **Step 3: Commit**

```bash
git add src/client/theme.ts
git commit -m "refactor(theme): convert spacing/radii tokens to rem, add accentDim + fontSizes"
```

---

## Task 2: Tooltip global style

**Files:**

- Modify: `src/client/global-styles.ts`

- [ ] **Step 1: Extend global styles with tooltip CSS**

Append inside the existing `:global()` block in `src/client/global-styles.ts` (after the `:focus-visible` rule):

```ts
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

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `yarn vp test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/client/global-styles.ts
git commit -m "feat(styles): add global data-tooltip hover rule"
```

---

## Task 3: Icon component (TDD)

**Files:**

- Create: `src/client/components/Icon.tsx`
- Create: `src/client/components/__tests__/Icon.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/client/components/__tests__/Icon.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { Icon } from "../Icon.tsx";

const setup = () => {
	onTestFinished(cleanup);
};

describe(Icon, () => {
	it("renders an svg for the spark icon", () => {
		setup();
		const { container } = render(<Icon name="spark" />);
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("renders an svg for every supported name", () => {
		const names = ["spark", "clock", "settings", "logout", "plus"] as const;
		for (const name of names) {
			setup();
			const { container } = render(<Icon name={name} />);
			expect(container.querySelector("svg")).not.toBeNull();
		}
	});

	it("renders nothing for an unknown name", () => {
		setup();
		const { container } = render(<Icon name={"nope" as "spark"} />);
		expect(container.querySelector("svg")).toBeNull();
	});

	it("honours a custom size", () => {
		setup();
		const { container } = render(<Icon name="plus" size={24} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("24");
		expect(svg?.getAttribute("height")).toBe("24");
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `yarn vp test src/client/components/__tests__/Icon.test.tsx`
Expected: FAIL with "Cannot find module '../Icon.tsx'" or similar.

- [ ] **Step 3: Create Icon component**

Create `src/client/components/Icon.tsx`:

```tsx
interface IconProps {
	name: "spark" | "clock" | "settings" | "logout" | "plus";
	size?: number;
	color?: string;
}

const DEFAULT_SIZE = 17;
const STROKE_WIDTH = "1.3";

export const Icon = ({ name, size = DEFAULT_SIZE, color = "currentColor" }: IconProps) => {
	const dims = { width: size, height: size };

	if (name === "spark") {
		return (
			<svg {...dims} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path
					d="M9 2l1.5 4.5H15l-3.75 2.75 1.5 4.5L9 11 5.25 13.75l1.5-4.5L3 6.5h4.5L9 2z"
					stroke={color}
					strokeWidth="1.2"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (name === "clock") {
		return (
			<svg {...dims} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth={STROKE_WIDTH} />
				<path
					d="M9 5.5V9l2.5 1.5"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (name === "settings") {
		return (
			<svg {...dims} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<circle cx="9" cy="9" r="2.5" stroke={color} strokeWidth={STROKE_WIDTH} />
				<path
					d="M9 1v2M9 15v2M1 9h2M15 9h2M3.1 3.1l1.4 1.4M13.5 13.5l1.4 1.4M3.1 14.9l1.4-1.4M13.5 4.5l1.4-1.4"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (name === "logout") {
		return (
			<svg {...dims} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path
					d="M7 3H3a1 1 0 00-1 1v10a1 1 0 001 1h4M12 13l3-4-3-4M15 9H7"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (name === "plus") {
		return (
			<svg {...dims} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path d="M9 3v12M3 9h12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
			</svg>
		);
	}
	// oxlint-disable-next-line unicorn/no-null -- intentional null for unsupported icon name
	return null;
};
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `yarn vp test src/client/components/__tests__/Icon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/Icon.tsx src/client/components/__tests__/Icon.test.tsx
git commit -m "feat(client): add Icon component"
```

---

## Task 4: Logo component (TDD)

**Files:**

- Create: `src/client/components/Logo.tsx`
- Create: `src/client/components/__tests__/Logo.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/client/components/__tests__/Logo.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { Logo } from "../Logo.tsx";

const setup = () => {
	onTestFinished(cleanup);
};

describe(Logo, () => {
	it("renders an outer tile at size 28", () => {
		setup();
		const { container } = render(<Logo size={28} />);
		const tile = container.firstChild as HTMLElement | null;
		expect(tile).not.toBeNull();
		expect(tile?.getAttribute("aria-label")).toBe("Recommendarr");
	});

	it("renders an inner star svg at size 22", () => {
		setup();
		const { container } = render(<Logo size={22} />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("width")).toBe("10");
		expect(svg?.getAttribute("height")).toBe("10");
	});

	it("renders inner svg at 14x14 for size 28", () => {
		setup();
		const { container } = render(<Logo size={28} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("14");
		expect(svg?.getAttribute("height")).toBe("14");
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `yarn vp test src/client/components/__tests__/Logo.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create Logo component**

Create `src/client/components/Logo.tsx`:

```tsx
import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";

interface LogoProps {
	size: 22 | 28;
}

const tile = css`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	background: ${colors.accent};
`;

const tile28 = css`
	width: 1.75rem;
	height: 1.75rem;
	border-radius: 0.5rem;
`;

const tile22 = css`
	width: 1.375rem;
	height: 1.375rem;
	border-radius: 0.375rem;
`;

const STAR_PATH = "M7 1l1.5 3.5 3.5.5-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z";

export const Logo = ({ size }: LogoProps) => {
	const inner = size === 28 ? 14 : 10;
	const tileClass = size === 28 ? tile28 : tile22;
	return (
		<div aria-label="Recommendarr" className={`${tile} ${tileClass}`}>
			<svg width={inner} height={inner} viewBox="0 0 14 14" fill="none" aria-hidden="true">
				<path d={STAR_PATH} fill={colors.bg} />
			</svg>
		</div>
	);
};
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `yarn vp test src/client/components/__tests__/Logo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/Logo.tsx src/client/components/__tests__/Logo.test.tsx
git commit -m "feat(client): add Logo component"
```

---

## Task 5: Sidebar component (TDD)

**Files:**

- Create: `src/client/components/Sidebar.tsx`
- Create: `src/client/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/client/components/__tests__/Sidebar.test.tsx`:

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
} from "vite-plus/test";
import { Router } from "wouter";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { Sidebar } from "../Sidebar.tsx";

const server = setupServer(
	http.post("/api/auth/logout", () => HttpResponse.json({ success: true })),
);

const renderSidebar = (ssrPath: string) => {
	const store = createStore();
	onTestFinished(() => {
		cleanup();
		store.dispatch(api.util.resetApiState());
	});
	render(
		<Provider store={store}>
			<Router ssrPath={ssrPath}>
				<Sidebar />
			</Router>
		</Provider>,
	);
	return { store };
};

describe(Sidebar, () => {
	beforeAll(() => server.listen());
	afterEach(() => server.resetHandlers());
	afterAll(() => server.close());

	it("renders three nav links with accessible names", () => {
		renderSidebar("/");
		expect(screen.getByRole("link", { name: "Recommendations" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
	});

	it("sets aria-current on the active route", () => {
		renderSidebar("/history");
		const historyLink = screen.getByRole("link", { name: "History" });
		expect(historyLink.getAttribute("aria-current")).toBe("page");
		const recsLink = screen.getByRole("link", { name: "Recommendations" });
		expect(recsLink.getAttribute("aria-current")).not.toBe("page");
	});

	it("exposes data-tooltip on every nav link", () => {
		renderSidebar("/");
		const items: [string, string][] = [
			["Recommendations", "Recommendations"],
			["History", "History"],
			["Settings", "Settings"],
		];
		for (const [name, tooltip] of items) {
			const link = screen.getByRole("link", { name });
			expect(link.getAttribute("data-tooltip")).toBe(tooltip);
		}
	});

	it("renders a logout button with accessible name", () => {
		renderSidebar("/");
		expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
	});

	it("clicking logout calls the logout endpoint", async () => {
		let called = false;
		server.use(
			http.post("/api/auth/logout", () => {
				called = true;
				return HttpResponse.json({ success: true });
			}),
		);
		renderSidebar("/");
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Log out" }));
		// Let the fetch flush
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(called).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `yarn vp test src/client/components/__tests__/Sidebar.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create Sidebar component**

Create `src/client/components/Sidebar.tsx`:

```tsx
import { css } from "@linaria/atomic";
import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation } from "wouter";

import { api } from "../api.ts";
import { useLogoutMutation } from "../features/auth/api.ts";
import { colors } from "../theme.ts";
import { Icon } from "./Icon.tsx";
import { Logo } from "./Logo.tsx";

const SIDEBAR_WIDTH = "3.75rem";
const ITEM_HEIGHT = "3.75rem";

const nav = css`
	width: ${SIDEBAR_WIDTH};
	background: ${colors.surface};
	border-right: 1px solid ${colors.border};
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
`;

const logoBlock = css`
	padding: 1.25rem 0 1rem;
	display: flex;
	align-items: center;
	justify-content: center;
	border-bottom: 1px solid ${colors.border};
`;

const list = css`
	list-style: none;
	padding: 0.5rem 0;
	margin: 0;
	flex: 1;
`;

const itemBase = css`
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: ${ITEM_HEIGHT};
	color: ${colors.textMuted};
	background: none;
	border: none;
	cursor: pointer;
	text-decoration: none;
	transition:
		background 0.15s ease,
		color 0.15s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const itemActive = css`
	background: ${colors.accentDim};
	color: ${colors.accent};

	&:hover {
		background: ${colors.accentDim};
		color: ${colors.accent};
	}
`;

const activeBar = css`
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%);
	width: 0.1875rem;
	height: 1.25rem;
	background: ${colors.accent};
	border-radius: 0 0.1875rem 0.1875rem 0;
`;

const bottomRow = css`
	display: flex;
	justify-content: center;
	border-top: 1px solid ${colors.border};
`;

const logoutButton = css`
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: ${ITEM_HEIGHT};
	background: none;
	border: none;
	color: ${colors.textDim};
	cursor: pointer;
	transition: color 0.15s ease;

	&:hover {
		color: ${colors.red};
	}
`;

interface NavItemDef {
	href: string;
	label: string;
	icon: "spark" | "clock" | "settings";
}

const NAV_ITEMS: readonly NavItemDef[] = [
	{ href: "/", label: "Recommendations", icon: "spark" },
	{ href: "/history", label: "History", icon: "clock" },
	{ href: "/settings", label: "Settings", icon: "settings" },
] as const;

interface NavItemProps {
	item: NavItemDef;
	isActive: boolean;
}

const NavItem = ({ item, isActive }: NavItemProps) => (
	<li>
		<Link
			href={item.href}
			aria-label={item.label}
			data-tooltip={item.label}
			aria-current={isActive ? "page" : undefined}
			className={`${itemBase} ${isActive ? itemActive : ""}`}
		>
			{isActive ? <span aria-hidden="true" className={activeBar} /> : undefined}
			<Icon name={item.icon} size={17} />
		</Link>
	</li>
);

export const Sidebar = () => {
	const [location] = useLocation();
	const [logout] = useLogoutMutation();
	const dispatch = useDispatch();

	const handleLogout = useCallback(async () => {
		await logout();
		dispatch(api.util.resetApiState());
	}, [logout, dispatch]);

	return (
		<nav className={nav}>
			<div className={logoBlock}>
				<Logo size={28} />
			</div>
			<ul className={list}>
				{NAV_ITEMS.map((item) => (
					<NavItem key={item.href} item={item} isActive={location === item.href} />
				))}
			</ul>
			<div className={bottomRow}>
				<button
					type="button"
					aria-label="Log out"
					data-tooltip="Log out"
					className={logoutButton}
					onClick={handleLogout}
				>
					<Icon name="logout" size={16} />
				</button>
			</div>
		</nav>
	);
};
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `yarn vp test src/client/components/__tests__/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/Sidebar.tsx src/client/components/__tests__/Sidebar.test.tsx
git commit -m "feat(client): add icon-rail Sidebar component"
```

---

## Task 6: AppLayout shrink (use extracted Sidebar)

**Files:**

- Modify: `src/client/components/AppLayout.tsx`

- [ ] **Step 1: Replace AppLayout contents**

Replace the full contents of `src/client/components/AppLayout.tsx` with:

```tsx
import { css } from "@linaria/atomic";

import { Sidebar } from "./Sidebar.tsx";

import type { ReactNode } from "react";

const layoutWrapper = css`
	display: flex;
	min-height: 100vh;
`;

const mainContent = css`
	flex: 1;
	overflow-y: auto;
`;

interface AppLayoutProps {
	children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => (
	<div className={layoutWrapper}>
		<Sidebar />
		<main className={mainContent}>{children}</main>
	</div>
);
```

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `yarn vp test`
Expected: all tests pass (the previous AppLayout tests — if any — still pass; Sidebar tests cover the extracted code).

- [ ] **Step 3: Commit**

```bash
git add src/client/components/AppLayout.tsx
git commit -m "refactor(client): extract Sidebar from AppLayout"
```

---

## Task 7: LoadingBubble component (TDD)

**Files:**

- Create: `src/client/components/LoadingBubble.tsx`
- Create: `src/client/components/__tests__/LoadingBubble.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/client/components/__tests__/LoadingBubble.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { LoadingBubble } from "../LoadingBubble.tsx";

const setup = () => {
	onTestFinished(cleanup);
};

describe(LoadingBubble, () => {
	it("renders a status role with an accessible label", () => {
		setup();
		render(<LoadingBubble />);
		expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
	});

	it("renders three dot elements", () => {
		setup();
		const { container } = render(<LoadingBubble />);
		const dots = container.querySelectorAll('[data-testid="loading-dot"]');
		const expectedDots = 3;
		expect(dots.length).toBe(expectedDots);
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `yarn vp test src/client/components/__tests__/LoadingBubble.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create LoadingBubble component**

Create `src/client/components/LoadingBubble.tsx`:

```tsx
import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";

const wrapper = css`
	padding-left: 1.875rem;
	margin-bottom: 1rem;
`;

const bubble = css`
	display: inline-flex;
	gap: 0.25rem;
	padding: 0.5rem 0.875rem;
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: 0.625rem;
`;

const dotBase = css`
	width: 0.375rem;
	height: 0.375rem;
	border-radius: 50%;
	background: ${colors.accent};
	opacity: 0.7;
	animation: loadingPulse 1s ease-in-out infinite;

	@keyframes loadingPulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}
`;

const dot0 = css`
	animation-delay: 0s;
`;

const dot1 = css`
	animation-delay: 0.15s;
`;

const dot2 = css`
	animation-delay: 0.3s;
`;

export const LoadingBubble = () => (
	<div className={wrapper}>
		<div role="status" aria-label="Loading" className={bubble}>
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot0}`} />
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot1}`} />
			<span data-testid="loading-dot" aria-hidden="true" className={`${dotBase} ${dot2}`} />
		</div>
	</div>
);
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `yarn vp test src/client/components/__tests__/LoadingBubble.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/LoadingBubble.tsx src/client/components/__tests__/LoadingBubble.test.tsx
git commit -m "feat(client): add LoadingBubble with three pulsing dots"
```

---

## Task 8: ChatMessage rewrite (TDD)

**Files:**

- Modify: `src/client/components/ChatMessage.tsx`
- Modify: `src/client/components/__tests__/ChatMessage.test.tsx`

- [ ] **Step 1: Replace ChatMessage test**

Replace the full contents of `src/client/components/__tests__/ChatMessage.test.tsx` with:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { ChatMessage } from "../ChatMessage.tsx";

const renderMessage = (content: string, role: string) => {
	onTestFinished(cleanup);
	return render(<ChatMessage content={content} role={role} />);
};

describe(ChatMessage, () => {
	it("renders user message content inside a right-aligned bubble", () => {
		const { container } = renderMessage("Hello, recommend me some movies!", "user");
		expect(screen.getByText("Hello, recommend me some movies!")).toBeInTheDocument();
		const wrapper = container.firstChild as HTMLElement | null;
		expect(wrapper?.getAttribute("data-role")).toBe("user");
	});

	it("renders assistant message with Recommendarr label and content", () => {
		renderMessage("Here are some great action movies for you.", "assistant");
		expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		expect(screen.getByText("Here are some great action movies for you.")).toBeInTheDocument();
	});

	it("renders an accessible logo tile on assistant messages", () => {
		renderMessage("anything", "assistant");
		expect(screen.getByLabelText("Recommendarr")).toBeInTheDocument();
	});

	it("does not render the Recommendarr label on user messages", () => {
		renderMessage("my prompt", "user");
		expect(screen.queryByText("Recommendarr")).toBeNull();
	});

	it("renders multiline assistant content", () => {
		renderMessage("Line one\nLine two", "assistant");
		const elements = screen.getAllByText(
			(_content, node) => node?.textContent === "Line one\nLine two",
		);
		const atLeastOne = 1;
		expect(elements.length).toBeGreaterThanOrEqual(atLeastOne);
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `yarn vp test src/client/components/__tests__/ChatMessage.test.tsx`
Expected: FAIL — the current implementation has no `data-role` attribute and no "Recommendarr" label.

- [ ] **Step 3: Replace ChatMessage implementation**

Replace the full contents of `src/client/components/ChatMessage.tsx` with:

```tsx
import { css } from "@linaria/atomic";

import { colors } from "../theme.ts";
import { Logo } from "./Logo.tsx";

const userWrapper = css`
	display: flex;
	justify-content: flex-end;
	margin-bottom: 1.25rem;
`;

const userBubble = css`
	max-width: 70%;
	background: ${colors.accentDim};
	border: 1px solid rgba(127, 219, 202, 0.2);
	border-radius: 0.875rem 0.875rem 0.25rem 0.875rem;
	padding: 0.625rem 0.875rem;
	font-size: 0.875rem;
	color: ${colors.text};
	line-height: 1.55;
`;

const assistantWrapper = css`
	margin-bottom: 1.25rem;
`;

const assistantHeader = css`
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
`;

const assistantLabel = css`
	font-size: 0.75rem;
	color: ${colors.textDim};
	font-weight: 500;
`;

const assistantContent = css`
	font-size: 0.875rem;
	color: ${colors.textMuted};
	line-height: 1.6;
	padding-left: 1.875rem;
	margin-bottom: 0.75rem;
`;

interface ChatMessageProps {
	content: string;
	role: string;
}

export const ChatMessage = ({ content, role }: ChatMessageProps) => {
	if (role === "user") {
		return (
			<div data-role="user" className={userWrapper}>
				<div className={userBubble}>{content}</div>
			</div>
		);
	}

	return (
		<div data-role="assistant" className={assistantWrapper}>
			<div className={assistantHeader}>
				<Logo size={22} />
				<span className={assistantLabel}>Recommendarr</span>
			</div>
			<p className={assistantContent}>{content}</p>
		</div>
	);
};
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `yarn vp test src/client/components/__tests__/ChatMessage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/ChatMessage.tsx src/client/components/__tests__/ChatMessage.test.tsx
git commit -m "feat(client): rework ChatMessage into two-mode bubble"
```

---

## Task 9: Expose `conversationTitle` from `use-chat`

**Files:**

- Modify: `src/client/hooks/use-chat.ts`

- [ ] **Step 1: Add conversationTitle to the hook return**

In `src/client/hooks/use-chat.ts`, update the `return` object (lines 132–147) to include `conversationTitle`:

```ts
return {
	messages,
	isLoading,
	conversationId,
	conversationTitle: conversationData?.title,
	mediaType,
	handleMediaTypeChange: setMediaType,
	libraryId,
	handleLibraryIdChange: setLibraryId,
	resultCount,
	handleResultCountChange: setResultCount,
	excludeLibrary: resolvedExclude,
	handleExcludeLibraryChange,
	handleNewConversation,
	handleSend,
	handleRecommendationFeedback,
};
```

- [ ] **Step 2: Run tests to ensure nothing broke**

Run: `yarn vp test`
Expected: all pass. Existing tests don't assert the returned object's shape exhaustively, so adding a field is backwards-compatible.

- [ ] **Step 3: Commit**

```bash
git add src/client/hooks/use-chat.ts
git commit -m "feat(client): expose conversationTitle from useChat"
```

---

## Task 10: Recommendations page — header, indent, new LoadingBubble, drop empty-state message

**Files:**

- Modify: `src/client/pages/Recommendations.tsx`
- Modify: `src/client/pages/__tests__/Recommendations.test.tsx`

- [ ] **Step 1: Update the Recommendations test for the new header/loading/empty-state behavior**

In `src/client/pages/__tests__/Recommendations.test.tsx` make the following replacements:

Replace the test `it("renders the page header", ...)`:

```tsx
it("renders the default page header when no conversation is loaded", () => {
	renderRecommendations();

	expect(screen.getByRole("heading", { name: /new conversation/i })).toBeInTheDocument();
	expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
});
```

Replace the test `it("renders new conversation button", ...)`:

```tsx
it("renders the New button", () => {
	renderRecommendations();

	expect(screen.getByRole("button", { name: /^new$/i })).toBeInTheDocument();
});
```

Delete the test `it("shows empty state message initially", ...)` in its entirety (the "Send a message to get recommendations" text no longer exists).

Replace the test `it("shows thinking indicator while loading", ...)`:

```tsx
it("shows loading indicator while waiting on a response", async () => {
	// oxlint-disable-next-line promise/avoid-new
	server.use(http.post("/api/chat", () => new Promise(() => {})));

	renderRecommendations();
	const user = userEvent.setup();

	await user.type(
		screen.getByRole("textbox", { name: /ask for recommendations/i }),
		"suggest something",
	);
	await user.click(screen.getByRole("button", { name: /send/i }));

	expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
});
```

Replace the test `it("clears messages on new conversation", ...)` — change the end of the test (the last two `await` + expect blocks) so it no longer asserts the empty-state message:

```tsx
it("clears messages on new conversation", async () => {
	server.use(
		http.post("/api/chat", () =>
			HttpResponse.json({
				conversationId: "conv-1",
				message: {
					id: "msg-1",
					content: "AI response",
					role: "assistant",
					createdAt: new Date().toISOString(),
					recommendations: [],
				},
			}),
		),
		http.get("/api/conversations/conv-1", () =>
			HttpResponse.json({
				id: "conv-1",
				mediaType: "movie",
				title: "chat",
				createdAt: new Date().toISOString(),
				messages: [],
			}),
		),
	);

	renderRecommendations();
	const user = userEvent.setup();

	await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "test");
	await user.click(screen.getByRole("button", { name: /send/i }));

	await screen.findByText("AI response");

	await user.click(screen.getByRole("button", { name: /^new$/i }));

	await waitFor(() => {
		expect(screen.queryByText("AI response")).toBeNull();
	});
	expect(screen.getByRole("heading", { name: /new conversation/i })).toBeInTheDocument();
});
```

Update the test `it("resets URL to / when new conversation is clicked", ...)` — change the button-name assertion:

```tsx
await user.click(screen.getByRole("button", { name: /^new$/i }));
```

Add one new test immediately after `it("renders the default page header ...")`:

```tsx
it("shows the conversation title once loaded", async () => {
	globalThis.history.replaceState({}, "", "/?conversation=conv-42");
	server.use(
		http.get("/api/conversations/conv-42", () =>
			HttpResponse.json({
				id: "conv-42",
				mediaType: "movie",
				title: "Sci-fi deep cuts",
				createdAt: new Date().toISOString(),
				messages: [],
			}),
		),
	);

	renderRecommendations();

	await expect(
		screen.findByRole("heading", { name: /sci-fi deep cuts/i }),
	).resolves.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `yarn vp test src/client/pages/__tests__/Recommendations.test.tsx`
Expected: FAIL — the current page still renders "Recommendations", "New Conversation", and "Send a message to get recommendations".

- [ ] **Step 3: Replace Recommendations.tsx**

Replace the full contents of `src/client/pages/Recommendations.tsx` with:

```tsx
import { css } from "@linaria/atomic";
import { useEffect, useRef } from "react";

import { ChatControls } from "../components/ChatControls.tsx";
import { ChatInput } from "../components/ChatInput.tsx";
import { ChatMessage } from "../components/ChatMessage.tsx";
import { Icon } from "../components/Icon.tsx";
import { LoadingBubble } from "../components/LoadingBubble.tsx";
import { RecommendationCard } from "../components/RecommendationCard.tsx";
import { useChat } from "../hooks/use-chat.ts";
import { colors } from "../theme.ts";

import type { ChatMessage as ChatMessageType } from "@shared/schemas/chat";

const NO_RECOMMENDATIONS = 0;
const NO_MESSAGES = 0;

const pageWrapper = css`
	display: flex;
	flex-direction: column;
	height: 100vh;
`;

const headerBar = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1.25rem;
	border-bottom: 1px solid ${colors.border};
	background: ${colors.bg};
	flex-shrink: 0;
`;

const pageTitleStyle = css`
	font-size: 0.9375rem;
	font-weight: 700;
	color: ${colors.text};
	letter-spacing: -0.2px;
`;

const pageSubtitle = css`
	font-size: 0.75rem;
	color: ${colors.textDim};
	margin-top: 0.0625rem;
`;

const newButton = css`
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.375rem 0.75rem;
	background: none;
	border: 1px solid ${colors.border};
	border-radius: 0.5rem;
	color: ${colors.textMuted};
	font-size: 0.75rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: ${colors.accent};
		color: ${colors.accent};
	}
`;

const threadArea = css`
	flex: 1;
	overflow-y: auto;
	padding: 1.25rem 1.25rem 0;
`;

const assistantRecsIndent = css`
	padding-left: 1.875rem;
`;

/* ── Sub-components ────────────────────────────────────────── */

interface PageHeaderProps {
	title: string | undefined;
	messageCount: number;
	recCount: number;
	onNewConversation: () => void;
}

const formatSubtitle = (messageCount: number, recCount: number): string => {
	if (messageCount === NO_MESSAGES) {
		return "No messages yet";
	}
	return `${String(recCount)} recommendations · ${String(messageCount)} messages`;
};

const PageHeader = ({ title, messageCount, recCount, onNewConversation }: PageHeaderProps) => (
	<div className={headerBar}>
		<div>
			<h1 className={pageTitleStyle}>{title ?? "New conversation"}</h1>
			<p className={pageSubtitle}>{formatSubtitle(messageCount, recCount)}</p>
		</div>
		<button type="button" className={newButton} onClick={onNewConversation}>
			<Icon name="plus" size={13} />
			New
		</button>
	</div>
);

const MessageItem = ({
	message,
	conversationId,
	onFeedbackChange,
}: {
	message: ChatMessageType;
	conversationId: string;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
}) => (
	<>
		<ChatMessage content={message.content} role={message.role} />
		{message.recommendations.length > NO_RECOMMENDATIONS ? (
			<div className={message.role === "assistant" ? assistantRecsIndent : ""}>
				{message.recommendations.map((rec) => (
					<RecommendationCard
						key={rec.id}
						recommendation={rec}
						conversationId={conversationId}
						onFeedbackChange={onFeedbackChange}
					/>
				))}
			</div>
		) : undefined}
	</>
);

const MessageThread = ({
	messages,
	isLoading,
	conversationId,
	onFeedbackChange,
}: {
	messages: ChatMessageType[];
	isLoading: boolean;
	conversationId: string | undefined;
	onFeedbackChange?:
		| ((recommendationId: string, feedback: "liked" | "disliked" | null) => void)
		| undefined;
}) => {
	const threadRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (threadRef.current) {
			threadRef.current.scrollTop = threadRef.current.scrollHeight;
		}
	}, [messages.length, isLoading]);

	return (
		<div className={threadArea} ref={threadRef}>
			{messages.map((msg) => (
				<MessageItem
					key={msg.id}
					message={msg}
					conversationId={conversationId ?? ""}
					onFeedbackChange={onFeedbackChange}
				/>
			))}
			{isLoading ? <LoadingBubble /> : undefined}
		</div>
	);
};

/* ── Main Recommendations ──────────────────────────────────── */

const Recommendations = () => {
	const chat = useChat();
	const recCount = chat.messages.reduce(
		(total, msg) => total + msg.recommendations.length,
		NO_RECOMMENDATIONS,
	);

	return (
		<div className={pageWrapper}>
			<PageHeader
				title={chat.conversationTitle}
				messageCount={chat.messages.length}
				recCount={recCount}
				onNewConversation={chat.handleNewConversation}
			/>
			<ChatControls
				mediaType={chat.mediaType}
				onMediaTypeChange={chat.handleMediaTypeChange}
				libraryId={chat.libraryId}
				onLibraryIdChange={chat.handleLibraryIdChange}
				resultCount={chat.resultCount}
				onResultCountChange={chat.handleResultCountChange}
				excludeLibrary={chat.excludeLibrary}
				onExcludeLibraryChange={chat.handleExcludeLibraryChange}
			/>
			<MessageThread
				messages={chat.messages}
				isLoading={chat.isLoading}
				conversationId={chat.conversationId}
				onFeedbackChange={chat.handleRecommendationFeedback}
			/>
			<ChatInput onSend={chat.handleSend} isLoading={chat.isLoading} />
		</div>
	);
};

export { Recommendations };
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `yarn vp test src/client/pages/__tests__/Recommendations.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `yarn vp test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/Recommendations.tsx src/client/pages/__tests__/Recommendations.test.tsx
git commit -m "feat(client): conversation-aware header + three-dot loader on Recommendations"
```

---

## Task 11: E2E — update navigation landing assertion

**Files:**

- Modify: `e2e/navigation.test.ts`

- [ ] **Step 1: Update the landing-page test**

Replace the body of the first test in `e2e/navigation.test.ts`:

```ts
test("landing page shows the New conversation header", async ({ authenticatedPage: page }) => {
	await expect(page).toHaveURL("/");
	await expect(page.getByRole("heading", { name: /new conversation/i })).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Recommendations" }).and(page.locator('[aria-current="page"]')),
	).toBeVisible();
});
```

The other tests (`Settings`, `History`, `Recommendations` back-nav, unknown-route redirect) continue to work because sidebar links keep `aria-label` values matching their route name.

- [ ] **Step 2: Run the navigation e2e**

Run: `yarn test:e2e e2e/navigation.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 3: Audit remaining e2e tests for regressions**

Run the full e2e suite:

Run: `yarn test:e2e`
Expected: all tests pass. If any test depends on the old 240px sidebar width, the visible "Recommendarr" logo text, the visible "Thinking..." copy, or the "New Conversation" button text, update the selector to the new accessible name (`New`) or use a non-text selector. The likely-affected tests are `feedback.test.ts` and anything that sends a chat message.

- [ ] **Step 4: Commit**

If any additional e2e files were touched in Step 3, include them:

```bash
git add e2e/navigation.test.ts
# plus any other e2e files touched in Step 3
git commit -m "test(e2e): update selectors for redesigned header and sidebar"
```

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full format + lint + typecheck**

Run: `yarn vp check`
Expected: PASS.

- [ ] **Step 2: Run the full unit test suite**

Run: `yarn vp test`
Expected: all tests pass.

- [ ] **Step 3: Run the full e2e suite**

Run: `yarn test:e2e`
Expected: all tests pass.

- [ ] **Step 4: Manual smoke — dev server**

Run: `yarn dev`
Then in a browser:

1. Log in (or register if this is a fresh DB).
2. Confirm the sidebar is the new 60px icon rail with the accent tile logo, three icons (spark/clock/settings), and a logout icon at the bottom.
3. Hover each nav icon; confirm the CSS tooltip appears with the page name.
4. Confirm the active page has a left accent bar and tinted background.
5. On the Recommendations page, confirm the header reads `New conversation` + `No messages yet` with a pill `+ New` button on the right.
6. Send a chat message. Confirm:
   - The user message appears as a right-aligned tinted bubble.
   - The loading indicator is three pulsing teal dots (no "Thinking..." text).
   - The assistant response renders with the 22px accent-tile logo + `Recommendarr` label + indented body text.
   - Recommendation cards (unchanged in B1) are indented under the assistant message.
7. Navigate to History and Settings. Confirm no visible regressions.
8. Click logout in the sidebar; confirm the session ends and you're redirected to Login.

- [ ] **Step 5: Manual rem-swap smoke**

Compare against `main` (or the branch point of this work) side-by-side:

- Login page: spacing and rounded corners look equivalent.
- Register page: same.
- Recommendations input bar and cards: same (these are unchanged in B1 logic but inherit the token-rem swap).
- History row padding and borders: same.
- Settings tabs: same.

If anything looks visibly off, the rem value for a token is likely wrong. The conversions are visually identical at 16px root — a regression here means a typo in `theme.ts`.

- [ ] **Step 6: If all checks pass, push and open a PR**

```bash
git push -u origin redesign
gh pr create --title "redesign(b1): foundations — sidebar, header, message bubble, loader" --body "$(cat <<'EOF'
## Summary

Phase 1 of the multi-phase redesign. Frontend-only, no schema or API changes.

- 60px icon-rail sidebar extracted into `Sidebar.tsx`, with CSS tooltips and a left accent bar for the active route
- Conversation-aware Recommendations header (title + `N recommendations · N messages`), with a pill `New` button
- Chat messages reshaped: right-aligned user bubbles; assistant messages with logo avatar, `Recommendarr` label, and indented content
- Three-dot pulsing `LoadingBubble` replaces the `Thinking...` bubble
- `rem` adopted as the default CSS unit; `theme.ts` tokens converted accordingly, `fontSizes` group added

Spec: `docs/superpowers/specs/2026-04-21-redesign-b1-foundations-design.md`

## Test plan

- [x] `yarn vp check`
- [x] `yarn vp test`
- [x] `yarn test:e2e`
- [x] Manual smoke: sidebar hover tooltips, active accent bar, send a chat message end-to-end, logout
- [x] rem-swap visual parity vs. main on Login / Register / Recommendations / History / Settings

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- **TDD discipline:** do not skip the "run the test and confirm it fails" step in any task that uses TDD. If a test passes before implementation, the test is not actually covering the change.
- **Commit per task.** Each task ends with a commit. Don't squash into one big commit — the phased history is the log of the redesign.
- **Lint/format hooks** run on commit via the project's staged-files tooling (`vp check --fix`). If a hook fails, read the output, fix the underlying issue, re-stage, and create a _new_ commit — never `--amend` after a hook failure.
- **Spec changes during implementation:** if something doesn't fit (e.g. a test fixture requires a different mock), flag it and update the spec in the same PR. Don't invent solutions the spec didn't anticipate.
- **Don't touch files outside the list.** The non-goals in the spec are load-bearing. If you find yourself editing `ChatControls`, `ChatInput`, or `RecommendationCard`, stop and confirm.
