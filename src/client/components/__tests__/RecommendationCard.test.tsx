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
	it,
} from "vite-plus/test";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { RecommendationCard } from "../RecommendationCard.tsx";

import type { Recommendation } from "@shared/schemas/chat";

const movieYear = 1988;

const baseRecommendation: Recommendation = {
	id: "rec-1",
	title: "Die Hard",
	year: movieYear,
	mediaType: "movie",
	synopsis: "An NYPD officer battles terrorists in a skyscraper.",
	addedToArr: false,
	feedback: undefined,
};

const makeRecommendation = (overrides: Partial<Recommendation> = {}): Recommendation => ({
	...baseRecommendation,
	...overrides,
});

const server = setupServer(
	http.get("/api/arr/config", () => HttpResponse.json([])),
	http.get("/api/metadata/status", () => HttpResponse.json({ tvdb: false, tmdb: false })),
	http.patch("/api/recommendations/:id/feedback", async ({ params }) =>
		HttpResponse.json({ id: params["id"], feedback: "liked" }),
	),
);

const renderCard = (recommendation: Recommendation) => {
	const testStore = createStore();
	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});
	render(
		<Provider store={testStore}>
			<RecommendationCard recommendation={recommendation} conversationId="test-conv-1" />
		</Provider>,
	);
};

describe(RecommendationCard, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders the recommendation title", () => {
		renderCard(baseRecommendation);

		expect(screen.getByText("Die Hard")).toBeInTheDocument();
	});

	it("renders the year in parentheses", () => {
		renderCard(baseRecommendation);

		expect(screen.getByText(`(${String(movieYear)})`)).toBeInTheDocument();
	});

	it("does not render year when not provided", () => {
		renderCard({
			id: "rec-1",
			title: "Die Hard",
			mediaType: "movie",
			addedToArr: false,
		});

		expect(screen.queryByText(/\(\d{4}\)/u)).not.toBeInTheDocument();
	});

	it("renders synopsis text", () => {
		renderCard(baseRecommendation);

		expect(
			screen.getByText("An NYPD officer battles terrorists in a skyscraper."),
		).toBeInTheDocument();
	});

	it("does not render synopsis when not provided", () => {
		renderCard({
			id: "rec-1",
			title: "Die Hard",
			mediaType: "movie",
			addedToArr: false,
		});

		expect(
			screen.queryByText("An NYPD officer battles terrorists in a skyscraper."),
		).not.toBeInTheDocument();
	});

	it("renders Movie badge for movie type", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByText("Movie")).toBeInTheDocument();
	});

	it("renders TV badge for tv type", () => {
		renderCard(makeRecommendation({ mediaType: "tv" }));

		expect(screen.getByText("TV")).toBeInTheDocument();
	});

	it("renders add to Radarr button for movies", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByRole("button", { name: /add to radarr/i })).toBeInTheDocument();
	});

	it("renders add to Sonarr button for TV shows", () => {
		renderCard(makeRecommendation({ mediaType: "tv" }));

		expect(screen.getByRole("button", { name: /add to sonarr/i })).toBeInTheDocument();
	});

	it("arr button is disabled when service is NOT connected", () => {
		renderCard(baseRecommendation);

		expect(screen.getByRole("button", { name: /add to radarr/i })).toBeDisabled();
	});

	it("arr button has tooltip mentioning settings", () => {
		renderCard(makeRecommendation({ mediaType: "movie" }));

		expect(screen.getByRole("button", { name: /add to radarr/i })).toHaveAttribute(
			"title",
			expect.stringContaining("Settings"),
		);
	});

	it("arr button is enabled when service is connected", async () => {
		server.use(
			http.get("/api/arr/config", () =>
				HttpResponse.json([
					{
						id: "1",
						serviceType: "radarr",
						url: "http://localhost:7878",
						apiKey: "****1234",
					},
				]),
			),
		);

		renderCard(makeRecommendation({ mediaType: "movie" }));

		const button = await screen.findByRole("button", {
			name: /add to radarr/i,
		});
		expect(button).not.toBeDisabled();
	});

	it('shows "Added" badge when addedToArr is true', () => {
		renderCard(makeRecommendation({ addedToArr: true }));

		expect(screen.getByText(/added to radarr/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /add to radarr/i })).not.toBeInTheDocument();
	});

	it("renders thumbs up and thumbs down buttons", () => {
		renderCard(baseRecommendation);

		expect(screen.getByRole("button", { name: /thumbs up/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /thumbs down/i })).toBeInTheDocument();
	});

	it("thumbs up button is highlighted when feedback is liked", () => {
		renderCard(makeRecommendation({ feedback: "liked" }));

		const thumbsUp = screen.getByRole("button", { name: /thumbs up/i });
		expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
	});

	it("thumbs down button is highlighted when feedback is disliked", () => {
		renderCard(makeRecommendation({ feedback: "disliked" }));

		const thumbsDown = screen.getByRole("button", { name: /thumbs down/i });
		expect(thumbsDown).toHaveAttribute("aria-pressed", "true");
	});

	it("neither button is pressed when feedback is undefined", () => {
		renderCard(makeRecommendation({ feedback: undefined }));

		expect(screen.getByRole("button", { name: /thumbs up/i })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		expect(screen.getByRole("button", { name: /thumbs down/i })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});
});
