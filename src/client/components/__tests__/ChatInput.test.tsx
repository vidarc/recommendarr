import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { ChatInput } from "../ChatInput.tsx";

const renderInput = (isLoading = false) => {
	const onSend = vi.fn();

	onTestFinished(cleanup);

	render(<ChatInput onSend={onSend} isLoading={isLoading} />);

	return { onSend };
};

describe("ChatInput", () => {
	test("renders the text input with placeholder", () => {
		renderInput();

		expect(screen.getByPlaceholderText(/ask for recommendations/i)).toBeInTheDocument();
	});

	test("renders send button", () => {
		renderInput();

		expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
	});

	test("disables send button when input is empty", () => {
		renderInput();

		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
	});

	test("enables send button when text is entered", async () => {
		renderInput();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "hello");

		expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
	});

	test("calls onSend with trimmed text when send is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "  hello world  ");
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(onSend).toHaveBeenCalledWith("hello world");
	});

	test("clears input after sending", async () => {
		renderInput();
		const user = userEvent.setup();

		const input = screen.getByPlaceholderText(/ask for recommendations/i);
		await user.type(input, "test message");
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(input).toHaveValue("");
	});

	test("sends on Enter key press", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "enter test{enter}");

		expect(onSend).toHaveBeenCalledWith("enter test");
	});

	test("does not send on Shift+Enter", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(
			screen.getByPlaceholderText(/ask for recommendations/i),
			"line one{shift>}{enter}{/shift}",
		);

		expect(onSend).not.toHaveBeenCalled();
	});

	test("does not send empty or whitespace-only messages", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(screen.getByPlaceholderText(/ask for recommendations/i), "   {enter}");

		expect(onSend).not.toHaveBeenCalled();
	});

	test("disables input when isLoading is true", () => {
		renderInput(true);

		expect(screen.getByPlaceholderText(/ask for recommendations/i)).toBeDisabled();
	});

	test("shows thinking text when loading", () => {
		renderInput(true);

		expect(screen.getByRole("button", { name: /thinking/i })).toBeInTheDocument();
	});

	test("renders genre chips", () => {
		renderInput();

		expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "comedy" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "thriller" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "horror" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "sci-fi" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "drama" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "romance" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "documentary" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "animation" })).toBeInTheDocument();
	});

	test("renders suggestion chips", () => {
		renderInput();

		expect(screen.getByRole("button", { name: "more from this director" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "similar actors" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "this film style" })).toBeInTheDocument();
	});

	test("calls onSend when a genre chip is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "horror" }));

		expect(onSend).toHaveBeenCalledWith("horror");
	});

	test("calls onSend when a suggestion chip is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "similar actors" }));

		expect(onSend).toHaveBeenCalledWith("similar actors");
	});

	test("renders section labels", () => {
		renderInput();

		expect(screen.getByText("Genres")).toBeInTheDocument();
		expect(screen.getByText("Suggestions")).toBeInTheDocument();
	});
});
