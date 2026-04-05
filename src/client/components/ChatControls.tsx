import { css } from "@linaria/atomic";
import { useCallback } from "react";

import { useGetPlexLibrariesQuery } from "../features/plex/api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { ChangeEvent } from "react";

const controlsBar = css`
	display: flex;
	align-items: center;
	gap: ${spacing.md};
	padding: ${spacing.md};
	background: ${colors.surface};
	border-bottom: 1px solid ${colors.border};
	flex-wrap: wrap;
`;

const toggleGroup = css`
	display: flex;
	gap: 0;
`;

const toggleButtonBase = css`
	padding: ${spacing.xs} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.85rem;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:first-child {
		border-radius: ${radii.sm} 0 0 ${radii.sm};
	}

	&:last-child {
		border-radius: 0 ${radii.sm} ${radii.sm} 0;
	}

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const toggleButtonActive = css`
	background: ${colors.accent};
	color: ${colors.bg};
	border-color: ${colors.accent};

	&:hover {
		background: ${colors.accentHover};
		color: ${colors.bg};
	}
`;

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

const numberInput = css`
	width: 64px;
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 0.85rem;
	outline: none;
	text-align: center;

	&:focus {
		border-color: ${colors.borderFocus};
	}
`;

const controlLabel = css`
	font-size: 0.75rem;
	color: ${colors.textMuted};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const controlGroup = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
`;

const checkboxStyle = css`
	accent-color: ${colors.accent};
	cursor: pointer;
`;

const checkboxLabel = css`
	font-size: 0.85rem;
	color: ${colors.textMuted};
	cursor: pointer;
`;

const MEDIA_TYPES = [
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "TV Shows" },
	{ value: "any", label: "Either" },
] as const;

type MediaType = (typeof MEDIA_TYPES)[number]["value"];

interface MediaTypeToggleProps {
	value: MediaType;
	onChange: (value: MediaType) => void;
}

const MediaTypeToggle = ({ value, onChange }: MediaTypeToggleProps) => (
	<div className={toggleGroup}>
		{MEDIA_TYPES.map((item) => (
			<MediaTypeButton
				key={item.value}
				itemValue={item.value}
				label={item.label}
				isActive={value === item.value}
				onChange={onChange}
			/>
		))}
	</div>
);

interface MediaTypeButtonProps {
	itemValue: MediaType;
	label: string;
	isActive: boolean;
	onChange: (value: MediaType) => void;
}

const MediaTypeButton = ({ itemValue, label, isActive, onChange }: MediaTypeButtonProps) => {
	const handleClick = useCallback(() => {
		onChange(itemValue);
	}, [itemValue, onChange]);

	return (
		<button
			type="button"
			className={`${toggleButtonBase} ${isActive ? toggleButtonActive : ""}`}
			onClick={handleClick}
		>
			{label}
		</button>
	);
};

interface LibraryScopeSelectProps {
	value: string;
	onChange: (value: string) => void;
}

const LibraryScopeSelect = ({ value, onChange }: LibraryScopeSelectProps) => {
	const { data } = useGetPlexLibrariesQuery();
	const libraries = data?.libraries ?? [];

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<select className={selectStyle} value={value} onChange={handleChange}>
			<option value="">Whole library</option>
			{libraries.map((lib) => (
				<option key={lib.key} value={lib.key}>
					{lib.title}
				</option>
			))}
		</select>
	);
};

interface ExcludeLibraryCheckboxProps {
	checked: boolean;
	onChange: (value: boolean) => void;
}

const ExcludeLibraryCheckbox = ({ checked, onChange }: ExcludeLibraryCheckboxProps) => {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onChange(event.target.checked);
		},
		[onChange],
	);

	return (
		<label className={checkboxLabel}>
			<input type="checkbox" className={checkboxStyle} checked={checked} onChange={handleChange} />{" "}
			On
		</label>
	);
};

interface ChatControlsProps {
	mediaType: MediaType;
	onMediaTypeChange: (value: MediaType) => void;
	libraryId: string;
	onLibraryIdChange: (value: string) => void;
	resultCount: number;
	onResultCountChange: (value: number) => void;
	excludeLibrary: boolean;
	onExcludeLibraryChange: (value: boolean) => void;
}

const ChatControls = ({
	mediaType,
	onMediaTypeChange,
	libraryId,
	onLibraryIdChange,
	resultCount,
	onResultCountChange,
	excludeLibrary,
	onExcludeLibraryChange,
}: ChatControlsProps) => {
	const handleResultCountChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onResultCountChange(Number(event.target.value));
		},
		[onResultCountChange],
	);

	return (
		<div className={controlsBar}>
			<div className={controlGroup}>
				<span className={controlLabel}>Media Type</span>
				<MediaTypeToggle value={mediaType} onChange={onMediaTypeChange} />
			</div>
			<div className={controlGroup}>
				<span className={controlLabel}>Library</span>
				<LibraryScopeSelect value={libraryId} onChange={onLibraryIdChange} />
			</div>
			<div className={controlGroup}>
				<span className={controlLabel}>Results</span>
				<input
					type="number"
					min={1}
					max={50}
					value={resultCount}
					onChange={handleResultCountChange}
					className={numberInput}
				/>
			</div>
			<div className={controlGroup}>
				<span className={controlLabel}>Exclude Library</span>
				<ExcludeLibraryCheckbox checked={excludeLibrary} onChange={onExcludeLibraryChange} />
			</div>
		</div>
	);
};

export { ChatControls };
export type { MediaType };
