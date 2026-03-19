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
import { settingsApi } from "../api";
import { App } from "../App";
import { createStore } from "../store";

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

const renderApp = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(settingsApi.util.resetApiState());
	});

	return render(
		<Provider store={testStore}>
			<App />
		</Provider>,
	);
};

describe("App", () => {
	test("shows loading state while fetching", () => {
		server.use(
			http.get("/api/settings", async () => {
				await delay("infinite");
				return HttpResponse.json({});
			}),
		);

		renderApp();

		expect(screen.getByText(/Loading/)).toBeInTheDocument();
	});

	test("shows error state when API returns an error", async () => {
		const errorStatusCode = 500;
		server.use(
			http.get("/api/settings", () => HttpResponse.json(null, { status: errorStatusCode })),
		);

		renderApp();

		await waitFor(() => {
			expect(screen.getByText(/Error loading settings/)).toBeInTheDocument();
		});
	});

	test("renders settings as a list when data is available", async () => {
		server.use(
			http.get("/api/settings", () => HttpResponse.json({ app_version: "1.0.0", theme: "dark" })),
		);

		renderApp();

		await waitFor(() => {
			expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		});

		expect(screen.getByText("app_version")).toBeInTheDocument();
		expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
		expect(screen.getByText("theme")).toBeInTheDocument();
		expect(screen.getByText(/dark/)).toBeInTheDocument();
	});
});
