import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";
import { Login } from "../Login.tsx";

const renderLogin = (onLogin = vi.fn()) => {
	onTestFinished(() => {
		cleanup();
	});

	render(<Login onLogin={onLogin} />);
	return { onLogin };
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

	test("calls onLogin with correct credentials on submit", async () => {
		const { onLogin } = renderLogin();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/username/i), "admin");
		await user.type(screen.getByLabelText(/password/i), "password");
		await user.click(screen.getByRole("button", { name: /log in/i }));

		expect(onLogin).toHaveBeenCalledOnce();
		expect(onLogin).toHaveBeenCalledWith("admin", "password");
	});

	test("submit button is present and accessible", () => {
		renderLogin();

		const button = screen.getByRole("button", { name: /log in/i });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("type", "submit");
	});
});
