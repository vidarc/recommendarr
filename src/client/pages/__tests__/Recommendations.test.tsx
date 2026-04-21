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
	it,
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

describe(Recommendations, () => {
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

	it("renders the default page header when no conversation is loaded", () => {
		renderRecommendations();

		expect(screen.getByRole("heading", { name: /new conversation/i })).toBeInTheDocument();
		expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
	});

	it("shows the conversation title once loaded", async () => {
		globalThis.history.replaceState({}, "", "/?conversation=conv-42");
		server.use(
			http.get("/api/conversations/conv-42", () =>
				HttpResponse.json({
					id: "conv-42",
					mediaType: "movie",
					title: "Sci-fi deep cuts",
					createdAt: new Date().toISOString(),
					messages: [],
				}),
			),
		);

		renderRecommendations();

		await expect(
			screen.findByRole("heading", { name: /sci-fi deep cuts/i }),
		).resolves.toBeInTheDocument();
	});

	it("renders the New button", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /^new$/i })).toBeInTheDocument();
	});

	it("renders media type toggle buttons", () => {
		renderRecommendations();

		expect(screen.getByRole("radio", { name: /movies/i })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /tv shows/i })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /either/i })).toBeInTheDocument();
	});

	it("renders the message input", () => {
		renderRecommendations();

		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeInTheDocument();
	});

	it("renders send button", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
	});

	it("disables send button when input is empty", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
	});

	it("enables send button when text is entered", async () => {
		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"suggest horror movies",
		);

		expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
	});

	it("shows user message after sending", async () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.post("/api/chat", () => new Promise(() => {})));

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"recommend action movies",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(screen.getByText("recommend action movies")).toBeInTheDocument();
	});

	it("shows loading indicator while waiting on a response", async () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.post("/api/chat", () => new Promise(() => {})));

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"suggest something",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
	});

	it("displays AI response after sending message", async () => {
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
			http.get("/api/conversations/conv-1", () =>
				HttpResponse.json({
					id: "conv-1",
					mediaType: "movie",
					title: "chat",
					createdAt: new Date().toISOString(),
					messages: [],
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"action movies",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		await expect(
			screen.findByText("Here are some great action movies:"),
		).resolves.toBeInTheDocument();
		expect(screen.getByText("Die Hard")).toBeInTheDocument();
	});

	it("clears messages on new conversation", async () => {
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
			http.get("/api/conversations/conv-1", () =>
				HttpResponse.json({
					id: "conv-1",
					mediaType: "movie",
					title: "chat",
					createdAt: new Date().toISOString(),
					messages: [],
				}),
			),
		);

		renderRecommendations();
		const user = userEvent.setup();

		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "test");
		await user.click(screen.getByRole("button", { name: /send/i }));

		await screen.findByText("AI response");

		await user.click(screen.getByRole("button", { name: /^new$/i }));

		await waitFor(() => {
			expect(screen.queryByText("AI response")).toBeNull();
		});
		expect(screen.getByRole("heading", { name: /new conversation/i })).toBeInTheDocument();
	});

	it("renders genre chips", () => {
		renderRecommendations();

		expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "comedy" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "horror" })).toBeInTheDocument();
	});

	it("hydrates messages from ?conversation=<id> URL param", async () => {
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

		await expect(screen.findByText("earlier user prompt")).resolves.toBeInTheDocument();
		expect(screen.getByText("earlier assistant reply")).toBeInTheDocument();
	});

	it("pushes ?conversation=<newId> to the URL after first send", async () => {
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

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"first message",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		await screen.findByText("Fresh reply");
		const search = await waitFor(() => {
			const current = globalThis.location.search;
			if (current !== "?conversation=conv-new") {
				throw new Error(`expected ?conversation=conv-new, got ${current}`);
			}
			return current;
		});
		expect(search).toBe("?conversation=conv-new");
	});

	it("resets URL to / when new conversation is clicked", async () => {
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

		await user.click(screen.getByRole("button", { name: /^new$/i }));

		await waitFor(() => {
			expect(globalThis.location.search).toBe("");
		});
		expect(globalThis.location.pathname).toBe("/");
	});

	it("sends message when genre chip is clicked", async () => {
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

		const body = await waitFor(() => {
			if (sentBody === undefined) {
				throw new Error("chat request not sent yet");
			}
			return sentBody;
		});
		expect(body).toMatchObject({ message: "horror" });
	});
});
