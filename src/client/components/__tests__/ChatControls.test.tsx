import { cleanup, render, screen, within } from "@testing-library/react";
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
	onTestFinished,
	it,
	vi,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { ChatControls } from "../ChatControls.tsx";

import type { MediaType } from "../ChatControls.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () =>
		HttpResponse.json({
			libraries: [
				{ key: "lib-1", title: "Movies", type: "movie" },
				{ key: "lib-2", title: "TV Shows", type: "show" },
			],
		}),
	),
);

const defaultResultCount = 10;

const renderControls = () => {
	const testStore = createStore();

	const onMediaTypeChange = vi.fn<(value: MediaType) => void>();
	const onLibraryIdChange = vi.fn<(value: string) => void>();
	const onResultCountChange = vi.fn<(value: number) => void>();
	const onExcludeLibraryChange = vi.fn<(value: boolean) => void>();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<ChatControls
				mediaType={"any" as MediaType}
				onMediaTypeChange={onMediaTypeChange}
				libraryId=""
				onLibraryIdChange={onLibraryIdChange}
				resultCount={defaultResultCount}
				onResultCountChange={onResultCountChange}
				excludeLibrary
				onExcludeLibraryChange={onExcludeLibraryChange}
			/>
		</Provider>,
	);

	return {
		onMediaTypeChange,
		onLibraryIdChange,
		onResultCountChange,
		onExcludeLibraryChange,
	};
};

describe(ChatControls, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders media type buttons", () => {
		renderControls();

		expect(screen.getByRole("radio", { name: /movies/i })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /tv shows/i })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /either/i })).toBeInTheDocument();
	});

	it("calls onMediaTypeChange when a media type button is clicked", async () => {
		const { onMediaTypeChange } = renderControls();
		const user = userEvent.setup();

		await user.click(screen.getByRole("radio", { name: /movies/i }));

		expect(onMediaTypeChange).toHaveBeenCalledWith("movie");
	});

	it("calls onMediaTypeChange with tv when TV Shows is clicked", async () => {
		const { onMediaTypeChange } = renderControls();
		const user = userEvent.setup();

		await user.click(screen.getByRole("radio", { name: /tv shows/i }));

		expect(onMediaTypeChange).toHaveBeenCalledWith("tv");
	});

	it("renders library select with loaded libraries", async () => {
		renderControls();

		const select = await screen.findByRole("combobox", { name: /library/i });
		const optionCount = 3;
		expect(within(select).getAllByRole("option")).toHaveLength(optionCount);
	});

	it("has whole library as default option", async () => {
		renderControls();

		const select = await screen.findByRole("combobox", { name: /library/i });
		expect(within(select).getByRole("option", { name: /whole library/i })).toBeInTheDocument();
	});

	it("calls onLibraryIdChange when a library is selected", async () => {
		const { onLibraryIdChange } = renderControls();
		const user = userEvent.setup();

		const select = await screen.findByRole("combobox", { name: /library/i });
		await user.selectOptions(select, "lib-1");

		expect(onLibraryIdChange).toHaveBeenCalledWith("lib-1");
	});

	it("renders result count input with default value", () => {
		renderControls();

		const input = screen.getByRole("spinbutton", { name: /results/i });
		expect(input).toHaveValue(defaultResultCount);
	});

	it("calls onResultCountChange when result count is changed", async () => {
		const { onResultCountChange } = renderControls();
		const user = userEvent.setup();

		const input = screen.getByRole("spinbutton", { name: /results/i });
		await user.clear(input);
		await user.type(input, "5");

		expect(onResultCountChange).toHaveBeenCalledWith(expect.any(Number));
	});

	it("renders labels for each control group", () => {
		renderControls();

		expect(screen.getByText("Media Type")).toBeInTheDocument();
		expect(screen.getByText("Library")).toBeInTheDocument();
		expect(screen.getByText("Results")).toBeInTheDocument();
	});
});
