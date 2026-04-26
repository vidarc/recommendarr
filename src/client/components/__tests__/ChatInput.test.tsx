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

import { createStore } from "../../store.ts";
import { ChatInput } from "../ChatInput.tsx";

import type { MediaType } from "../FiltersPopover.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () => HttpResponse.json({ libraries: [] })),
);

const DEFAULT_RESULT_COUNT = 5;

interface RenderInputOptions {
	onSend?: (message: string) => void;
	isLoading?: boolean;
	mediaType?: MediaType;
	resultCount?: number;
	excludeLibrary?: boolean;
	libraryId?: string;
	onMediaTypeChange?: (value: MediaType) => void;
	onResultCountChange?: (value: number) => void;
	onExcludeLibraryChange?: (value: boolean) => void;
	onLibraryIdChange?: (value: string) => void;
}

const renderInput = (overrides: RenderInputOptions = {}) => {
	const onSend = overrides.onSend ?? vi.fn<(message: string) => void>();
	const onMediaTypeChange = overrides.onMediaTypeChange ?? vi.fn<(value: MediaType) => void>();
	const onResultCountChange = overrides.onResultCountChange ?? vi.fn<(value: number) => void>();
	const onExcludeLibraryChange =
		overrides.onExcludeLibraryChange ?? vi.fn<(value: boolean) => void>();
	const onLibraryIdChange = overrides.onLibraryIdChange ?? vi.fn<(value: string) => void>();

	const testStore = createStore();
	onTestFinished(cleanup);

	render(
		<Provider store={testStore}>
			<ChatInput
				onSend={onSend}
				isLoading={overrides.isLoading ?? false}
				mediaType={overrides.mediaType ?? "movie"}
				resultCount={overrides.resultCount ?? DEFAULT_RESULT_COUNT}
				excludeLibrary={overrides.excludeLibrary ?? true}
				libraryId={overrides.libraryId ?? ""}
				onMediaTypeChange={onMediaTypeChange}
				onResultCountChange={onResultCountChange}
				onExcludeLibraryChange={onExcludeLibraryChange}
				onLibraryIdChange={onLibraryIdChange}
			/>
		</Provider>,
	);
	return {
		onSend,
		onMediaTypeChange,
		onResultCountChange,
		onExcludeLibraryChange,
		onLibraryIdChange,
	};
};

describe(ChatInput, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders the textarea with accessible name", () => {
		renderInput();
		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeInTheDocument();
	});

	it("send button is disabled when empty and no genres", () => {
		renderInput();
		expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
	});

	it("send button enables with text", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "hi");
		expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
	});

	it("send composes included/excluded/text into one message", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		// Open the genre strip
		await user.click(screen.getByRole("button", { name: /genres/i }));
		// Stage include: thriller, exclude: comedy
		await user.click(screen.getByRole("button", { name: /thriller, not selected/i }));
		await user.click(screen.getByRole("button", { name: /comedy, not selected/i }));
		await user.click(screen.getByRole("button", { name: /comedy, currently included/i }));
		// Apply
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		// Type and send
		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "quiet");
		await user.click(screen.getByRole("button", { name: /^send$/i }));
		expect(onSend).toHaveBeenCalledWith("Include: thriller. Exclude: comedy. quiet");
	});

	it("apply + send commits and sends in one action", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"atmospheric",
		);
		await user.click(screen.getByRole("button", { name: /apply \+ send/i }));
		expect(onSend).toHaveBeenCalledWith("Include: horror. atmospheric");
	});

	it("clears text and committed genres after send", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "hello");
		await user.click(screen.getByRole("button", { name: /^send$/i }));
		expect(textarea).toHaveValue("");
		// GenresPill reflects cleared state
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("enter submits, Shift+Enter inserts newline", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "line 1{shift>}{enter}{/shift}line 2");
		expect(onSend).not.toHaveBeenCalled();
		await user.type(textarea, "{enter}");
		expect(onSend).toHaveBeenCalledWith("line 1\nline 2");
	});

	it("opening popover closes strip and vice versa", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		expect(screen.getByRole("group", { name: /genre filter/i })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /filters/i }));
		expect(screen.queryByRole("group", { name: /genre filter/i })).not.toBeInTheDocument();
		expect(screen.getByRole("dialog", { name: /filters/i })).toBeInTheDocument();
	});

	it("closing strip without apply discards staged selections", async () => {
		renderInput();
		const user = userEvent.setup();
		// Open strip, stage horror, click pill to close (cancel)
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /genres/i }));
		// Pill still shows no selections
		expect(screen.getByRole("button", { name: /genres/i })).toHaveTextContent("# Genres");
	});

	it("quick-prompt chip appends to textarea", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		const textarea = screen.getByRole("textbox", { name: /ask for recommendations/i });
		await user.type(textarea, "I want");
		await user.click(screen.getByRole("button", { name: "similar actors" }));
		expect(textarea).toHaveValue("I want similar actors");
	});

	it("selected-genres row shows committed chips and × removes them", async () => {
		renderInput();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /^apply$/i }));
		// Strip is closed; SelectedGenresRow shows "horror" with × button
		expect(screen.getByRole("button", { name: /remove horror/i })).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /remove horror/i }));
		expect(screen.queryByRole("button", { name: /remove horror/i })).not.toBeInTheDocument();
	});

	it("disables everything when isLoading", async () => {
		const { onSend } = renderInput({ isLoading: true });
		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();
		// Apply+send must not fire onSend while loading
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /genres/i }));
		await user.click(screen.getByRole("button", { name: /horror, not selected/i }));
		await user.click(screen.getByRole("button", { name: /apply \+ send/i }));
		expect(onSend).not.toHaveBeenCalled();
	});
});
