import { css } from "@linaria/atomic";
import { useCallback, useRef } from "react";

import { useGetPlexLibrariesQuery } from "../features/plex/api.ts";
import { colors, radii, spacing } from "../theme.ts";
import { MEDIA_TYPES } from "./FiltersPopover.tsx";

import type { MediaType } from "./FiltersPopover.tsx";
import type { ChangeEvent, KeyboardEvent } from "react";

const NOT_FOUND = -1;
const STEP = 1;
const ACTIVE_TAB_INDEX = 0;
const MEDIA_TYPE_GROUP_LABEL_ID = "chat-controls-media-type-label";
const LIBRARY_SELECT_ID = "chat-controls-library-select";
const RESULT_COUNT_ID = "chat-controls-result-count";
const EXCLUDE_LIBRARY_ID = "chat-controls-exclude-library";

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

interface MediaTypeToggleProps {
	value: MediaType;
	onChange: (value: MediaType) => void;
}

const MediaTypeToggle = ({ value, onChange }: MediaTypeToggleProps) => {
	const buttonRefs = useRef(new Map());

	const registerRef = useCallback((mediaValue: MediaType, node: HTMLButtonElement | null) => {
		if (node) {
			buttonRefs.current.set(mediaValue, node);
		} else {
			buttonRefs.current.delete(mediaValue);
		}
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const currentIndex = MEDIA_TYPES.findIndex((item) => item.value === value);
			if (currentIndex === NOT_FOUND) {
				return;
			}
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
				onChange(nextValue);
				buttonRefs.current.get(nextValue)?.focus();
			}
		},
		[value, onChange],
	);

	return (
		<div
			role="radiogroup"
			aria-labelledby={MEDIA_TYPE_GROUP_LABEL_ID}
			className={toggleGroup}
			onKeyDown={handleKeyDown}
		>
			{MEDIA_TYPES.map((item) => (
				<MediaTypeButton
					key={item.value}
					itemValue={item.value}
					label={item.label}
					isActive={value === item.value}
					onChange={onChange}
					registerRef={registerRef}
				/>
			))}
		</div>
	);
};

interface MediaTypeButtonProps {
	itemValue: MediaType;
	label: string;
	isActive: boolean;
	onChange: (value: MediaType) => void;
	registerRef: (value: MediaType, node: HTMLButtonElement | null) => void;
}

const MediaTypeButton = ({
	itemValue,
	label,
	isActive,
	onChange,
	registerRef,
}: MediaTypeButtonProps) => {
	const handleClick = useCallback(() => {
		onChange(itemValue);
	}, [itemValue, onChange]);

	const handleRef = useCallback(
		(node: HTMLButtonElement | null) => {
			registerRef(itemValue, node);
		},
		[itemValue, registerRef],
	);

	return (
		<button
			ref={handleRef}
			type="button"
			role="radio"
			aria-checked={isActive}
			tabIndex={isActive ? ACTIVE_TAB_INDEX : NOT_FOUND}
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
		<select id={LIBRARY_SELECT_ID} className={selectStyle} value={value} onChange={handleChange}>
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
		<input
			id={EXCLUDE_LIBRARY_ID}
			type="checkbox"
			className={checkboxStyle}
			checked={checked}
			onChange={handleChange}
		/>
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
				<span id={MEDIA_TYPE_GROUP_LABEL_ID} className={controlLabel}>
					Media Type
				</span>
				<MediaTypeToggle value={mediaType} onChange={onMediaTypeChange} />
			</div>
			<div className={controlGroup}>
				<label htmlFor={LIBRARY_SELECT_ID} className={controlLabel}>
					Library
				</label>
				<LibraryScopeSelect value={libraryId} onChange={onLibraryIdChange} />
			</div>
			<div className={controlGroup}>
				<label htmlFor={RESULT_COUNT_ID} className={controlLabel}>
					Results
				</label>
				<input
					id={RESULT_COUNT_ID}
					type="number"
					min={1}
					max={50}
					value={resultCount}
					onChange={handleResultCountChange}
					className={numberInput}
				/>
			</div>
			<div className={controlGroup}>
				<label htmlFor={EXCLUDE_LIBRARY_ID} className={controlLabel}>
					Exclude Library
				</label>
				<ExcludeLibraryCheckbox checked={excludeLibrary} onChange={onExcludeLibraryChange} />
			</div>
		</div>
	);
};

export { ChatControls };
export type { MediaType };
