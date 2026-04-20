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
	test,
} from "vite-plus/test";

import { api } from "../../../api.ts";
import { createStore } from "../../../store.ts";
import { AiTab } from "../AiTab.tsx";

const notFoundStatus = 404;

const server = setupServer(
	http.get("/api/ai/config", () =>
		HttpResponse.json({ error: "Not found" }, { status: notFoundStatus }),
	),
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

const renderTab = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<AiTab />
		</Provider>,
	);

	return { store: testStore };
};

describe("AiTab", () => {
	test("renders the AI configuration heading", () => {
		renderTab();

		expect(screen.getByRole("heading", { name: /ai configuration/i })).toBeInTheDocument();
	});

	test("renders endpoint, API key, and model name fields", () => {
		renderTab();

		expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/model name/i)).toBeInTheDocument();
	});

	test("renders save button", () => {
		renderTab();

		expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
	});

	test("allows typing in endpoint URL field", async () => {
		renderTab();
		const user = userEvent.setup();

		const input = screen.getByLabelText(/endpoint url/i);
		await user.type(input, "https://api.openai.com/v1");

		expect(input).toHaveValue("https://api.openai.com/v1");
	});

	test("allows typing in API key field", async () => {
		renderTab();
		const user = userEvent.setup();

		const input = screen.getByLabelText(/api key/i);
		await user.type(input, "sk-test123");

		expect(input).toHaveValue("sk-test123");
	});

	test("shows advanced settings when toggled", async () => {
		renderTab();
		const user = userEvent.setup();

		expect(screen.queryByLabelText(/temperature/i)).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /show advanced settings/i }));

		expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/max tokens/i)).toBeInTheDocument();
	});

	test("hides advanced settings when toggled back", async () => {
		renderTab();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: /show advanced settings/i }));
		expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /hide advanced settings/i }));
		expect(screen.queryByLabelText(/temperature/i)).not.toBeInTheDocument();
	});

	test("populates fields when config is loaded", async () => {
		const defaultTemperature = 0.8;
		const defaultMaxTokens = 2048;

		server.use(
			http.get("/api/ai/config", () =>
				HttpResponse.json({
					endpointUrl: "https://api.example.com",
					apiKey: "sk-masked",
					modelName: "gpt-4",
					temperature: defaultTemperature,
					maxTokens: defaultMaxTokens,
				}),
			),
		);

		renderTab();

		expect(await screen.findByDisplayValue("https://api.example.com")).toBeInTheDocument();
		expect(screen.getByDisplayValue("gpt-4")).toBeInTheDocument();
	});

	test("shows test and remove buttons when config exists", async () => {
		server.use(
			http.get("/api/ai/config", () =>
				HttpResponse.json({
					endpointUrl: "https://api.example.com",
					apiKey: "sk-masked",
					modelName: "gpt-4",
					temperature: 0.7,
					maxTokens: 4096,
				}),
			),
		);

		renderTab();

		expect(await screen.findByRole("button", { name: /test connection/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
	});

	test("shows success message after successful test", async () => {
		server.use(
			http.get("/api/ai/config", () =>
				HttpResponse.json({
					endpointUrl: "https://api.example.com",
					apiKey: "sk-masked",
					modelName: "gpt-4",
					temperature: 0.7,
					maxTokens: 4096,
				}),
			),
			http.post("/api/ai/test", () => HttpResponse.json({ success: true })),
		);

		renderTab();
		const user = userEvent.setup();

		const testButton = await screen.findByRole("button", { name: /test connection/i });
		await user.click(testButton);

		expect(await screen.findByText(/connection successful/i)).toBeInTheDocument();
	});

	test("shows error message after failed test", async () => {
		server.use(
			http.get("/api/ai/config", () =>
				HttpResponse.json({
					endpointUrl: "https://api.example.com",
					apiKey: "sk-masked",
					modelName: "gpt-4",
					temperature: 0.7,
					maxTokens: 4096,
				}),
			),
			http.post("/api/ai/test", () =>
				HttpResponse.json({ success: false, error: "Invalid API key" }),
			),
		);

		renderTab();
		const user = userEvent.setup();

		const testButton = await screen.findByRole("button", { name: /test connection/i });
		await user.click(testButton);

		expect(await screen.findByText(/invalid api key/i)).toBeInTheDocument();
	});
});
