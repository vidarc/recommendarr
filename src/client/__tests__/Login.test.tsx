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
import { Router } from "wouter";

import { api } from "../api.ts";
import { Login } from "../Login.tsx";
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

const renderLogin = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<Router ssrPath="/login">
				<Login />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

describe("Login", () => {
	test("renders the login form with heading, inputs, and button", () => {
		renderLogin();

		expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
	});

	test("allows typing into username and password fields", async () => {
		renderLogin();
		const user = userEvent.setup();

		const usernameInput = screen.getByLabelText(/username/i);
		const passwordInput = screen.getByLabelText(/password/i);

		await user.type(usernameInput, "testuser");
		await user.type(passwordInput, "secret123");

		expect(usernameInput).toHaveValue("testuser");
		expect(passwordInput).toHaveValue("secret123");
	});

	test("shows error message on failed login", async () => {
		const unauthorizedCode = 401;
		server.use(
			http.post("/api/auth/login", () =>
				HttpResponse.json({ error: "Invalid credentials" }, { status: unauthorizedCode }),
			),
		);

		renderLogin();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/username/i), "admin");
		await user.type(screen.getByLabelText(/password/i), "wrongpassword");
		await user.click(screen.getByRole("button", { name: /log in/i }));

		expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
	});

	test("submit button is present and accessible", () => {
		renderLogin();

		const button = screen.getByRole("button", { name: /log in/i });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("type", "submit");
	});
});
