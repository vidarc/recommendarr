import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { Router } from "wouter";

import { api } from "../api.ts";
import { App } from "../App.tsx";
import { createStore } from "../store.ts";

// Mock heavy page components to avoid Node 24 libuv crash
// When rendering large Linaria-styled components multiple times in happy-dom
vi.mock("../pages/Settings.tsx", () => ({
	Settings: () => <div>Settings Mock</div>,
}));

vi.mock("../pages/Recommendations.tsx", () => ({
	Recommendations: () => (
		<div>
			<h1>Recommendations</h1>
		</div>
	),
}));

const server = setupServer();

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

const setupStatusHandler = (needsSetup = false) =>
	http.get("/api/auth/setup-status", () => HttpResponse.json({ needsSetup }));

const meHandler = (authenticated = false) =>
	http.get("/api/auth/me", () => {
		if (authenticated) {
			return HttpResponse.json({ id: "1", username: "testuser", isAdmin: false });
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

describe("App", () => {
	test("redirects to login when not authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(false));
		const { store } = renderApp("/");
		await waitFor(() => {
			expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
		});
		store.dispatch(api.util.resetApiState());
	});

	test("redirects to register when setup is needed", async () => {
		server.use(setupStatusHandler(true), meHandler(false));
		const { store } = renderApp("/login");
		await waitFor(() => {
			expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
		});
		store.dispatch(api.util.resetApiState());
	});

	test("shows recommendations page when authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		const { store } = renderApp("/");
		await waitFor(() => {
			expect(screen.getByRole("heading", { name: /recommendations/i })).toBeInTheDocument();
		});
		store.dispatch(api.util.resetApiState());
	});

	test("shows sidebar navigation when authenticated", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		const { store } = renderApp("/");
		await waitFor(() => {
			expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		});
		expect(screen.getByRole("navigation")).toBeInTheDocument();
		const navAndHeading = 2;
		expect(screen.getAllByText("Recommendations")).toHaveLength(navAndHeading);
		expect(screen.getByText("History")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Log out")).toBeInTheDocument();
		store.dispatch(api.util.resetApiState());
	});

	test("redirects authenticated user away from login", async () => {
		server.use(setupStatusHandler(), meHandler(true));
		const { store } = renderApp("/login");
		await waitFor(() => {
			expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		});
		store.dispatch(api.util.resetApiState());
	});
});
