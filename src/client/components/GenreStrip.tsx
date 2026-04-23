import { css } from "@linaria/atomic";
import { useCallback, useState } from "react";

import { colors, radii, spacing } from "../theme.ts";

const GENRES = [
	"action",
	"adventure",
	"animation",
	"comedy",
	"crime",
	"documentary",
	"drama",
	"family",
	"fantasy",
	"history",
	"horror",
	"music",
	"mystery",
	"romance",
	"sci-fi",
	"thriller",
	"war",
	"western",
] as const;

type Genre = (typeof GENRES)[number];

const QUICK_PROMPTS = ["more from this director", "similar actors", "based on a novel"] as const;

type ChipState = "none" | "included" | "excluded";

const stripBox = css`
	display: flex;
	flex-direction: column;
	gap: ${spacing.md};
	padding: ${spacing.md};
	background: ${colors.surface};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
`;

const chipGrid = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
`;

const chipBase = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.md};
	color: ${colors.textMuted};
	font-size: 0.8rem;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		color 0.15s ease,
		background 0.15s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const chipIncluded = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};
`;

const chipExcluded = css`
	background: transparent;
	border-color: ${colors.red};
	color: ${colors.red};
	text-decoration: line-through;
`;

const quickPromptRow = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${spacing.xs};
	padding-top: ${spacing.xs};
	border-top: 1px solid ${colors.border};
`;

const footer = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: ${spacing.sm};
`;

const counts = css`
	font-size: 0.75rem;
	color: ${colors.textMuted};
`;

const footerActions = css`
	display: flex;
	gap: ${spacing.sm};
`;

const btn = css`
	padding: ${spacing.xs} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 0.85rem;
	cursor: pointer;

	&:hover {
		background: ${colors.surfaceHover};
	}
`;

const btnPrimary = css`
	background: ${colors.accent};
	border-color: ${colors.accent};
	color: ${colors.bg};

	&:hover {
		background: ${colors.accentHover};
	}
`;

const STATE_LABEL: Record<ChipState, string> = {
	none: "not selected",
	included: "currently included",
	excluded: "currently excluded",
};

const chipClassFor = (state: ChipState): string => {
	if (state === "included") {
		return `${chipBase} ${chipIncluded}`;
	}
	if (state === "excluded") {
		return `${chipBase} ${chipExcluded}`;
	}
	return chipBase;
};

const GENRE_SET: ReadonlySet<string> = new Set(GENRES);

const isGenre = (value: string): value is Genre => GENRE_SET.has(value);

const seedStaged = (
	committedIncluded: readonly string[],
	committedExcluded: readonly string[],
): Map<Genre, ChipState> => {
	const map = new Map<Genre, ChipState>();
	for (const value of committedIncluded) {
		if (isGenre(value)) {
			map.set(value, "included");
		}
	}
	for (const value of committedExcluded) {
		if (isGenre(value)) {
			map.set(value, "excluded");
		}
	}
	return map;
};

interface GenreChipProps {
	genre: Genre;
	state: ChipState;
	onCycle: (genre: Genre) => void;
}

const GenreChip = ({ genre, state, onCycle }: GenreChipProps) => {
	const handleClick = useCallback(() => {
		onCycle(genre);
	}, [genre, onCycle]);
	return (
		<button
			type="button"
			className={chipClassFor(state)}
			aria-label={`${genre}, ${STATE_LABEL[state]}`}
			onClick={handleClick}
		>
			{genre}
		</button>
	);
};

interface QuickPromptChipProps {
	prompt: string;
	onPick: (prompt: string) => void;
}

const QuickPromptChip = ({ prompt, onPick }: QuickPromptChipProps) => {
	const handleClick = useCallback(() => {
		onPick(prompt);
	}, [prompt, onPick]);
	return (
		<button type="button" className={chipBase} onClick={handleClick}>
			{prompt}
		</button>
	);
};

interface FooterActionsProps {
	onClear: () => void;
	onApply: () => void;
	onApplyAndSend: () => void;
}

const FooterActions = ({ onClear, onApply, onApplyAndSend }: FooterActionsProps) => (
	<div className={footerActions}>
		<button type="button" className={btn} onClick={onClear}>
			Clear
		</button>
		<button type="button" className={btn} onClick={onApply}>
			Apply
		</button>
		<button type="button" className={`${btn} ${btnPrimary}`} onClick={onApplyAndSend}>
			Apply + send
		</button>
	</div>
);

interface GenreStripProps {
	committedIncluded: readonly string[];
	committedExcluded: readonly string[];
	onApply: (included: string[], excluded: string[]) => void;
	onApplyAndSend: (included: string[], excluded: string[]) => void;
	onQuickPrompt: (prompt: string) => void;
}

const GenreStrip = ({
	committedIncluded,
	committedExcluded,
	onApply,
	onApplyAndSend,
	onQuickPrompt,
}: GenreStripProps) => {
	const [staged, setStaged] = useState<Map<Genre, ChipState>>(() =>
		seedStaged(committedIncluded, committedExcluded),
	);

	const cycle = useCallback((genre: Genre) => {
		setStaged((prev) => {
			const next = new Map(prev);
			const current = next.get(genre) ?? "none";
			if (current === "none") {
				next.set(genre, "included");
			} else if (current === "included") {
				next.set(genre, "excluded");
			} else {
				next.delete(genre);
			}
			return next;
		});
	}, []);

	const collect = useCallback((): { included: string[]; excluded: string[] } => {
		const included: string[] = [];
		const excluded: string[] = [];
		for (const [genre, state] of staged) {
			if (state === "included") {
				included.push(genre);
			} else if (state === "excluded") {
				excluded.push(genre);
			}
		}
		return { included, excluded };
	}, [staged]);

	const handleApply = useCallback(() => {
		const { included, excluded } = collect();
		onApply(included, excluded);
	}, [collect, onApply]);

	const handleApplyAndSend = useCallback(() => {
		const { included, excluded } = collect();
		onApplyAndSend(included, excluded);
	}, [collect, onApplyAndSend]);

	const handleClear = useCallback(() => {
		setStaged(new Map());
	}, []);

	const { included, excluded } = collect();

	return (
		<div className={stripBox} role="group" aria-label="Genre filter">
			<div className={chipGrid}>
				{GENRES.map((genre) => {
					const state = staged.get(genre) ?? "none";
					return <GenreChip key={genre} genre={genre} state={state} onCycle={cycle} />;
				})}
			</div>

			<div className={quickPromptRow}>
				{QUICK_PROMPTS.map((prompt) => (
					<QuickPromptChip key={prompt} prompt={prompt} onPick={onQuickPrompt} />
				))}
			</div>

			<div className={footer}>
				<span className={counts}>
					{included.length} included · {excluded.length} excluded
				</span>
				<FooterActions
					onClear={handleClear}
					onApply={handleApply}
					onApplyAndSend={handleApplyAndSend}
				/>
			</div>
		</div>
	);
};

export { GENRES, GenreStrip, QUICK_PROMPTS };
