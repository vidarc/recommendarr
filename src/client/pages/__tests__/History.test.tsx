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
import { Router } from "wouter";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { History } from "../History.tsx";

const server = setupServer();

const renderHistory = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<Router ssrPath="/history">
				<History />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

describe(History, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders the history heading", () => {
		server.use(http.get("/api/conversations", () => HttpResponse.json({ conversations: [] })));

		renderHistory();

		expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
	});

	it("shows empty state when there are no conversations", async () => {
		server.use(http.get("/api/conversations", () => HttpResponse.json({ conversations: [] })));

		renderHistory();

		await expect(screen.findByText(/no conversations yet/i)).resolves.toBeInTheDocument();
	});

	it("renders conversation list", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "Horror recommendations",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
						{
							id: "conv-2",
							title: "Sci-fi TV shows",
							mediaType: "tv",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();

		await expect(screen.findByText("Horror recommendations")).resolves.toBeInTheDocument();
		expect(screen.getByText("Sci-fi TV shows")).toBeInTheDocument();
	});

	it("displays media type badge", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "My conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();

		await expect(screen.findByText("movie")).resolves.toBeInTheDocument();
	});

	it("displays relative date", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "Recent conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();

		await expect(screen.findByText("just now")).resolves.toBeInTheDocument();
	});

	it("shows untitled for conversations without a title", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();

		await expect(screen.findByText("Untitled")).resolves.toBeInTheDocument();
	});

	it("shows delete button for each conversation", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "Test conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();

		await expect(screen.findByRole("button", { name: /^delete$/i })).resolves.toBeInTheDocument();
	});

	it("shows confirm/cancel buttons when delete is clicked", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "Test conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();
		const user = userEvent.setup();

		const deleteButton = await screen.findByRole("button", {
			name: /^delete$/i,
		});
		await user.click(deleteButton);

		expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
	});

	it("cancels delete and goes back to single delete button", async () => {
		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-1",
							title: "Test conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
		);

		renderHistory();
		const user = userEvent.setup();

		const deleteButton = await screen.findByRole("button", {
			name: /^delete$/i,
		});
		await user.click(deleteButton);

		const cancelButton = screen.getByRole("button", { name: /^cancel$/i });
		await user.click(cancelButton);

		expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
	});

	it("sends delete request when confirmed", async () => {
		let deletedId = "";

		server.use(
			http.get("/api/conversations", () =>
				HttpResponse.json({
					conversations: [
						{
							id: "conv-42",
							title: "Doomed conversation",
							mediaType: "movie",
							createdAt: new Date().toISOString(),
						},
					],
				}),
			),
			http.delete("/api/conversations/:id", ({ params }) => {
				const { id } = params;
				deletedId = typeof id === "string" ? id : "";
				return HttpResponse.json({ success: true });
			}),
		);

		renderHistory();
		const user = userEvent.setup();

		const deleteButton = await screen.findByRole("button", {
			name: /^delete$/i,
		});
		await user.click(deleteButton);

		const [confirmButton] = screen.getAllByRole("button", {
			name: /^delete$/i,
		});
		await user.click(confirmButton!);

		expect(deletedId).toBe("conv-42");
	});
});
