import { css } from "@linaria/atomic";

import { useLibrarySettings } from "../../hooks/use-library-settings.ts";
import { colors, spacing } from "../../theme.ts";
import {
	buttonRow,
	fieldGroup,
	labelStyle,
	primaryButton,
	sectionCard,
	sectionTitle,
	secondaryButton,
	selectStyle,
	statusText,
	successText,
} from "./settings-styles.ts";

import type { ChangeEvent } from "react";

const checkboxRow = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	margin-bottom: ${spacing.md};
`;

const checkboxInput = css`
	width: 16px;
	height: 16px;
	accent-color: ${colors.accent};
	cursor: pointer;
`;

const checkboxLabel = css`
	font-size: 0.95rem;
	color: ${colors.text};
	cursor: pointer;
`;

const DEFAULT_COUNT = 0;

const INTERVAL_OPTIONS = [
	{ value: "manual", label: "Manual only" },
	{ value: "6h", label: "Every 6 hours" },
	{ value: "12h", label: "Every 12 hours" },
	{ value: "24h", label: "Every 24 hours" },
	{ value: "7d", label: "Weekly" },
];

/* ── Sub-components ────────────────────────────────────────── */

interface SyncStatusProps {
	lastSynced: string | undefined;
	movieCount: number;
	showCount: number;
}

const SyncStatus = ({ lastSynced, movieCount, showCount }: SyncStatusProps) => {
	if (!lastSynced) {
		return <p className={statusText}>Never synced</p>;
	}
	const timestamp = new Date(lastSynced).toLocaleString();
	return (
		<>
			<p className={statusText}>Last synced: {timestamp}</p>
			<p className={statusText}>
				{movieCount} movies, {showCount} shows cached
			</p>
		</>
	);
};

interface SyncButtonRowProps {
	isSyncing: boolean;
	onSync: () => void;
}

const SyncButtonRow = ({ isSyncing, onSync }: SyncButtonRowProps) => (
	<div className={buttonRow}>
		<button type="button" className={secondaryButton} onClick={onSync} disabled={isSyncing}>
			{isSyncing ? "Syncing..." : "Sync Now"}
		</button>
	</div>
);

interface IntervalSelectProps {
	interval: string;
	onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

const IntervalSelect = ({ interval, onChange }: IntervalSelectProps) => (
	<div className={fieldGroup}>
		<label htmlFor="sync-interval" className={labelStyle}>
			Auto-Refresh Interval
		</label>
		<select id="sync-interval" className={selectStyle} value={interval} onChange={onChange}>
			{INTERVAL_OPTIONS.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	</div>
);

interface ExcludeToggleProps {
	excludeDefault: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const ExcludeToggle = ({ excludeDefault, onChange }: ExcludeToggleProps) => (
	<div className={checkboxRow}>
		<input
			id="exclude-default"
			type="checkbox"
			className={checkboxInput}
			checked={excludeDefault}
			onChange={onChange}
		/>
		<label htmlFor="exclude-default" className={checkboxLabel}>
			Exclude library from recommendations
		</label>
	</div>
);

interface SaveButtonRowProps {
	isSaving: boolean;
	onSave: () => void;
}

const SaveButtonRow = ({ isSaving, onSave }: SaveButtonRowProps) => (
	<div className={buttonRow}>
		<button type="button" className={primaryButton} onClick={onSave} disabled={isSaving}>
			{isSaving ? "Saving..." : "Save"}
		</button>
	</div>
);

/* ── Main LibraryTab ───────────────────────────────────────── */

const LibraryTab = () => {
	const {
		status,
		interval,
		excludeDefault,
		syncResult,
		isSyncing,
		isSaving,
		handleIntervalChange,
		handleExcludeToggle,
		handleSync,
		handleSave,
	} = useLibrarySettings();

	return (
		<div>
			<div className={sectionCard}>
				<h3 className={sectionTitle}>Library Sync</h3>
				<SyncStatus
					lastSynced={status?.lastSynced}
					movieCount={status?.movieCount ?? DEFAULT_COUNT}
					showCount={status?.showCount ?? DEFAULT_COUNT}
				/>
				<SyncButtonRow isSyncing={isSyncing} onSync={handleSync} />
				{syncResult && <p className={successText}>{syncResult}</p>}
			</div>
			<div className={sectionCard}>
				<h3 className={sectionTitle}>Preferences</h3>
				<IntervalSelect interval={interval} onChange={handleIntervalChange} />
				<ExcludeToggle excludeDefault={excludeDefault} onChange={handleExcludeToggle} />
				<SaveButtonRow isSaving={isSaving} onSave={handleSave} />
			</div>
		</div>
	);
};

export { LibraryTab };
