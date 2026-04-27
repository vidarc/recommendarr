const EMPTY = 0;

interface ComposeMessageArgs {
	included: readonly string[];
	excluded: readonly string[];
	text: string;
}

const composeMessage = ({ included, excluded, text }: ComposeMessageArgs): string => {
	const parts: string[] = [];
	if (included.length > EMPTY) {
		parts.push(`Include: ${included.join(", ")}.`);
	}
	if (excluded.length > EMPTY) {
		parts.push(`Exclude: ${excluded.join(", ")}.`);
	}
	const trimmed = text.trim();
	if (trimmed.length > EMPTY) {
		parts.push(trimmed);
	} else if (included.length > EMPTY || excluded.length > EMPTY) {
		parts.push("Give me recommendations.");
	}
	return parts.join(" ");
};

export { composeMessage };
