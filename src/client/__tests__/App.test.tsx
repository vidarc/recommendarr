import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, test } from "vite-plus/test";
import { App } from "../App";
import { store } from "../store";

describe("The entry point component", () => {
	test("it should render as expected", () => {
		render(
			<Provider store={store}>
				<App />
			</Provider>,
		);

		expect(screen.getByText(/Loading/)).toBeInTheDocument();
	});
});
