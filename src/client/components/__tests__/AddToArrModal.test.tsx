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
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { AddToArrModal } from "../AddToArrModal.tsx";

const mockRecommendation = {
	id: "rec-1",
	title: "Die Hard",
	year: 1988,
	mediaType: "movie",
	synopsis: "An NYPD officer tries to save his wife and several other hostages.",
	addedToArr: false,
};

const defaultLookupResults = [
	{
		title: "Die Hard",
		year: 1988,
		tmdbId: 562,
		overview: "An NYPD officer tries to save his wife and several other hostages.",
		existsInLibrary: false,
		arrId: 0,
	},
	{
		title: "Die Hard 2",
		year: 1990,
		tmdbId: 1573,
		overview: "John McClane attempts to avert disaster as terrorists seize Dulles Airport.",
		existsInLibrary: true,
		arrId: 42,
	},
];

const server = setupServer(
	http.post("/api/arr/lookup", () => HttpResponse.json(defaultLookupResults)),
	http.get("/api/arr/options/radarr", () =>
		HttpResponse.json({
			rootFolders: [{ id: 1, path: "/movies", freeSpace: 500_000_000 }],
			qualityProfiles: [{ id: 1, name: "HD-1080p" }],
		}),
	),
	http.post("/api/arr/add", () => HttpResponse.json({ success: true })),
);

interface RenderModalOptions {
	isOpen?: boolean;
	onClose?: () => void;
}

const renderModal = (options: RenderModalOptions = {}) => {
	const testStore = createStore();
	const { isOpen = true, onClose = () => undefined } = options;

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<AddToArrModal
				recommendation={mockRecommendation}
				serviceType="radarr"
				isOpen={isOpen}
				onClose={onClose}
			/>
		</Provider>,
	);

	return { testStore };
};

describe(AddToArrModal, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("shows loading state while lookup is in progress", async () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.post("/api/arr/lookup", () => new Promise(() => {})));

		renderModal();

		await expect(screen.findByText(/searching/i)).resolves.toBeInTheDocument();
	});

	it("displays lookup results after loading", async () => {
		renderModal();

		const results = await screen.findByRole("list", {
			name: /search results/i,
		});
		expect(within(results).getByText("Die Hard")).toBeInTheDocument();
		expect(within(results).getByText("Die Hard 2")).toBeInTheDocument();
	});

	it("shows Already in library badge for existing items", async () => {
		renderModal();

		await screen.findByRole("list", { name: /search results/i });
		expect(screen.getByText("Already in library")).toBeInTheDocument();
	});

	it("selecting a result shows root folder and quality profile dropdowns", async () => {
		renderModal();
		const user = userEvent.setup();

		await screen.findByRole("list", { name: /search results/i });

		const resultButton = screen.getByRole("button", {
			name: /Die Hard.*1988/i,
		});
		await user.click(resultButton);

		await expect(screen.findByLabelText(/root folder/i)).resolves.toBeInTheDocument();
		expect(screen.getByLabelText(/quality profile/i)).toBeInTheDocument();
	});

	it("disables selection of items already in library", async () => {
		renderModal();
		const user = userEvent.setup();

		await screen.findByRole("list", { name: /search results/i });

		const dieHard2Button = screen.getByRole("button", { name: /Die Hard 2/i });
		await user.click(dieHard2Button);

		expect(screen.queryByLabelText(/root folder/i)).not.toBeInTheDocument();
	});

	it("shows No matches found when lookup returns empty array", async () => {
		server.use(http.post("/api/arr/lookup", () => HttpResponse.json([])));

		renderModal();

		await expect(screen.findByText(/no matches found/i)).resolves.toBeInTheDocument();
	});

	it("shows error on lookup failure", async () => {
		server.use(
			http.post("/api/arr/lookup", () =>
				HttpResponse.json({ error: "Not found" }, { status: 500 }),
			),
		);

		renderModal();

		await expect(screen.findByText(/search failed/i)).resolves.toBeInTheDocument();
	});

	it("calls addToArr and closes on successful add", async () => {
		let isClosed = false;
		const handleClose = () => {
			isClosed = true;
		};

		renderModal({ onClose: handleClose });
		const user = userEvent.setup();

		await screen.findByRole("list", { name: /search results/i });
		await user.click(screen.getByRole("button", { name: /Die Hard.*1988/i }));

		const rootFolderSelect = await screen.findByLabelText(/root folder/i);
		await user.selectOptions(rootFolderSelect, "/movies");

		const qualitySelect = screen.getByLabelText(/quality profile/i);
		await user.selectOptions(qualitySelect, "HD-1080p");

		await user.click(screen.getByRole("button", { name: /^add$/i }));

		await screen.findByText(/adding/i).catch(() => undefined);

		expect(isClosed).toBe(true);
	});

	it("shows error on failed add and keeps modal open", async () => {
		server.use(
			http.post("/api/arr/add", () =>
				HttpResponse.json({ success: false, error: "Already exists" }),
			),
		);

		let isClosed = false;
		const handleClose = () => {
			isClosed = true;
		};

		renderModal({ onClose: handleClose });
		const user = userEvent.setup();

		await screen.findByRole("list", { name: /search results/i });
		await user.click(screen.getByRole("button", { name: /Die Hard.*1988/i }));

		const rootFolderSelect = await screen.findByLabelText(/root folder/i);
		await user.selectOptions(rootFolderSelect, "/movies");

		const qualitySelect = screen.getByLabelText(/quality profile/i);
		await user.selectOptions(qualitySelect, "HD-1080p");

		await user.click(screen.getByRole("button", { name: /^add$/i }));

		await expect(screen.findByText(/already exists/i)).resolves.toBeInTheDocument();
		expect(isClosed).toBe(false);
	});
});
