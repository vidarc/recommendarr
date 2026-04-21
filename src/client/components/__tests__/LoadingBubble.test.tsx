import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { LoadingBubble } from "../LoadingBubble.tsx";

const EXPECTED_DOT_COUNT = 3;

const setup = () => {
	onTestFinished(cleanup);
};

describe(LoadingBubble, () => {
	it("renders a status role with an accessible label", () => {
		setup();
		render(<LoadingBubble />);
		expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
	});

	it("renders three dot elements", () => {
		setup();
		const { container } = render(<LoadingBubble />);
		const dots = container.querySelectorAll('[data-testid="loading-dot"]');
		expect(dots).toHaveLength(EXPECTED_DOT_COUNT);
	});
});
