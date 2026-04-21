import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { Logo } from "../Logo.tsx";

const setup = () => {
	onTestFinished(cleanup);
};

describe(Logo, () => {
	it("renders an outer tile at size 28", () => {
		setup();
		const { container } = render(<Logo size={28} />);
		const tile = container.firstChild;
		expect(tile).not.toBeNull();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		expect((tile as Element).getAttribute("aria-label")).toBe("Recommendarr");
	});

	it("renders an inner star svg at size 22", () => {
		setup();
		const { container } = render(<Logo size={22} />);
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute("width")).toBe("10");
		expect(svg?.getAttribute("height")).toBe("10");
	});

	it("renders inner svg at 14x14 for size 28", () => {
		setup();
		const { container } = render(<Logo size={28} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("14");
		expect(svg?.getAttribute("height")).toBe("14");
	});
});
