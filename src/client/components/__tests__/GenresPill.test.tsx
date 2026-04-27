import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { GenresPill } from "../GenresPill.tsx";

interface RenderOptions {
	includedCount?: number;
	excludedCount?: number;
	expanded?: boolean;
}

const ZERO = 0;
const includedThree = 3;
const excludedOne = 1;
const includedTwo = 2;

const renderPill = ({
	includedCount = ZERO,
	excludedCount = ZERO,
	expanded = false,
}: RenderOptions = {}) => {
	const onClick = vi.fn<() => void>();
	onTestFinished(cleanup);
	render(
		<GenresPill
			includedCount={includedCount}
			excludedCount={excludedCount}
			expanded={expanded}
			onClick={onClick}
		/>,
	);
	return { onClick };
};

describe(GenresPill, () => {
	it("shows '# Genres' when nothing is selected", () => {
		renderPill();
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("shows '# Genres (3·−1)' when selections exist", () => {
		renderPill({ includedCount: includedThree, excludedCount: excludedOne });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres (3·−1)");
	});

	it("shows only include count when no excludes", () => {
		renderPill({ includedCount: includedTwo, excludedCount: ZERO });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres (2·−0)");
	});

	it("calls onClick when clicked", async () => {
		const { onClick } = renderPill();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: "click" }));
	});

	it("reflects expanded state with aria-expanded", () => {
		renderPill({ expanded: true });
		expect(screen.getByRole("button", { name: /genres/i })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});
});
