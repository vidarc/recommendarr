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

import { api } from "../../../api.ts";
import { createStore } from "../../../store.ts";
import { IntegrationsTab } from "../IntegrationsTab.tsx";

const EXPECTED_SAVE_BUTTON_COUNT = 2;

const server = setupServer(http.get("/api/arr/config", () => HttpResponse.json([])));

const renderTab = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<IntegrationsTab />
		</Provider>,
	);

	return { store: testStore };
};

describe(IntegrationsTab, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("renders Radarr and Sonarr section headings", () => {
		renderTab();

		expect(screen.getByRole("heading", { name: /^radarr$/i })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /^sonarr$/i })).toBeInTheDocument();
	});

	it("renders URL and API Key fields for both services", () => {
		renderTab();

		expect(screen.getByLabelText(/radarr url/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/radarr api key/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/sonarr url/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/sonarr api key/i)).toBeInTheDocument();
	});

	it("renders save buttons for both services", () => {
		renderTab();

		const saveButtons = screen.getAllByRole("button", { name: /save/i });
		expect(saveButtons).toHaveLength(EXPECTED_SAVE_BUTTON_COUNT);
	});

	it("allows typing in Radarr URL field", async () => {
		renderTab();
		const user = userEvent.setup();

		const input = screen.getByLabelText(/radarr url/i);
		await user.type(input, "http://localhost:7878");

		expect(input).toHaveValue("http://localhost:7878");
	});

	it("allows typing in Radarr API Key field", async () => {
		renderTab();
		const user = userEvent.setup();

		const input = screen.getByLabelText(/radarr api key/i);
		await user.type(input, "abc123");

		expect(input).toHaveValue("abc123");
	});

	it("populates fields when connections exist", async () => {
		server.use(
			http.get("/api/arr/config", () =>
				HttpResponse.json([
					{
						id: "1",
						serviceType: "radarr",
						url: "http://radarr.local",
						apiKey: "radarr-key",
					},
					{
						id: "2",
						serviceType: "sonarr",
						url: "http://sonarr.local",
						apiKey: "sonarr-key",
					},
				]),
			),
		);

		renderTab();

		await expect(screen.findByDisplayValue("http://radarr.local")).resolves.toBeInTheDocument();
		await expect(screen.findByDisplayValue("http://sonarr.local")).resolves.toBeInTheDocument();
	});

	it("shows test and remove buttons when connected", async () => {
		server.use(
			http.get("/api/arr/config", () =>
				HttpResponse.json([
					{
						id: "1",
						serviceType: "radarr",
						url: "http://radarr.local",
						apiKey: "radarr-key",
					},
				]),
			),
		);

		renderTab();

		await expect(
			screen.findByRole("button", { name: /test connection/i }),
		).resolves.toBeInTheDocument();
		expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
	});
});
