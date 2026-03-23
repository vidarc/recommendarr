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
import { PlexTab } from "../PlexTab.tsx";

const notFoundStatus = 404;

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

const renderTab = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<PlexTab />
		</Provider>,
	);

	return { store: testStore };
};

describe("PlexTab", () => {
	test("shows loading state initially", () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.get("/api/plex/servers", () => new Promise(() => {})));

		renderTab();

		expect(screen.getByText(/loading plex connection status/i)).toBeInTheDocument();
	});

	test("shows connect button when not connected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({ error: "Not connected" }, { status: notFoundStatus }),
			),
		);

		renderTab();

		expect(await screen.findByRole("button", { name: /connect plex/i })).toBeInTheDocument();
	});

	test("shows connection description when not connected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({ error: "Not connected" }, { status: notFoundStatus }),
			),
		);

		renderTab();

		expect(
			await screen.findByText(/connect your plex account to get personalized recommendations/i),
		).toBeInTheDocument();
	});

	test("shows server selection when servers available but none selected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					servers: [
						{
							name: "My Plex Server",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "abc123",
							owned: false,
						},
					],
				}),
			),
		);

		renderTab();

		expect(await screen.findByText(/select plex server/i)).toBeInTheDocument();
		expect(screen.getByText("My Plex Server")).toBeInTheDocument();
	});

	test("shows connected state with server name when server is selected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					servers: [
						{
							name: "Home Server",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "abc123",
							owned: true,
						},
					],
				}),
			),
		);

		renderTab();

		expect(await screen.findByText("Home Server")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
	});

	test("calls disconnect when disconnect button is clicked", async () => {
		let disconnectCalled = false;

		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					servers: [
						{
							name: "Home Server",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "abc123",
							owned: true,
						},
					],
				}),
			),
			http.delete("/api/plex/connection", () => {
				disconnectCalled = true;
				return HttpResponse.json({ success: true });
			}),
		);

		renderTab();
		const user = userEvent.setup();

		const disconnectButton = await screen.findByRole("button", { name: /disconnect/i });
		await user.click(disconnectButton);

		expect(disconnectCalled).toBe(true);
	});

	test("allows selecting a server from the dropdown", async () => {
		// oxlint-disable-next-line init-declarations
		let selectedServer: unknown;

		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					servers: [
						{
							name: "Server A",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "server-a",
							owned: false,
						},
						{
							name: "Server B",
							address: "192.168.1.2",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.2:32400",
							clientIdentifier: "server-b",
							owned: false,
						},
					],
				}),
			),
			http.post("/api/plex/servers/select", async ({ request }) => {
				selectedServer = await request.json();
				return HttpResponse.json({ success: true });
			}),
		);

		renderTab();
		const user = userEvent.setup();

		const select = await screen.findByRole("combobox");
		await user.selectOptions(select, "server-b");

		expect(selectedServer).toStrictEqual({
			serverUrl: "http://192.168.1.2:32400",
			serverName: "Server B",
			machineIdentifier: "server-b",
		});
	});
});
