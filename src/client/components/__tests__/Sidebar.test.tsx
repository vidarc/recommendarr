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
	it,
	onTestFinished,
} from "vite-plus/test";
import { Router } from "wouter";

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { Sidebar } from "../Sidebar.tsx";

const server = setupServer(
	http.post("/api/auth/logout", () => HttpResponse.json({ success: true })),
);

const renderSidebar = (ssrPath: string) => {
	globalThis.history.replaceState({}, "", ssrPath);
	const store = createStore();
	onTestFinished(() => {
		cleanup();
		store.dispatch(api.util.resetApiState());
	});
	render(
		<Provider store={store}>
			<Router ssrPath={ssrPath}>
				<Sidebar />
			</Router>
		</Provider>,
	);
	return { store };
};

describe(Sidebar, () => {
	beforeAll(() => server.listen());

	afterEach(() => server.resetHandlers());

	afterAll(() => server.close());

	it("renders three nav links with accessible names", () => {
		renderSidebar("/");
		expect(screen.getByRole("link", { name: "Recommendations" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
	});

	it("sets aria-current on the active route", () => {
		renderSidebar("/history");
		const historyLink = screen.getByRole("link", { name: "History" });
		expect(historyLink.getAttribute("aria-current")).toBe("page");
		const recsLink = screen.getByRole("link", { name: "Recommendations" });
		expect(recsLink.getAttribute("aria-current")).not.toBe("page");
	});

	it("exposes data-tooltip on every nav link", () => {
		renderSidebar("/");
		const items: [string, string][] = [
			["Recommendations", "Recommendations"],
			["History", "History"],
			["Settings", "Settings"],
		];
		const tooltips = items.map(([name]) => {
			const link = screen.getByRole("link", { name });
			return link.getAttribute("data-tooltip");
		});
		expect(tooltips).toStrictEqual(items.map(([, tooltip]) => tooltip));
	});

	it("renders a logout button with accessible name", () => {
		renderSidebar("/");
		expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
	});

	it("clicking logout calls the logout endpoint", async () => {
		let called = false;
		server.use(
			http.post("/api/auth/logout", () => {
				called = true;
				return HttpResponse.json({ success: true });
			}),
		);
		renderSidebar("/");
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Log out" }));
		await waitFor(() => {
			expect(called).toBe(true);
		});
		expect(called).toBe(true);
	});
});
