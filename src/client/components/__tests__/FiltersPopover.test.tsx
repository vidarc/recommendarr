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
import { FiltersPopover } from "../FiltersPopover.tsx";

import type { MediaType } from "../FiltersPopover.tsx";

const AT_MIN = 1;
const JUST_ABOVE_MIN = 2;
const DEFAULT_COUNT = 5;
const JUST_BELOW_MAX = 19;
const AT_MAX = 20;

const server = setupServer(
	http.get("/api/plex/libraries", () => HttpResponse.json({ libraries: [] })),
);

interface RenderOptions {
	mediaType?: MediaType;
	resultCount?: number;
	excludeLibrary?: boolean;
	libraryId?: string;
}

const renderPopover = ({
	mediaType = "movie",
	resultCount = DEFAULT_COUNT,
	excludeLibrary = true,
	libraryId = "",
}: RenderOptions = {}) => {
	const onMediaTypeChange = vi.fn<(value: MediaType) => void>();
	const onResultCountChange = vi.fn<(value: number) => void>();
	const onExcludeLibraryChange = vi.fn<(value: boolean) => void>();
	const onLibraryIdChange = vi.fn<(value: string) => void>();
	const onClose = vi.fn<() => void>();

	onTestFinished(cleanup);

	render(
		<Provider store={store}>
			<FiltersPopover
				mediaType={mediaType}
				resultCount={resultCount}
				excludeLibrary={excludeLibrary}
				libraryId={libraryId}
				onMediaTypeChange={onMediaTypeChange}
				onResultCountChange={onResultCountChange}
				onExcludeLibraryChange={onExcludeLibraryChange}
				onLibraryIdChange={onLibraryIdChange}
				onClose={onClose}
			/>
		</Provider>,
	);

	return {
		onMediaTypeChange,
		onResultCountChange,
		onExcludeLibraryChange,
		onLibraryIdChange,
		onClose,
	};
};

describe(FiltersPopover, () => {
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

	it("renders media-type radiogroup with the current value marked", () => {
		renderPopover({ mediaType: "movie" });
		expect(screen.getByRole("radio", { name: "Movies" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "TV Shows" })).not.toBeChecked();
	});

	it("calls onMediaTypeChange when a different button is clicked", async () => {
		const { onMediaTypeChange } = renderPopover();
		const user = userEvent.setup();
		await user.click(screen.getByRole("radio", { name: "TV Shows" }));
		expect(onMediaTypeChange).toHaveBeenCalledWith("tv");
	});

	it("increments result count with + button, clamped at 20", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: JUST_BELOW_MAX });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /increase result count/i }));
		expect(onResultCountChange).toHaveBeenCalledWith(AT_MAX);
	});

	it("does not increment past 20", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: AT_MAX });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /increase result count/i }));
		expect(onResultCountChange).not.toHaveBeenCalled();
	});

	it("decrements result count with - button, clamped at 1", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: JUST_ABOVE_MIN });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /decrease result count/i }));
		expect(onResultCountChange).toHaveBeenCalledWith(AT_MIN);
	});

	it("does not decrement below 1", async () => {
		const { onResultCountChange } = renderPopover({ resultCount: AT_MIN });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /decrease result count/i }));
		expect(onResultCountChange).not.toHaveBeenCalled();
	});

	it("toggles exclude-watched switch", async () => {
		const { onExcludeLibraryChange } = renderPopover({ excludeLibrary: true });
		const user = userEvent.setup();
		await user.click(screen.getByRole("switch", { name: /exclude watched/i }));
		expect(onExcludeLibraryChange).toHaveBeenCalledWith(false);
	});

	it("calls onClose when Escape pressed", async () => {
		const { onClose } = renderPopover();
		const user = userEvent.setup();
		await user.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledWith();
	});

	it("calls onClose when close button clicked", async () => {
		const { onClose } = renderPopover();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /close filters/i }));
		expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ type: "click" }));
	});
});
