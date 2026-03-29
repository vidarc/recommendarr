import { css } from "@linaria/atomic";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	useAddToArrMutation,
	useArrLookupMutation,
	useLazyGetArrOptionsQuery,
} from "../features/arr/api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { ArrLookupResult, ArrOptions } from "../features/arr/api.ts";
import type { Recommendation } from "../shared/types.ts";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";

interface AddToArrModalProps {
	recommendation: Recommendation;
	serviceType: "radarr" | "sonarr";
	isOpen: boolean;
	onClose: () => void;
}

/* ── Constants ──────────────────────────────────────────────── */

const DISABLED_TAB_INDEX = -1;
const EMPTY_LENGTH = 0;

/* ── Styles ─────────────────────────────────────────────────── */

const overlayStyle = css`
	position: fixed;
	inset: 0;
	background: rgba(1, 22, 39, 0.85);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	padding: ${spacing.md};
`;

const cardStyle = css`
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.lg};
	width: 100%;
	max-width: 500px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
`;

const headerStyle = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: ${spacing.md} ${spacing.lg};
	border-bottom: 1px solid ${colors.border};
	flex-shrink: 0;
`;

const headerTitle = css`
	font-size: 1.1rem;
	font-weight: 600;
	color: ${colors.text};
`;

const closeButton = css`
	background: none;
	border: none;
	color: ${colors.textMuted};
	font-size: 1.2rem;
	cursor: pointer;
	padding: ${spacing.xs};
	line-height: 1;
	border-radius: ${radii.sm};
	transition: color 0.2s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const bodyStyle = css`
	padding: ${spacing.md} ${spacing.lg};
	overflow-y: auto;
	flex: 1;
`;

const loadingText = css`
	color: ${colors.textMuted};
	text-align: center;
	padding: ${spacing.xl} 0;
`;

const errorText = css`
	color: ${colors.red};
	font-size: 0.9rem;
	padding: ${spacing.sm} 0;
`;

const emptyText = css`
	color: ${colors.textMuted};
	text-align: center;
	padding: ${spacing.xl} 0;
`;

const resultButtonReset = css`
	all: unset;
	display: block;
	width: 100%;
	cursor: pointer;

	&:disabled {
		cursor: default;
	}
`;

const resultsList = css`
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
`;

const resultItemBase = css`
	padding: ${spacing.sm} ${spacing.md};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	cursor: pointer;
	transition:
		background 0.15s ease,
		border-color 0.15s ease;

	&:hover {
		background: ${colors.surfaceHover};
	}
`;

const resultItemSelected = css`
	background: rgba(127, 219, 202, 0.1);
	border-color: ${colors.accent};
`;

const resultItemDisabled = css`
	cursor: default;
	opacity: 0.7;

	&:hover {
		background: transparent;
	}
`;

const resultTitle = css`
	font-size: 0.95rem;
	font-weight: 600;
	color: ${colors.text};
`;

const resultMeta = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	margin-top: 2px;
`;

const resultYear = css`
	font-size: 0.82rem;
	color: ${colors.textMuted};
`;

const existsBadge = css`
	font-size: 0.72rem;
	font-weight: 600;
	color: ${colors.yellow};
	background: rgba(236, 196, 141, 0.15);
	padding: 1px ${spacing.xs};
	border-radius: ${radii.sm};
	text-transform: uppercase;
	letter-spacing: 0.4px;
`;

const resultOverview = css`
	font-size: 0.82rem;
	color: ${colors.textDim};
	margin-top: ${spacing.xs};
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
`;

const formStyle = css`
	margin-top: ${spacing.md};
	border-top: 1px solid ${colors.border};
	padding-top: ${spacing.md};
	display: flex;
	flex-direction: column;
	gap: ${spacing.md};
`;

const fieldGroup = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.xs};
`;

const labelStyle = css`
	font-size: 0.82rem;
	font-weight: 500;
	color: ${colors.textMuted};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const selectStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const addButton = css`
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.accent};
	color: ${colors.bg};
	border: none;
	border-radius: ${radii.sm};
	font-size: 0.95rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease;
	align-self: flex-end;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

