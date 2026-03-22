import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { ChatMessage } from "../ChatMessage.tsx";

const renderMessage = (content: string, role: string) => {
	onTestFinished(cleanup);
	render(<ChatMessage content={content} role={role} />);
};

describe("ChatMessage", () => {
	test("renders the message content", () => {
		renderMessage("Hello, recommend me some movies!", "user");

		expect(screen.getByText("Hello, recommend me some movies!")).toBeInTheDocument();
	});

	test("renders user message content", () => {
		renderMessage("I want action movies", "user");

		expect(screen.getByText("I want action movies")).toBeInTheDocument();
	});

	test("renders assistant message content", () => {
		renderMessage("Here are some great action movies for you.", "assistant");

		expect(screen.getByText("Here are some great action movies for you.")).toBeInTheDocument();
	});

	test("renders multiline content", () => {
		renderMessage("Line one\nLine two", "assistant");

		const elements = screen.getAllByText(
			(_content, node) => node?.textContent === "Line one\nLine two",
		);
		const atLeastOne = 1;
		expect(elements.length).toBeGreaterThanOrEqual(atLeastOne);
	});
});
