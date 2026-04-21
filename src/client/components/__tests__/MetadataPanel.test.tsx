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
	it,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { MetadataPanel } from "../MetadataPanel.tsx";

const BLADE_RUNNER_RATING = 7.5;

const availableMetadata = {
	available: true as const,
	externalId: 335_984,
	source: "tmdb" as const,
	title: "Blade Runner 2049",
	overview: "A young blade runner's discovery of a long-buried secret.",
	posterUrl: "https://image.tmdb.org/t/p/w500/blade.jpg",
	genres: ["Science Fiction", "Drama"],
	rating: BLADE_RUNNER_RATING,
	year: 2017,
	cast: [
		{ name: "Ryan Gosling", role: "Actor", character: "K" },
		{ name: "Harrison Ford", role: "Actor", character: "Rick Deckard" },
	],
	crew: [{ name: "Denis Villeneuve", role: "Director" }],
	status: "Released",
};

const server = setupServer();

const renderPanel = (metadataAvailable = true) => {
	const testStore = createStore();
	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});
	render(
		<Provider store={testStore}>
			<MetadataPanel recommendationId="rec-1" metadataAvailable={metadataAvailable} />
		</Provider>,
	);
};

describe(MetadataPanel, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders nothing when metadata is unavailable", () => {
		renderPanel(false);

		expect(screen.queryByRole("button", { name: /show more info/i })).not.toBeInTheDocument();
	});

	it("renders 'Show more info' button in collapsed state", () => {
		renderPanel();

		expect(screen.getByRole("button", { name: /show more info/i })).toBeInTheDocument();
	});

	it("fetches and displays metadata when expanded", async () => {
		server.use(
			http.get("/api/metadata/:recommendationId", () => HttpResponse.json(availableMetadata)),
		);
		renderPanel();

		await userEvent.click(screen.getByRole("button", { name: /show more info/i }));

		await expect(
			screen.findByText(/A young blade runner's discovery of a long-buried secret/i),
		).resolves.toBeInTheDocument();
		expect(screen.getByText("Science Fiction")).toBeInTheDocument();
		expect(screen.getByText("Drama")).toBeInTheDocument();
		expect(screen.getByText(/Rating: 7\.5 \| Released/)).toBeInTheDocument();
		expect(screen.getByRole("img", { name: /Blade Runner 2049 poster/i })).toHaveAttribute(
			"src",
			"https://image.tmdb.org/t/p/w500/blade.jpg",
		);
	});

	it("shows cast and crew when toggle is clicked", async () => {
		server.use(
			http.get("/api/metadata/:recommendationId", () => HttpResponse.json(availableMetadata)),
		);
		renderPanel();

		await userEvent.click(screen.getByRole("button", { name: /show more info/i }));
		await userEvent.click(await screen.findByRole("button", { name: /show cast & crew/i }));

		expect(screen.getByText(/Ryan Gosling/)).toBeInTheDocument();
		expect(screen.getByText(/as K/)).toBeInTheDocument();
		expect(screen.getByText(/Harrison Ford/)).toBeInTheDocument();
		expect(screen.getByText(/Denis Villeneuve \(Director\)/)).toBeInTheDocument();
	});

	it("renders empty-state message when API reports available: false", async () => {
		server.use(
			http.get("/api/metadata/:recommendationId", () => HttpResponse.json({ available: false })),
		);
		renderPanel();

		await userEvent.click(screen.getByRole("button", { name: /show more info/i }));

		await expect(screen.findByText(/No additional info available/i)).resolves.toBeInTheDocument();
	});

	it("renders empty-state message when upstream provider returns 502", async () => {
		server.use(
			http.get("/api/metadata/:recommendationId", () =>
				HttpResponse.json({ error: "Metadata provider unavailable" }, { status: 502 }),
			),
		);
		renderPanel();

		await userEvent.click(screen.getByRole("button", { name: /show more info/i }));

		await expect(screen.findByText(/No additional info available/i)).resolves.toBeInTheDocument();
	});
});
