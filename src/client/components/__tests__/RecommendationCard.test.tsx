import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

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

const renderCard = (recommendation: Recommendation) => {
	onTestFinished(cleanup);
	render(<RecommendationCard recommendation={recommendation} />);
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

	test("arr button is disabled", () => {
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
});
