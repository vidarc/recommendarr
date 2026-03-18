import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { App } from "../App";

describe("The entry point component", () => {
	test("it should render as expected", () => {
		render(<App />);

		expect(screen.getByText(/Hello World/)).toBeInTheDocument();
	});
});
