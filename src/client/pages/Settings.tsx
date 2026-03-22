import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { colors, spacing } from "../theme.ts";
import { AccountTab } from "./settings/AccountTab.tsx";
import { AiTab } from "./settings/AiTab.tsx";
import { IntegrationsTab } from "./settings/IntegrationsTab.tsx";
import { PlexTab } from "./settings/PlexTab.tsx";
import { pageTitle, pageWrapper } from "./settings/settings-styles.ts";

type SettingsTab = "account" | "ai" | "integrations" | "plex";

const TABS: { id: SettingsTab; label: string }[] = [
	{ id: "plex", label: "Plex Connection" },
	{ id: "ai", label: "AI Configuration" },
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
	<div className={tabBar}>
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

const TabContent = ({ tab }: { tab: SettingsTab }) => {
	if (tab === "plex") {
		return <PlexTab />;
	}
	if (tab === "ai") {
		return <AiTab />;
	}
	if (tab === "account") {
		return <AccountTab />;
	}
	return <IntegrationsTab />;
};

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
