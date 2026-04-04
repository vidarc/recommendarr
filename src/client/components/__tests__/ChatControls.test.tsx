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
	onTestFinished,
	test,
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

beforeAll(() => {
	server.listen();
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

const defaultResultCount = 10;

const renderControls = () => {
	const testStore = createStore();

	const onMediaTypeChange = vi.fn();
	const onLibraryIdChange = vi.fn();
	const onResultCountChange = vi.fn();
	const onExcludeLibraryChange = vi.fn();

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

	return { onMediaTypeChange, onLibraryIdChange, onResultCountChange, onExcludeLibraryChange };
};

describe("ChatControls", () => {
	test("renders media type buttons", () => {
		renderControls();

		expect(screen.getByRole("button", { name: /movies/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /tv shows/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /either/i })).toBeInTheDocument();
	});

	test("calls onMediaTypeChange when a media type button is clicked", async () => {
		const { onMediaTypeChange } = renderControls();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: /movies/i }));

		expect(onMediaTypeChange).toHaveBeenCalledWith("movie");
	});

	test("calls onMediaTypeChange with tv when TV Shows is clicked", async () => {
		const { onMediaTypeChange } = renderControls();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: /tv shows/i }));

		expect(onMediaTypeChange).toHaveBeenCalledWith("tv");
	});

	test("renders library select with loaded libraries", async () => {
		renderControls();

		const select = await screen.findByRole("combobox");
		const optionCount = 3;
		expect(select.querySelectorAll("option")).toHaveLength(optionCount);
	});

	test("has whole library as default option", () => {
		renderControls();

		expect(screen.getByText("Whole library")).toBeInTheDocument();
	});

	test("calls onLibraryIdChange when a library is selected", async () => {
		const { onLibraryIdChange } = renderControls();
		const user = userEvent.setup();

		const select = await screen.findByRole("combobox");
		await user.selectOptions(select, "lib-1");

		expect(onLibraryIdChange).toHaveBeenCalledWith("lib-1");
	});

	test("renders result count input with default value", () => {
		renderControls();

		const input = screen.getByRole("spinbutton");
		expect(input).toHaveValue(defaultResultCount);
	});

	test("calls onResultCountChange when result count is changed", async () => {
		const { onResultCountChange } = renderControls();
		const user = userEvent.setup();

		const input = screen.getByRole("spinbutton");
		await user.clear(input);
		await user.type(input, "5");

		expect(onResultCountChange).toHaveBeenCalled();
	});

	test("renders labels for each control group", () => {
		renderControls();

		expect(screen.getByText("Media Type")).toBeInTheDocument();
		expect(screen.getByText("Library")).toBeInTheDocument();
		expect(screen.getByText("Results")).toBeInTheDocument();
	});
});
