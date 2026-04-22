import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { FiltersPill } from "../FiltersPill.tsx";

import type { MediaType } from "../FiltersPopover.tsx";

interface RenderOptions {
	mediaType?: MediaType;
	resultCount?: number;
	expanded?: boolean;
}

const defaultResultCount = 5;

const renderPill = ({
	mediaType = "movie",
	resultCount = defaultResultCount,
	expanded = false,
}: RenderOptions = {}) => {
	const onClick = vi.fn<() => void>();
	onTestFinished(cleanup);
	render(
		<FiltersPill
			mediaType={mediaType}
			resultCount={resultCount}
			expanded={expanded}
			onClick={onClick}
		/>,
	);
	return { onClick };
};

describe(FiltersPill, () => {
	it("renders shorthand label for 'movie' media type", () => {
		const movieResultCount = 5;
		renderPill({ mediaType: "movie", resultCount: movieResultCount });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Films · 5");
	});

	it("renders shorthand label for 'tv'", () => {
		const tvResultCount = 8;
		renderPill({ mediaType: "tv", resultCount: tvResultCount });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Shows · 8");
	});

	it("renders shorthand label for 'any'", () => {
		const anyResultCount = 10;
		renderPill({ mediaType: "any", resultCount: anyResultCount });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveTextContent("Either · 10");
	});

	it("calls onClick when clicked", async () => {
		const { onClick } = renderPill();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /filters/i }));
		expect(onClick).toHaveBeenCalledWith();
	});

	it("reflects expanded state with aria-expanded", () => {
		renderPill({ expanded: true });
		expect(screen.getByRole("button", { name: /filters/i })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});
});
