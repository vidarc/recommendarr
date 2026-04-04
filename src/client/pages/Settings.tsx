import { css } from "@linaria/atomic";
import { Suspense, lazy, useCallback, useState } from "react";

import { colors, spacing } from "../theme.ts";
import { pageTitle, pageWrapper } from "./settings/settings-styles.ts";

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
}

const TabButton = ({ id, label, isActive, onClick }: TabButtonProps) => {
	const handleClick = useCallback(() => {
		onClick(id);
	}, [id, onClick]);

	return (
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			className={`${tabButtonBase} ${isActive ? tabButtonActive : ""}`}
			onClick={handleClick}
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
}) => (
	<div className={tabBar} role="tablist">
		{TABS.map((tab) => (
			<TabButton
				key={tab.id}
				id={tab.id}
				label={tab.label}
				isActive={activeTab === tab.id}
				onClick={onTabChange}
			/>
		))}
	</div>
);

const tabLoadingFallback = css`
	display: flex;
	align-items: center;
	justify-content: center;
	padding: ${spacing.xl};
	color: ${colors.textMuted};
`;

const tabFallback = <p className={tabLoadingFallback}>Loading...</p>;

const TabContent = ({ tab }: { tab: SettingsTab }) => (
	<div role="tabpanel">
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