/* ── Sub-components ─────────────────────────────────────────── */

interface ModalHeaderProps {
	title: string;
	onClose: () => void;
}

const ModalHeader = ({ title, onClose }: ModalHeaderProps) => (
	<div className={headerStyle}>
		<span id="arr-modal-title" className={headerTitle}>
			{title}
		</span>
		<button type="button" className={closeButton} onClick={onClose} aria-label="Close modal">
			✕
		</button>
	</div>
);

interface LookupResultItemProps {
	result: ArrLookupResult;
	isSelected: boolean;
	onSelect: (result: ArrLookupResult) => void;
}

const LookupResultItem = ({ result, isSelected, onSelect }: LookupResultItemProps) => {
	const handleClick = useCallback(() => {
		if (!result.existsInLibrary) {
			onSelect(result);
		}
	}, [result, onSelect]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			if (event.key === "Enter" || event.key === " ") {
				if (!result.existsInLibrary) {
					onSelect(result);
				}
			}
		},
		[result, onSelect],
	);

	const classNames = [
		resultItemBase,
		isSelected ? resultItemSelected : "",
		result.existsInLibrary ? resultItemDisabled : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<li className={classNames}>
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={result.existsInLibrary}
				aria-pressed={isSelected}
				className={resultButtonReset}
			>
				<LookupResultContent result={result} />
			</button>
		</li>
	);
};

const LookupResultContent = ({ result }: { result: ArrLookupResult }) => (
	<>
		<div className={resultTitle}>{result.title}</div>
		<div className={resultMeta}>
			<span className={resultYear}>{result.year}</span>
			{result.existsInLibrary ? <span className={existsBadge}>Already in library</span> : undefined}
		</div>
		{result.overview ? <p className={resultOverview}>{result.overview}</p> : undefined}
	</>
);

interface LookupResultsListProps {
	results: ArrLookupResult[];
	selectedResult: ArrLookupResult | undefined;
	onSelect: (result: ArrLookupResult) => void;
}

const LookupResultsList = ({ results, selectedResult, onSelect }: LookupResultsListProps) => (
	<ul className={resultsList} aria-label="Search results">
		{results.map((result) => (
			<LookupResultItem
				key={`${String(result.tmdbId ?? result.tvdbId ?? "")}-${result.title}-${String(result.year)}`}
				result={result}
				isSelected={selectedResult?.tmdbId === result.tmdbId}
				onSelect={onSelect}
			/>
		))}
	</ul>
);

interface RootFolderSelectProps {
	options: ArrOptions | undefined;
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}

const RootFolderSelect = ({ options, value, disabled, onChange }: RootFolderSelectProps) => {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.currentTarget.value);
		},
		[onChange],
	);

	return (
		<select
			id="root-folder-select"
			className={selectStyle}
			value={value}
			onChange={handleChange}
			disabled={disabled}
		>
			<option value="">Select a root folder…</option>
			{options?.rootFolders.map((folder) => (
				<option key={folder.id} value={folder.path}>
					{folder.path}
				</option>
			))}
		</select>
	);
};

interface QualityProfileSelectProps {
	options: ArrOptions | undefined;
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}

const QualityProfileSelect = ({
	options,
	value,
	disabled,
	onChange,
}: QualityProfileSelectProps) => {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.currentTarget.value);
		},
		[onChange],
	);

	return (
		<select
			id="quality-profile-select"
			className={selectStyle}
			value={value}
			onChange={handleChange}
			disabled={disabled}
		>
			<option value="">Select a quality profile…</option>
			{options?.qualityProfiles.map((profile) => (
				<option key={profile.id} value={String(profile.id)}>
					{profile.name}
				</option>
			))}
		</select>
	);
};

interface AddMediaFormProps {
	options: ArrOptions | undefined;
	isLoading: boolean;
	rootFolderPath: string;
	qualityProfileId: string;
	isAdding: boolean;
	addError: string | undefined;
	onRootFolderChange: (path: string) => void;
	onQualityProfileChange: (id: string) => void;
	onAdd: () => void;
}

