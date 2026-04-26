import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { SelectedGenresRow } from "../SelectedGenresRow.tsx";

const EMPTY: readonly string[] = [];

interface RenderOptions {
	included?: readonly string[];
	excluded?: readonly string[];
}

const renderRow = ({ included = EMPTY, excluded = EMPTY }: RenderOptions = {}) => {
	const onRemove = vi.fn<(genre: string) => void>();
	onTestFinished(cleanup);
	const result = render(
		<SelectedGenresRow included={included} excluded={excluded} onRemove={onRemove} />,
	);
	return { onRemove, ...result };
};

describe(SelectedGenresRow, () => {
	it("renders nothing when no selections", () => {
		const { container } = renderRow();
		expect(container.firstChild).toBeNull();
	});

	it("renders included chips with include styling", () => {
		renderRow({ included: ["horror", "thriller"] });
		expect(screen.getByText("horror")).toBeInTheDocument();
		expect(screen.getByText("thriller")).toBeInTheDocument();
	});

	it("renders excluded chips", () => {
		renderRow({ excluded: ["comedy"] });
		expect(screen.getByText("comedy")).toBeInTheDocument();
	});

	it("calls onRemove with the chip's genre when × is clicked", async () => {
		const { onRemove } = renderRow({ included: ["horror"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /remove horror/i }));
		expect(onRemove).toHaveBeenCalledWith("horror");
	});

	it("works for excluded chip removal", async () => {
		const { onRemove } = renderRow({ excluded: ["comedy"] });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /remove comedy/i }));
		expect(onRemove).toHaveBeenCalledWith("comedy");
	});
});
