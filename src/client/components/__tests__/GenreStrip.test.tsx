import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { GenreStrip } from "../GenreStrip.tsx";

const TOTAL_GENRES = 18;
const EMPTY: readonly string[] = [];

interface RenderOptions {
	committedIncluded?: readonly string[];
	committedExcluded?: readonly string[];
}

const renderStrip = ({
	committedIncluded = EMPTY,
	committedExcluded = EMPTY,
}: RenderOptions = {}) => {
	const onApply = vi.fn<(included: string[], excluded: string[]) => void>();
	const onApplyAndSend = vi.fn<(included: string[], excluded: string[]) => void>();
	const onQuickPrompt = vi.fn<(prompt: string) => void>();
	onTestFinished(cleanup);
	render(
		<GenreStrip
			committedIncluded={committedIncluded}
			committedExcluded={committedExcluded}
			onApply={onApply}
			onApplyAndSend={onApplyAndSend}
			onQuickPrompt={onQuickPrompt}
		/>,
	);
	return { onApply, onApplyAndSend, onQuickPrompt };
};

describe(GenreStrip, () => {
	it("renders 18 genre chips", () => {
		renderStrip();
		expect(
			screen.getAllByRole("button", {
				name: /^(action|adventure|animation|comedy|crime|documentary|drama|family|fantasy|history|horror|music|mystery|romance|sci-fi|thriller|war|western),/,
			}),
		).toHaveLength(TOTAL_GENRES);
	});

	it("cycles chip through unselected, included, excluded, unselected", async () => {
		renderStrip();
		const user = userEvent.setup();
		const chip = screen.getByRole("button", { name: /horror, not selected/i });

		await user.click(chip);
		expect(screen.getByRole("button", { name: /horror, currently included/i })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /horror, currently included/i }));
		expect(screen.getByRole("button", { name: /horror, currently excluded/i })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /horror, currently excluded/i }));
		expect(screen.getByRole("button", { name: /horror, not selected/i })).toBeInTheDocument();
	});

	it("seeds staged from committed on render", () => {
		renderStrip({ committedIncluded: ["horror"], committedExcluded: ["comedy"] });
		expect(screen.getByRole("button", { name: /horror, currently included/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /comedy, currently excluded/i })).toBeInTheDocument();
	});

	it("apply calls onApply with staged selections", async () => {
		const { onApply } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /apply$/i }));
		expect(onApply).toHaveBeenCalledWith(["horror"], []);
	});

	it("apply + send calls onApplyAndSend with staged selections", async () => {
		const { onApplyAndSend } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /apply \+ send/i }));
		expect(onApplyAndSend).toHaveBeenCalledWith(["thriller"], []);
	});

	it("clear resets staged selections without calling onApply", async () => {
		const { onApply } = renderStrip({ committedIncluded: ["horror"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /clear/i }));
		expect(screen.getByRole("button", { name: /horror, not selected/i })).toBeInTheDocument();
		expect(onApply).not.toHaveBeenCalled();
	});

	it("quick-prompt chip fires onQuickPrompt with the prompt text", async () => {
		const { onQuickPrompt } = renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "more from this director" }));
		expect(onQuickPrompt).toHaveBeenCalledWith("more from this director");
	});

	it("shows include and exclude counts in the footer", async () => {
		renderStrip();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /thriller, currently included/i }));
		expect(screen.getByText(/1 included/i)).toBeInTheDocument();
		expect(screen.getByText(/1 excluded/i)).toBeInTheDocument();
	});
});
