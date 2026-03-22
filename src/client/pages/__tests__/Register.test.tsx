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

import { api } from "../../api.ts";
import { createStore } from "../../store.ts";
import { Register } from "../Register.tsx";

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

const renderRegister = () => {
	const testStore = createStore();

	onTestFinished(() => {
		cleanup();
		testStore.dispatch(api.util.resetApiState());
	});

	render(
		<Provider store={testStore}>
			<Router ssrPath="/register">
				<Register />
			</Router>
		</Provider>,
	);

	return { store: testStore };
};

describe("Register", () => {
	test("renders the registration form with heading, inputs, and button", () => {
		renderRegister();

		expect(screen.getByRole("heading", { name: /register/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /register/i })).toBeInTheDocument();
	});

	test("allows typing into all fields", async () => {
		renderRegister();
		const user = userEvent.setup();

		const usernameInput = screen.getByLabelText(/^username$/i);
		const passwordInput = screen.getByLabelText(/^password$/i);
		const confirmInput = screen.getByLabelText(/confirm password/i);

		await user.type(usernameInput, "newuser");
		await user.type(passwordInput, "secret123");
		await user.type(confirmInput, "secret123");

		expect(usernameInput).toHaveValue("newuser");
		expect(passwordInput).toHaveValue("secret123");
		expect(confirmInput).toHaveValue("secret123");
	});

	test("shows validation error when passwords do not match", async () => {
		renderRegister();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/^username$/i), "newuser");
		await user.type(screen.getByLabelText(/^password$/i), "password1");
		await user.type(screen.getByLabelText(/confirm password/i), "password2");
		await user.click(screen.getByRole("button", { name: /register/i }));

		expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
	});

	test("shows error when username is already taken", async () => {
		const conflictStatus = 409;
		server.use(
			http.post("/api/auth/register", () =>
				HttpResponse.json({ error: "Username taken" }, { status: conflictStatus }),
			),
		);

		renderRegister();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/^username$/i), "existing");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /register/i }));

		expect(await screen.findByText(/username already taken/i)).toBeInTheDocument();
	});

	test("shows generic error on server failure", async () => {
		server.use(http.post("/api/auth/register", () => HttpResponse.error()));

		renderRegister();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/^username$/i), "newuser");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /register/i }));

		expect(await screen.findByText(/registration failed/i)).toBeInTheDocument();
	});

	test("submit button has correct type", () => {
		renderRegister();

		const button = screen.getByRole("button", { name: /register/i });
		expect(button).toHaveAttribute("type", "submit");
	});

	test("has link to login page", () => {
		renderRegister();

		expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
	});
});