const AddMediaForm = ({
	options,
	isLoading,
	rootFolderPath,
	qualityProfileId,
	isAdding,
	addError,
	onRootFolderChange,
	onQualityProfileChange,
	onAdd,
}: AddMediaFormProps) => (
	<div className={formStyle}>
		<div className={fieldGroup}>
			<label className={labelStyle} htmlFor="root-folder-select">
				Root Folder
			</label>
			<RootFolderSelect
				options={options}
				value={rootFolderPath}
				disabled={isLoading || isAdding}
				onChange={onRootFolderChange}
			/>
		</div>
		<div className={fieldGroup}>
			<label className={labelStyle} htmlFor="quality-profile-select">
				Quality Profile
			</label>
			<QualityProfileSelect
				options={options}
				value={qualityProfileId}
				disabled={isLoading || isAdding}
				onChange={onQualityProfileChange}
			/>
		</div>
		{addError ? <p className={errorText}>{addError}</p> : undefined}
		<button
			type="button"
			className={addButton}
			onClick={onAdd}
			disabled={isAdding || !rootFolderPath || !qualityProfileId}
		>
			{isAdding ? "Adding…" : "Add"}
		</button>
	</div>
);

/* ── Additional sub-components ─────────────────────────────────── */

interface ModalOverlayProps {
	onClose: () => void;
	children: React.ReactNode;
}

const ModalOverlay = ({ onClose, children }: ModalOverlayProps) => {
	const cardRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		cardRef.current?.focus();
	}, []);

	const handleOverlayClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (event.target === event.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	const handleOverlayKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<div
			className={overlayStyle}
			onClick={handleOverlayClick}
			onKeyDown={handleOverlayKeyDown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="arr-modal-title"
		>
			<div className={cardStyle} ref={cardRef} tabIndex={DISABLED_TAB_INDEX}>
				{children}
			</div>
		</div>
	);
};

interface ModalBodyProps {
	isLookingUp: boolean;
	lookupError: unknown;
	lookupResults: ArrLookupResult[] | undefined;
	selectedResult: ArrLookupResult | undefined;
	arrOptions: ArrOptions | undefined;
	isLoadingOptions: boolean;
	rootFolderPath: string;
	qualityProfileId: string;
	isAdding: boolean;
	addError: string | undefined;
	onSelectResult: (result: ArrLookupResult) => void;
	onRootFolderChange: (path: string) => void;
	onQualityProfileChange: (id: string) => void;
	onAdd: () => void;
}

const ModalBody = ({
	isLookingUp,
	lookupError,
	lookupResults,
	selectedResult,
	arrOptions,
	isLoadingOptions,
	rootFolderPath,
	qualityProfileId,
	isAdding,
	addError,
	onSelectResult,
	onRootFolderChange,
	onQualityProfileChange,
	onAdd,
}: ModalBodyProps) => {
	if (isLookingUp) {
		return <p className={loadingText}>Searching…</p>;
	}

	if (lookupError) {
		return <p className={errorText}>Search failed. Please try again.</p>;
	}

	if (!lookupResults || lookupResults.length === EMPTY_LENGTH) {
		return <p className={emptyText}>No matches found.</p>;
	}

	return (
		<>
			<LookupResultsList
				results={lookupResults}
				selectedResult={selectedResult}
				onSelect={onSelectResult}
			/>
			{selectedResult ? (
				<AddMediaForm
					options={arrOptions}
					isLoading={isLoadingOptions}
					rootFolderPath={rootFolderPath}
					qualityProfileId={qualityProfileId}
					isAdding={isAdding}
					addError={addError}
					onRootFolderChange={onRootFolderChange}
					onQualityProfileChange={onQualityProfileChange}
					onAdd={onAdd}
				/>
			) : undefined}
		</>
	);
};

/* ── Main component ─────────────────────────────────────────── */

