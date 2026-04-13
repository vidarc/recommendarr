import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
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
	http.get("/api/metadata/status", () => HttpResponse.json({ tvdb: false, tmdb: false })),
);

beforeAll(() => {
	server.listen();
});

beforeEach(() => {
	globalThis.history.replaceState({}, "", "/");
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

	test("hydrates messages from ?conversation=<id> URL param", async () => {
		globalThis.history.replaceState({}, "", "/?conversation=conv-42");
		server.use(
			http.get("/api/conversations/conv-42", () =>
				HttpResponse.json({
					id: "conv-42",
					mediaType: "movie",
					title: "Past chat",
					createdAt: new Date().toISOString(),
					messages: [
						{
							id: "msg-past-1",
							content: "earlier user prompt",
							role: "user",
							createdAt: new Date().toISOString(),
							recommendations: [],
						},
						{
							id: "msg-past-2",
							content: "earlier assistant reply",
							role: "assistant",
							createdAt: new Date().toISOString(),
							recommendations: [],
						},
					],
				}),
			),
		);

		renderRecommendations();

		expect(await screen.findByText("earlier user prompt")).toBeInTheDocument();
		expect(screen.getByText("earlier assistant reply")).toBeInTheDocument();
	});

	test("pushes ?conversation=<newId> to the URL after first send", async () => {
		server.use(
			http.post("/api/chat", () =>
				HttpResponse.json({
					conversationId: "conv-new",
					message: {
						id: "msg-1",
						content: "Fresh reply",
						role: "assistant",
						createdAt: new Date().toISOString(),
						recommendations: [],
					},
				}),
			),
			http.get("/api/conversations/conv-new", () =>
				HttpResponse.json({
					id: "conv-new",
					mediaType: "movie",
					title: "new",
					createdAt: new Date().toISOString(),
					messages: [],
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "first message");
		await user.click(screen.getByRole("button", { name: /send/i }));

		await screen.findByText("Fresh reply");
		await waitFor(() => {
			expect(globalThis.location.search).toBe("?conversation=conv-new");
		});
	});

	test("resets URL to / when new conversation is clicked", async () => {
		globalThis.history.replaceState({}, "", "/?conversation=conv-42");
		server.use(
			http.get("/api/conversations/conv-42", () =>
				HttpResponse.json({
					id: "conv-42",
					mediaType: "movie",
					title: "Past chat",
					createdAt: new Date().toISOString(),
					messages: [],
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: /new conversation/i }));

		await waitFor(() => {
			expect(globalThis.location.search).toBe("");
		});
		expect(globalThis.location.pathname).toBe("/");
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
