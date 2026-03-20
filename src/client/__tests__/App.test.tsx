import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
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

import { api } from "../api.ts";
import { App } from "../App.tsx";
import { setUser } from "../auth-slice.ts";
import { createStore } from "../store.ts";

const server = setupServer();

beforeAll(() => {
	server.listen();
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

const setupStatusHandler = (needsSetup = false) =>
	http.get("/api/auth/setup-status", () => HttpResponse.json({ needsSetup }));

const renderApp = (path = "/") => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<Router ssrPath={path}>
				<App />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

const loginUser = (store: ReturnType<typeof createStore>) => {
	store.dispatch(setUser({ id: "1", username: "testuser", isAdmin: false }));
};

describe("App", () => {
	test("redirects to login when not authenticated", async () => {
		server.use(setupStatusHandler());

		renderApp("/");

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
		});
	});

	test("redirects to register when setup is needed", async () => {
		server.use(setupStatusHandler(true));

		renderApp("/login");

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
		});
	});

	test("shows loading state while fetching settings", async () => {
		server.use(
			setupStatusHandler(),
			http.get("/api/settings", async () => {
				await delay("infinite");
				return HttpResponse.json({});
			}),
		);

		const { store } = renderApp("/");
		loginUser(store);

		await waitFor(() => {
			expect(screen.getByText(/Loading/)).toBeInTheDocument();
		});
	});

	test("shows error state when settings API returns an error", async () => {
		const errorStatusCode = 500;
		server.use(
			setupStatusHandler(),
			http.get("/api/settings", () => HttpResponse.json(undefined, { status: errorStatusCode })),
		);

		const { store } = renderApp("/");
		loginUser(store);

		await waitFor(() => {
			expect(screen.getByText(/Error loading settings/)).toBeInTheDocument();
		});
	});

	test("renders settings as a list when authenticated", async () => {
		server.use(
			setupStatusHandler(),
			http.get("/api/settings", () => HttpResponse.json({ app_version: "1.0.0", theme: "dark" })),
		);

		const { store } = renderApp("/");
		loginUser(store);

		await waitFor(() => {
			expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		});

		expect(screen.getByText("app_version")).toBeInTheDocument();
		expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
		expect(screen.getByText("theme")).toBeInTheDocument();
		expect(screen.getByText(/dark/)).toBeInTheDocument();
	});
});
