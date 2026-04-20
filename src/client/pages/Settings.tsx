import { css } from "@linaria/atomic";
import { Suspense, lazy, useCallback, useRef, useState } from "react";

import { colors, spacing } from "../theme.ts";
import { pageTitle, pageWrapper } from "./settings/settings-styles.ts";

import type { KeyboardEvent } from "react";

const INACTIVE_TAB_INDEX = -1;
const ACTIVE_TAB_INDEX = 0;
const NOT_FOUND = -1;
const STEP = 1;
const FIRST_INDEX = 0;
const tabId = (id: string) => `settings-tab-${id}`;
const panelId = (id: string) => `settings-panel-${id}`;

const PlexTab = lazy(async () => {
	const mod = await import("./settings/PlexTab.tsx");
	return { default: mod.PlexTab };
});
const AiTab = lazy(async () => {
	const mod = await import("./settings/AiTab.tsx");
	return { default: mod.AiTab };
});
const AccountTab = lazy(async () => {
	const mod = await import("./settings/AccountTab.tsx");
	return { default: mod.AccountTab };
});
const IntegrationsTab = lazy(async () => {
	const mod = await import("./settings/IntegrationsTab.tsx");
	return { default: mod.IntegrationsTab };
});
const LibraryTab = lazy(async () => {
	const mod = await import("./settings/LibraryTab.tsx");
	return { default: mod.LibraryTab };
});

type SettingsTab = "account" | "ai" | "integrations" | "library" | "plex";

const TABS: { id: SettingsTab; label: string }[] = [
	{ id: "plex", label: "Plex Connection" },
	{ id: "ai", label: "AI Configuration" },
	{ id: "library", label: "Library" },
	{ id: "account", label: "Account" },
	{ id: "integrations", label: "Integrations" },
];

const tabBar = css`
	display: flex;
	gap: ${spacing.xs};
	border-bottom: 1px solid ${colors.border};
	margin-bottom: ${spacing.xl};
`;

const tabButtonBase = css`
	padding: ${spacing.sm} ${spacing.md};
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.95rem;
	transition:
		color 0.2s ease,
		border-color 0.2s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const tabButtonActive = css`
	color: ${colors.accent};
	border-bottom-color: ${colors.accent};
`;

/* ── Sub-components ────────────────────────────────────────── */

interface TabButtonProps {
	id: SettingsTab;
	label: string;
	isActive: boolean;
	onClick: (tab: SettingsTab) => void;
	registerRef: (id: SettingsTab, node: HTMLButtonElement | null) => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const TabButton = ({ id, label, isActive, onClick, registerRef, onKeyDown }: TabButtonProps) => {
	const handleClick = useCallback(() => {
		onClick(id);
	}, [id, onClick]);

	const handleRef = useCallback(
		(node: HTMLButtonElement | null) => {
			registerRef(id, node);
		},
		[id, registerRef],
	);

	return (
		<button
			ref={handleRef}
			type="button"
			role="tab"
			id={tabId(id)}
			aria-selected={isActive}
			aria-controls={panelId(id)}
			tabIndex={isActive ? ACTIVE_TAB_INDEX : INACTIVE_TAB_INDEX}
			className={`${tabButtonBase} ${isActive ? tabButtonActive : ""}`}
			onClick={handleClick}
			onKeyDown={onKeyDown}
		>
			{label}
		</button>
	);
};

const SettingsTabBar = ({
	activeTab,
	onTabChange,
}: {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
}) => {
	const buttonRefs = useRef(new Map());

	const registerRef = useCallback((id: SettingsTab, node: HTMLButtonElement | null) => {
		if (node) {
			buttonRefs.current.set(id, node);
		} else {
			buttonRefs.current.delete(id);
		}
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
			if (currentIndex === NOT_FOUND) {
				return;
			}
			let nextIndex = currentIndex;
			if (event.key === "ArrowRight" || event.key === "ArrowDown") {
				nextIndex = (currentIndex + STEP) % TABS.length;
			} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
				nextIndex = (currentIndex - STEP + TABS.length) % TABS.length;
			} else if (event.key === "Home") {
				nextIndex = FIRST_INDEX;
			} else if (event.key === "End") {
				nextIndex = TABS.length - STEP;
			} else {
				return;
			}
			event.preventDefault();
			const nextTab = TABS[nextIndex]?.id;
			if (nextTab !== undefined) {
				onTabChange(nextTab);
				buttonRefs.current.get(nextTab)?.focus();
			}
		},
		[activeTab, onTabChange],
	);

	return (
		<div className={tabBar} role="tablist" aria-label="Settings sections">
			{TABS.map((tab) => (
				<TabButton
					key={tab.id}
					id={tab.id}
					label={tab.label}
					isActive={activeTab === tab.id}
					onClick={onTabChange}
					registerRef={registerRef}
					onKeyDown={handleKeyDown}
				/>
			))}
		</div>
	);
};

const tabLoadingFallback = css`
	display: flex;
	align-items: center;
	justify-content: center;
	padding: ${spacing.xl};
	color: ${colors.textMuted};
`;

const tabFallback = <p className={tabLoadingFallback}>Loading...</p>;

const TabContent = ({ tab }: { tab: SettingsTab }) => (
	<div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} tabIndex={ACTIVE_TAB_INDEX}>
		<Suspense fallback={tabFallback}>
			{tab === "plex" && <PlexTab />}
			{tab === "ai" && <AiTab />}
			{tab === "account" && <AccountTab />}
			{tab === "integrations" && <IntegrationsTab />}
			{tab === "library" && <LibraryTab />}
		</Suspense>
	</div>
);

/* ── Main Settings ─────────────────────────────────────────── */

const Settings = () => {
	const [activeTab, setActiveTab] = useState<SettingsTab>("plex");

	return (
		<div className={pageWrapper}>
			<h1 className={pageTitle}>Settings</h1>
			<SettingsTabBar activeTab={activeTab} onTabChange={setActiveTab} />
			<TabContent tab={activeTab} />
		</div>
	);
};

export { Settings };
