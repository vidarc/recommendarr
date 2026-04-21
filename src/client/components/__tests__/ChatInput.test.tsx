import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, it, vi } from "vite-plus/test";

import { ChatInput } from "../ChatInput.tsx";

const renderInput = (isLoading = false) => {
	const onSend = vi.fn<(message: string) => void>();

	onTestFinished(cleanup);

	render(<ChatInput onSend={onSend} isLoading={isLoading} />);

	return { onSend };
};

describe(ChatInput, () => {
	it("renders the text input with placeholder", () => {
		renderInput();

		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeInTheDocument();
	});

	it("renders send button", () => {
		renderInput();

		expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
	});

	it("disables send button when input is empty", () => {
		renderInput();

		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
	});

	it("enables send button when text is entered", async () => {
		renderInput();
		const user = userEvent.setup();

		await user.type(screen.getByRole("textbox", { name: /ask for recommendations/i }), "hello");

		expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
	});

	it("calls onSend with trimmed text when send is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"  hello world  ",
		);
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(onSend).toHaveBeenCalledWith("hello world");
	});

	it("clears input after sending", async () => {
		renderInput();
		const user = userEvent.setup();

		const input = screen.getByRole("textbox", {
			name: /ask for recommendations/i,
		});
		await user.type(input, "test message");
		await user.click(screen.getByRole("button", { name: /send/i }));

		expect(input).toHaveValue("");
	});

	it("sends on Enter key press", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"enter test{enter}",
		);

		expect(onSend).toHaveBeenCalledWith("enter test");
	});

	it("does not send on Shift+Enter", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"line one{shift>}{enter}{/shift}",
		);

		expect(onSend).not.toHaveBeenCalled();
	});

	it("does not send empty or whitespace-only messages", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.type(
			screen.getByRole("textbox", { name: /ask for recommendations/i }),
			"   {enter}",
		);

		expect(onSend).not.toHaveBeenCalled();
	});

	it("disables input when isLoading is true", () => {
		renderInput(true);

		expect(screen.getByRole("textbox", { name: /ask for recommendations/i })).toBeDisabled();
	});

	it("shows thinking text when loading", () => {
		renderInput(true);

		expect(screen.getByRole("button", { name: /thinking/i })).toBeInTheDocument();
	});

	it("renders genre chips", () => {
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

	it("renders suggestion chips", () => {
		renderInput();

		expect(screen.getByRole("button", { name: "more from this director" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "similar actors" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "this film style" })).toBeInTheDocument();
	});

	it("calls onSend when a genre chip is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "horror" }));

		expect(onSend).toHaveBeenCalledWith("horror");
	});

	it("calls onSend when a suggestion chip is clicked", async () => {
		const { onSend } = renderInput();
		const user = userEvent.setup();

		await user.click(screen.getByRole("button", { name: "similar actors" }));

		expect(onSend).toHaveBeenCalledWith("similar actors");
	});

	it("renders section labels", () => {
		renderInput();

		expect(screen.getByText("Genres")).toBeInTheDocument();
		expect(screen.getByText("Suggestions")).toBeInTheDocument();
	});
});
