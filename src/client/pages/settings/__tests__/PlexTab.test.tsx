import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
import { PlexTab } from "../PlexTab.tsx";

const notFoundStatus = 404;

const server = setupServer();

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

describe(PlexTab, () => {
	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	it("shows loading state initially", () => {
		// oxlint-disable-next-line promise/avoid-new
		server.use(http.get("/api/plex/servers", () => new Promise(() => {})));

		renderTab();

		expect(screen.getByText(/loading plex connection status/i)).toBeInTheDocument();
	});

	it("shows connect button when not connected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({ error: "Not connected" }, { status: notFoundStatus }),
			),
		);

		renderTab();

		await expect(
			screen.findByRole("button", { name: /connect plex/i }),
		).resolves.toBeInTheDocument();
	});

	it("shows connection description when not connected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({ error: "Not connected" }, { status: notFoundStatus }),
			),
		);

		renderTab();

		await expect(
			screen.findByText(/connect your plex account to get personalized recommendations/i),
		).resolves.toBeInTheDocument();
	});

	it("shows server selection when multiple servers available but none selected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: false,
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
						{
							name: "Other Server",
							address: "192.168.1.2",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.2:32400",
							clientIdentifier: "def456",
							owned: false,
						},
					],
				}),
			),
		);

		renderTab();

		await expect(screen.findByText(/select plex server/i)).resolves.toBeInTheDocument();
		expect(screen.getByRole("option", { name: "My Plex Server" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Other Server" })).toBeInTheDocument();
	});

	it("auto-selects the only server when exactly one is available", async () => {
		// oxlint-disable-next-line init-declarations
		let selectedServer: unknown;
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: false,
					servers: [
						{
							name: "Only Server",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "only-server",
							owned: true,
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

		await screen.findByText(/connecting to only server/i);
		const body = await waitFor(() => {
			if (selectedServer === undefined) {
				throw new Error("server select request not sent yet");
			}
			return selectedServer;
		});
		expect(body).toStrictEqual({
			serverUrl: "http://192.168.1.1:32400",
			serverName: "Only Server",
			machineIdentifier: "only-server",
		});
	});

	it("falls back to dropdown with error when auto-select fails", async () => {
		const internalServerError = 500;
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: false,
					servers: [
						{
							name: "Flaky Server",
							address: "192.168.1.1",
							port: 32_400,
							scheme: "http",
							uri: "http://192.168.1.1:32400",
							clientIdentifier: "flaky",
							owned: true,
						},
					],
				}),
			),
			http.post("/api/plex/servers/select", () =>
				HttpResponse.json({ error: "boom" }, { status: internalServerError }),
			),
		);

		renderTab();

		await expect(
			screen.findByText(/failed to select server. please try again/i),
		).resolves.toBeInTheDocument();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
	});

	it("shows connected state with server name when server is selected", async () => {
		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: true,
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

		await expect(screen.findByText("Home Server")).resolves.toBeInTheDocument();
		expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
	});

	it("calls disconnect when disconnect button is clicked", async () => {
		let disconnectCalled = false;

		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: true,
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

		const disconnectButton = await screen.findByRole("button", {
			name: /disconnect/i,
		});
		await user.click(disconnectButton);

		expect(disconnectCalled).toBe(true);
	});

	it("allows selecting a server from the dropdown", async () => {
		// oxlint-disable-next-line init-declarations
		let selectedServer: unknown;

		server.use(
			http.get("/api/plex/servers", () =>
				HttpResponse.json({
					selected: false,
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
