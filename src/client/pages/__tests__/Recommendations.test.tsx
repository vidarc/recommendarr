import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
} from "vite-plus/test";
import { Router } from "wouter";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { Recommendations } from "../Recommendations.tsx";

const server = setupServer(
	http.get("/api/plex/libraries", () =>
		HttpResponse.json({
			libraries: [
				{ key: "1", title: "Movies", type: "movie" },
				{ key: "2", title: "TV Shows", type: "show" },
			],
		}),
	),
	http.get("/api/library/status", () =>
		HttpResponse.json({
			lastSynced: undefined,
			interval: "manual",
			itemCount: 0,
			movieCount: 0,
			showCount: 0,
			excludeDefault: true,
		}),
	),
	http.get("/api/arr/config", () => HttpResponse.json([])),
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

const renderRecommendations = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<Router ssrPath="/">
				<Recommendations />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

describe("Recommendations", () => {
	test("renders the page header", () => {
		renderRecommendations();

		expect(screen.getByRole("heading", { name: /recommendations/i })).toBeInTheDocument();
	});

	test("renders new conversation button", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /new conversation/i })).toBeInTheDocument();
	});

	test("shows empty state message initially", () => {
		renderRecommendations();

		expect(screen.getByText(/send a message to get recommendations/i)).toBeInTheDocument();
	});

	test("renders media type toggle buttons", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /movies/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /tv shows/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /either/i })).toBeInTheDocument();
	});

	test("renders the message input", () => {
		renderRecommendations();

		expect(screen.getByPlaceholderText(/ask for recommendations/i)).toBeInTheDocument();
	});

	test("renders send button", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
	});

	test("disables send button when input is empty", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
	});

	test("enables send button when text is entered", async () => {
		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByPlaceholderText(/ask for recommendations/i),
			"suggest horror movies",
		);

		expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
	});

	test("shows user message after sending", async () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.post("/api/chat", () => new Promise(() => {})));

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByPlaceholderText(/ask for recommendations/i),
			"recommend action movies",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(screen.getByText("recommend action movies")).toBeInTheDocument();
	});

	test("shows thinking indicator while loading", async () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.post("/api/chat", () => new Promise(() => {})));

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "suggest something");
		await user.click(screen.getByRole("button", { name: /send/i }));

		const thinkingCount = 2;
		expect(screen.getAllByText("Thinking...")).toHaveLength(thinkingCount);
	});

	test("displays AI response after sending message", async () => {
		server.use(
			http.post("/api/chat", () =>
				HttpResponse.json({
					conversationId: "conv-1",
					message: {
						id: "msg-1",
						content: "Here are some great action movies:",
						role: "assistant",
						createdAt: new Date().toISOString(),
						recommendations: [
							{
								id: "rec-1",
								title: "Die Hard",
								year: 1988,
								mediaType: "movie",
								synopsis: "An NYPD officer battles terrorists.",
								addedToArr: false,
							},
						],
					},
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "action movies");
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(await screen.findByText("Here are some great action movies:")).toBeInTheDocument();
		expect(screen.getByText("Die Hard")).toBeInTheDocument();
	});

	test("clears messages on new conversation", async () => {
		server.use(
			http.post("/api/chat", () =>
				HttpResponse.json({
					conversationId: "conv-1",
					message: {
						id: "msg-1",
						content: "AI response",
						role: "assistant",
						createdAt: new Date().toISOString(),
						recommendations: [],
					},
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "test");
		await user.click(screen.getByRole("button", { name: /send/i }));

		await screen.findByText("AI response");

		await user.click(screen.getByRole("button", { name: /new conversation/i }));

		await waitFor(() => {
			expect(screen.getByText(/send a message to get recommendations/i)).toBeInTheDocument();
		});
	});

	test("renders genre chips", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "comedy" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "horror" })).toBeInTheDocument();
	});

	test("sends message when genre chip is clicked", async () => {
		// oxlint-disable-next-line init-declarations
		let sentBody: unknown;

		server.use(
			http.post("/api/chat", async ({ request }) => {
				sentBody = await request.json();
				// oxlint-disable-next-line promise/avoid-new
				return new Promise(() => {});
			}),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "horror" }));

		await waitFor(() => {
			expect(sentBody).toMatchObject({ message: "horror" });
		});
	});
});
