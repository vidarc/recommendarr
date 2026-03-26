import { cleanup, render, screen } from "@testing-library/react";
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
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { RecommendationCard } from "../RecommendationCard.tsx";

import type { Recommendation } from "../../api.ts";

const movieYear = 1988;

const baseRecommendation: Recommendation = {
	id: "rec-1",
	title: "Die Hard",
	year: movieYear,
	mediaType: "movie",
	synopsis: "An NYPD officer battles terrorists in a skyscraper.",
	addedToArr: false,
};

const makeRecommendation = (overrides: Partial<Recommendation> = {}): Recommendation => ({
	...baseRecommendation,
	...overrides,
});

const server = setupServer(http.get("/api/arr/config", () => HttpResponse.json([])));

beforeAll(() => {
	server.listen();
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

const renderCard = (recommendation: Recommendation) => {
	const testStore = createStore();
	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});
	render(
		<Provider store={testStore}>
			<RecommendationCard recommendation={recommendation} />
		</Provider>,
	);
};

describe("RecommendationCard", () => {
	test("renders the recommendation title", () => {
		renderCard(baseRecommendation);

		expect(screen.getByText("Die Hard")).toBeInTheDocument();
	});

	test("renders the year in parentheses", () => {
		renderCard(baseRecommendation);

		expect(screen.getByText(`(${String(movieYear)})`)).toBeInTheDocument();
	});

	test("does not render year when not provided", () => {
		renderCard({ id: "rec-1", title: "Die Hard", mediaType: "movie", addedToArr: false });

		expect(screen.queryByText(/\(\d{4}\)/u)).not.toBeInTheDocument();
	});

	test("renders synopsis text", () => {
		renderCard(baseRecommendation);

		expect(
			screen.getByText("An NYPD officer battles terrorists in a skyscraper."),
		).toBeInTheDocument();
	});

	test("does not render synopsis when not provided", () => {
		renderCard({ id: "rec-1", title: "Die Hard", mediaType: "movie", addedToArr: false });

		expect(
			screen.queryByText("An NYPD officer battles terrorists in a skyscraper."),
		).not.toBeInTheDocument();
	});

	test("renders Movie badge for movie type", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByText("Movie")).toBeInTheDocument();
	});

	test("renders TV badge for tv type", () => {
		renderCard(makeRecommendation({ mediaType: "tv" }));

		expect(screen.getByText("TV")).toBeInTheDocument();
	});

	test("renders add to Radarr button for movies", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByRole("button", { name: /add to radarr/i })).toBeInTheDocument();
	});

	test("renders add to Sonarr button for TV shows", () => {
		renderCard(makeRecommendation({ mediaType: "tv" }));

		expect(screen.getByRole("button", { name: /add to sonarr/i })).toBeInTheDocument();
	});

	test("arr button is disabled when service is NOT connected", () => {
		renderCard(baseRecommendation);

		expect(screen.getByRole("button", { name: /add to radarr/i })).toBeDisabled();
	});

	test("arr button has tooltip mentioning settings", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByRole("button", { name: /add to radarr/i })).toHaveAttribute(
			"title",
			expect.stringContaining("Settings"),
		);
	});

	test("arr button is enabled when service is connected", async () => {
		server.use(
			http.get("/api/arr/config", () =>
				HttpResponse.json([
					{ id: "1", serviceType: "radarr", url: "http://localhost:7878", apiKey: "****1234" },
				]),
			),
		);

		renderCard(makeRecommendation({ mediaType: "movie" }));

		const button = await screen.findByRole("button", { name: /add to radarr/i });
		expect(button).not.toBeDisabled();
	});

	test('shows "Added" badge when addedToArr is true', () => {
		renderCard(makeRecommendation({ addedToArr: true }));

		expect(screen.getByText(/added to radarr/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /add to radarr/i })).not.toBeInTheDocument();
	});
});
