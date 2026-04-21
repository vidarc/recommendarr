import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { Icon } from "../Icon.tsx";

const setup = () => {
	onTestFinished(cleanup);
};

describe(Icon, () => {
	it("renders an svg for the spark icon", () => {
		setup();
		const { container } = render(<Icon name="spark" />);
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("renders an svg for every supported name", () => {
		const names: ("spark" | "clock" | "settings" | "logout" | "plus")[] = [
			"spark",
			"clock",
			"settings",
			"logout",
			"plus",
		];
		expect(
			names.every((name) => {
				setup();
				const { container } = render(<Icon name={name} />);
				return container.querySelector("svg") !== null;
			}),
		).toBe(true);
	});

	it("renders nothing for an unknown name", () => {
		setup();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Testing runtime behavior with invalid input
		const { container } = render(<Icon name={"nope" as "spark"} />);
		expect(container.querySelector("svg")).toBeNull();
	});

	it("honours a custom size", () => {
		setup();
		const { container } = render(<Icon name="plus" size={24} />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("width")).toBe("24");
		expect(svg?.getAttribute("height")).toBe("24");
	});
});
