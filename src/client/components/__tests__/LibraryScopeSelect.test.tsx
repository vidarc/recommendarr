import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { store } from "../../store.ts";
import { LibraryScopeSelect } from "../LibraryScopeSelect.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () =>
		HttpResponse.json({
			libraries: [
				{ key: "1", title: "Movies", type: "movie" },
				{ key: "2", title: "TV Shows", type: "show" },
			],
		}),
	),
);

const renderSelect = (value = "") => {
	const onChange = vi.fn<(value: string) => void>();
	onTestFinished(cleanup);
	render(
		<Provider store={store}>
			<LibraryScopeSelect value={value} onChange={onChange} />
		</Provider>,
	);
	return { onChange };
};

describe(LibraryScopeSelect, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
		store.dispatch(api.util.resetApiState());
	});

	afterAll(() => {
		server.close();
	});

	it("renders 'Whole library' as the default option", async () => {
		renderSelect();
		await expect(
			screen.findByRole("option", { name: "Whole library" }),
		).resolves.toBeInTheDocument();
	});

	it("renders options from /api/plex/libraries", async () => {
		renderSelect();
		await expect(screen.findByRole("option", { name: "Movies" })).resolves.toBeInTheDocument();
		await expect(screen.findByRole("option", { name: "TV Shows" })).resolves.toBeInTheDocument();
	});

	it("calls onChange with the selected library key", async () => {
		const { onChange } = renderSelect();
		const user = userEvent.setup();
		await screen.findByRole("option", { name: "Movies" });
		await user.selectOptions(screen.getByRole("combobox"), "1");
		expect(onChange).toHaveBeenCalledWith("1");
	});
});
