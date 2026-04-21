import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import { Router } from "wouter";

import { api } from "../api.ts";
import { App } from "../App.tsx";
import { createStore } from "../store.ts";

// Mock heavy page components to avoid Node 24 libuv crash
// When rendering large Linaria-styled components multiple times in happy-dom
vi.mock(import("../pages/Settings.tsx"), () => ({
	Settings: () => <div>Settings Mock</div>,
}));

vi.mock(import("../pages/Recommendations.tsx"), () => ({
	Recommendations: () => (
		<div>
			<h1>Recommendations</h1>
		</div>
	),
}));

const server = setupServer();

const setupStatusHandler = (needsSetup = false) =>
	http.get("/api/auth/setup-status", () => HttpResponse.json({ needsSetup }));

const meHandler = (authenticated = false) =>
	http.get("/api/auth/me", () => {
		if (authenticated) {
			return HttpResponse.json({
				id: "1",
				username: "testuser",
				isAdmin: false,
			});
		}
		const unauthorizedStatus = 401;
		return HttpResponse.json({ error: "Unauthorized" }, { status: unauthorizedStatus });
	});

const renderApp = (path = "/") => {
	const testStore = createStore();

	render(
		<Provider store={testStore}>
			<Router ssrPath={path}>
				<App />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

describe(App, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		cleanup();
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("redirects to login when not authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(false));
		onTestFinished(() => {
			store.dispatch(api.util.resetApiState());
		});

		const { store } = renderApp("/");

		const heading = await vi.waitFor(() => screen.getByRole("heading", { name: /login/i }));

		expect(heading).toBeInTheDocument();
	});

	it("redirects to register when setup is needed", async () => {
		server.use(setupStatusHandler(true), meHandler(false));
		onTestFinished(() => {
			store.dispatch(api.util.resetApiState());
		});

		const { store } = renderApp("/login");

		const heading = await vi.waitFor(() => screen.getByRole("heading", { name: /register/i }));

		expect(heading).toBeInTheDocument();
	});

	it("shows recommendations page when authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		onTestFinished(() => {
			store.dispatch(api.util.resetApiState());
		});

		const { store } = renderApp("/");

		const heading = await vi.waitFor(() =>
			screen.getByRole("heading", { name: /recommendations/i }),
		);

		expect(heading).toBeInTheDocument();
	});

	it("shows sidebar navigation when authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		onTestFinished(() => {
			store.dispatch(api.util.resetApiState());
		});

		const { store } = renderApp("/");

		await waitFor(() => {
			expect(screen.getByRole("navigation")).toBeInTheDocument();
		});
		const nav = screen.getByRole("navigation");
		expect(within(nav).getByRole("link", { name: /recommendations/i })).toBeInTheDocument();
		expect(within(nav).getByRole("link", { name: /history/i })).toBeInTheDocument();
		expect(within(nav).getByRole("link", { name: /settings/i })).toBeInTheDocument();
		expect(within(nav).getByRole("button", { name: /log out/i })).toBeInTheDocument();
	});

	it("redirects authenticated user away from login", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		onTestFinished(() => {
			store.dispatch(api.util.resetApiState());
		});

		const { store } = renderApp("/login");

		const navigation = await vi.waitFor(() => screen.getByRole("navigation"));

		expect(navigation).toBeInTheDocument();
	});
});
