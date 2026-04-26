import { css } from "@linaria/atomic";
import { useRef, useState } from "react";

import { colors, radii, spacing } from "../theme.ts";
import { composeMessage } from "../utils/compose-message.ts";
import { FiltersPill } from "./FiltersPill.tsx";
import { FiltersPopover } from "./FiltersPopover.tsx";
import { GenresPill } from "./GenresPill.tsx";
import { GenreStrip } from "./GenreStrip.tsx";
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

	const togglePopover = () => {
		setOpenSurface((prev) => (prev === "popover" ? "none" : "popover"));
	};

	const toggleStrip = () => {
		setOpenSurface((prev) => (prev === "strip" ? "none" : "strip"));
	};

	const closeAll = () => {
		setOpenSurface("none");
	};

	const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setText(event.target.value);
	};

	const fireSend = (inc: readonly string[], exc: readonly string[]) => {
		const composed = composeMessage({ included: inc, excluded: exc, text });
		if (composed.length === EMPTY) {
			return;
		}
		onSend(composed);
		setText("");
		setIncluded([]);
		setExcluded([]);
	};

	const handleSendClick = () => {
		if (!canSend) {
			return;
		}
		fireSend(included, excluded);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSendClick();
		}
	};

	const handleStripApply = (newIncluded: string[], newExcluded: string[]) => {
		setIncluded(newIncluded);
		setExcluded(newExcluded);
		setOpenSurface("none");
	};

	const handleStripApplyAndSend = (newIncluded: string[], newExcluded: string[]) => {
		setIncluded(newIncluded);
		setExcluded(newExcluded);
		setOpenSurface("none");
		fireSend(newIncluded, newExcluded);
	};

	const handleQuickPrompt = (prompt: string) => {
		setText((prev) => (prev.length === EMPTY ? prompt : `${prev} ${prompt}`));
		textareaRef.current?.focus();
	};

	const handleRemoveGenre = (genre: string) => {
		setIncluded((prev) => prev.filter((genreInList) => genreInList !== genre));
		setExcluded((prev) => prev.filter((genreInList) => genreInList !== genre));
	};

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
