import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { colors, radii, spacing } from "../theme.ts";

import type { ChangeEvent, KeyboardEvent } from "react";

const inputWrapper = css`
	border-top: 1px solid ${colors.border};
	background: ${colors.surface};
	padding: ${spacing.md};
	display: flex;
	flex-direction: column;
	gap: ${spacing.sm};
`;

const chipRow = css`
	display: flex;
	gap: ${spacing.xs};
	flex-wrap: wrap;
`;

const chipButton = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.8rem;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover {
		background: ${colors.surfaceHover};
		color: ${colors.text};
	}
`;

const inputRow = css`
	display: flex;
	gap: ${spacing.sm};
`;

const textInput = css`
	flex: 1;
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
	transition: background 0.2s ease;

	&:hover:not(:disabled) {
		background: ${colors.accentHover};
	}

	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const sectionLabel = css`
	font-size: 0.7rem;
	color: ${colors.textDim};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const GENRES = [
	"action",
	"comedy",
	"thriller",
	"horror",
	"sci-fi",
	"drama",
	"romance",
	"documentary",
	"animation",
] as const;

const PROMPTS = ["more from this director", "similar actors", "this film style"] as const;

interface ChipProps {
	label: string;
	onSend: (message: string) => void;
}

const Chip = ({ label, onSend }: ChipProps) => {
	const handleClick = useCallback(() => {
		onSend(label);
	}, [label, onSend]);

	return (
		<button type="button" className={chipButton} onClick={handleClick}>
			{label}
		</button>
	);
};

interface ChatInputProps {
	onSend: (message: string) => void;
	isLoading: boolean;
}

const GenreChips = ({ onSend }: { onSend: (message: string) => void }) => (
	<div className={chipRow}>
		{GENRES.map((genre) => (
			<Chip key={genre} label={genre} onSend={onSend} />
		))}
	</div>
);

const PromptChips = ({ onSend }: { onSend: (message: string) => void }) => (
	<div className={chipRow}>
		{PROMPTS.map((prompt) => (
			<Chip key={prompt} label={prompt} onSend={onSend} />
		))}
	</div>
);

const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
	const [text, setText] = useState("");

	const handleSubmit = useCallback(() => {
		const trimmed = text.trim();
		if (trimmed) {
			onSend(trimmed);
			setText("");
		}
	}, [text, onSend]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				handleSubmit();
			}
		},
		[handleSubmit],
	);

	const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setText(event.target.value);
	}, []);

	const handleChipSend = useCallback(
		(message: string) => {
			onSend(message);
		},
		[onSend],
	);

	return (
		<div className={inputWrapper}>
			<span className={sectionLabel}>Genres</span>
			<GenreChips onSend={handleChipSend} />
			<span className={sectionLabel}>Suggestions</span>
			<PromptChips onSend={handleChipSend} />
			<MessageInputRow
				text={text}
				isLoading={isLoading}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onSubmit={handleSubmit}
			/>
		</div>
	);
};

interface MessageInputRowProps {
	text: string;
	isLoading: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onKeyDown: (event: KeyboardEvent) => void;
	onSubmit: () => void;
}

const MessageInputRow = ({
	text,
	isLoading,
	onChange,
	onKeyDown,
	onSubmit,
}: MessageInputRowProps) => (
	<div className={inputRow}>
		<input
			type="text"
			aria-label="Ask for recommendations"
			placeholder="Ask for recommendations..."
			value={text}
			onChange={onChange}
			onKeyDown={onKeyDown}
			disabled={isLoading}
			className={textInput}
		/>
		<button
			type="button"
			className={sendButton}
			onClick={onSubmit}
			disabled={isLoading || !text.trim()}
		>
			{isLoading ? "Thinking..." : "Send"}
		</button>
	</div>
);

export { ChatInput };