const AddToArrModal = ({ recommendation, serviceType, isOpen, onClose }: AddToArrModalProps) => {
	const [selectedResult, setSelectedResult] = useState<ArrLookupResult | undefined>(undefined);
	const [rootFolderPath, setRootFolderPath] = useState("");
	const [qualityProfileId, setQualityProfileId] = useState("");
	const [addError, setAddError] = useState<string | undefined>(undefined);

	const [arrLookup, { data: lookupResults, isLoading: isLookingUp, error: lookupError }] =
		useArrLookupMutation();
	const [getArrOptions, { data: arrOptions, isLoading: isLoadingOptions }] =
		useLazyGetArrOptionsQuery();
	const [addToArr, { isLoading: isAdding }] = useAddToArrMutation();

	const resetState = useCallback(() => {
		setSelectedResult(undefined);
		setRootFolderPath("");
		setQualityProfileId("");
		setAddError(undefined);
	}, []);

	const handleClose = useCallback(() => {
		resetState();
		onClose();
	}, [resetState, onClose]);

	const handleSelectResult = useCallback(
		(result: ArrLookupResult) => {
			setSelectedResult(result);
			setRootFolderPath("");
			setQualityProfileId("");
			setAddError(undefined);
			void getArrOptions(serviceType);
		},
		[serviceType, getArrOptions],
	);

	const handleAdd = useCallback(async () => {
		if (!selectedResult || !rootFolderPath || !qualityProfileId) {
			return;
		}
		setAddError(undefined);

		const baseParams = {
			serviceType,
			recommendationId: recommendation.id,
			title: selectedResult.title,
			year: selectedResult.year,
			qualityProfileId: Number(qualityProfileId),
			rootFolderPath,
		};

		let params: typeof baseParams & { tmdbId?: number; tvdbId?: number } = baseParams;
		if (selectedResult.tmdbId !== undefined) {
			params = { ...baseParams, tmdbId: selectedResult.tmdbId };
		} else if (selectedResult.tvdbId !== undefined) {
			params = { ...baseParams, tvdbId: selectedResult.tvdbId };
		}

		const result = await addToArr(params);

		if ("error" in result) {
			setAddError("Failed to add to library. Please try again.");
		} else if (result.data.success) {
			handleClose();
		} else {
			setAddError(result.data.error ?? "Failed to add to library.");
		}
	}, [
		selectedResult,
		rootFolderPath,
		qualityProfileId,
		addToArr,
		serviceType,
		recommendation.id,
		handleClose,
	]);

	const handleAddVoid = useCallback(() => {
		void handleAdd();
	}, [handleAdd]);

	useEffect(() => {
		if (!isOpen) {
			resetState();
			return;
		}

		const lookupParams =
			recommendation.year !== undefined
				? { serviceType, title: recommendation.title, year: recommendation.year }
				: { serviceType, title: recommendation.title };

		void arrLookup(lookupParams);
	}, [isOpen, serviceType, recommendation.title, recommendation.year, arrLookup, resetState]);

	useEffect(() => {
		const handleKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				handleClose();
			}
		};
		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
		}
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, handleClose]);

	if (!isOpen) {
		return undefined;
	}

	const serviceName = serviceType === "radarr" ? "Radarr" : "Sonarr";

	return (
		<ModalOverlay onClose={handleClose}>
			<ModalHeader title={`Add to ${serviceName}`} onClose={handleClose} />
			<div className={bodyStyle}>
				<ModalBody
					isLookingUp={isLookingUp}
					lookupError={lookupError}
					lookupResults={lookupResults}
					selectedResult={selectedResult}
					arrOptions={arrOptions}
					isLoadingOptions={isLoadingOptions}
					rootFolderPath={rootFolderPath}
					qualityProfileId={qualityProfileId}
					isAdding={isAdding}
					addError={addError}
					onSelectResult={handleSelectResult}
					onRootFolderChange={setRootFolderPath}
					onQualityProfileChange={setQualityProfileId}
					onAdd={handleAddVoid}
				/>
			</div>
		</ModalOverlay>
	);
};

export { AddToArrModal };
