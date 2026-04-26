import { css } from "@linaria/atomic";
import { useEffect, useRef } from "react";

import { colors, radii, spacing } from "../theme.ts";
import { LibraryScopeSelect } from "./LibraryScopeSelect.tsx";

import type { KeyboardEvent, RefObject } from "react";

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

const MEDIA_TYPE_LABEL_ID = "filters-popover-media-type-label";

type MediaTypeRefMap = Map<MediaType, HTMLButtonElement>;

interface MediaTypeButtonProps {
	item: (typeof MEDIA_TYPES)[number];
	isActive: boolean;
	onChange: (value: MediaType) => void;
	buttonRefs: RefObject<MediaTypeRefMap>;
}

const MediaTypeButton = ({ item, isActive, onChange, buttonRefs }: MediaTypeButtonProps) => {
	const handleClick = () => {
		onChange(item.value);
	};

	const handleRef = (node: HTMLButtonElement | null) => {
		if (node) {
			buttonRefs.current.set(item.value, node);
		} else {
			buttonRefs.current.delete(item.value);
		}
	};

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

interface MediaTypeGroupProps {
	mediaType: MediaType;
	onMediaTypeChange: (value: MediaType) => void;
}

const MediaTypeGroup = ({ mediaType, onMediaTypeChange }: MediaTypeGroupProps) => {
	const buttonRefs = useRef<MediaTypeRefMap>(new Map());

	const handleArrow = (event: KeyboardEvent<HTMLDivElement>) => {
		const currentIndex = MEDIA_TYPES.findIndex((item) => item.value === mediaType);
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
			onMediaTypeChange(nextValue);
			buttonRefs.current.get(nextValue)?.focus();
		}
	};

	return (
		<div className={row}>
			<span className={rowLabel} id={MEDIA_TYPE_LABEL_ID}>
				Media Type
			</span>
			<div
				role="radiogroup"
				aria-labelledby={MEDIA_TYPE_LABEL_ID}
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
	);
};

interface ResultsStepperProps {
	resultCount: number;
	onResultCountChange: (value: number) => void;
}

const ResultsStepper = ({ resultCount, onResultCountChange }: ResultsStepperProps) => {
	const handleDec = () => {
		if (resultCount > MIN_RESULTS) {
			onResultCountChange(resultCount - STEP);
		}
	};

	const handleInc = () => {
		if (resultCount < MAX_RESULTS) {
			onResultCountChange(resultCount + STEP);
		}
	};

	return (
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
	);
};

interface LibraryRowProps {
	libraryId: string;
	onLibraryIdChange: (value: string) => void;
}

const LibraryRow = ({ libraryId, onLibraryIdChange }: LibraryRowProps) => (
	<div className={row}>
		<span className={rowLabel}>Library</span>
		<LibraryScopeSelect value={libraryId} onChange={onLibraryIdChange} />
	</div>
);

interface ExcludeSwitchProps {
	excludeLibrary: boolean;
	onExcludeLibraryChange: (value: boolean) => void;
}

const ExcludeSwitch = ({ excludeLibrary, onExcludeLibraryChange }: ExcludeSwitchProps) => {
	const handleToggle = () => {
		onExcludeLibraryChange(!excludeLibrary);
	};

	return (
		<div className={switchRow}>
			<span className={rowLabel}>Exclude Watched</span>
			<button
				type="button"
				role="switch"
				aria-label="Exclude Watched"
				aria-checked={excludeLibrary}
				className={switchToggle}
				onClick={handleToggle}
			>
				<span className={switchKnob} />
			</button>
		</div>
	);
};

interface CloseRowProps {
	onClose: () => void;
}

const CloseRow = ({ onClose }: CloseRowProps) => (
	<div className={closeRow}>
		<button type="button" className={closeButton} onClick={onClose} aria-label="Close filters">
			Close
		</button>
	</div>
);

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
	useEffect(() => {
		const handleKey = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		globalThis.addEventListener("keydown", handleKey);
		return () => {
			globalThis.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	return (
		<div className={popoverBox} role="dialog" aria-label="Filters">
			<MediaTypeGroup mediaType={mediaType} onMediaTypeChange={onMediaTypeChange} />
			<ResultsStepper resultCount={resultCount} onResultCountChange={onResultCountChange} />
			<LibraryRow libraryId={libraryId} onLibraryIdChange={onLibraryIdChange} />
			<ExcludeSwitch
				excludeLibrary={excludeLibrary}
				onExcludeLibraryChange={onExcludeLibraryChange}
			/>
			<CloseRow onClose={onClose} />
		</div>
	);
};

export { FiltersPopover, MEDIA_TYPES };
export type { MediaType };
