import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { ChatMessage } from "../ChatMessage.tsx";

const renderMessage = (content: string, role: string) => {
	onTestFinished(cleanup);
	return render(<ChatMessage content={content} role={role} />);
};

describe(ChatMessage, () => {
	it("renders user message content inside a right-aligned bubble", () => {
		const { container } = renderMessage("Hello, recommend me some movies!", "user");
		expect(screen.getByText("Hello, recommend me some movies!")).toBeInTheDocument();
		const wrapper = container.firstChild;
		if (!(wrapper instanceof HTMLElement)) {
			throw new Error("wrapper must be HTMLElement");
		}
		expect(wrapper.getAttribute("data-role")).toBe("user");
	});

	it("renders assistant message with Recommendarr label and content", () => {
		renderMessage("Here are some great action movies for you.", "assistant");
		expect(screen.getByText("Recommendarr")).toBeInTheDocument();
		expect(screen.getByText("Here are some great action movies for you.")).toBeInTheDocument();
	});

	it("renders an accessible logo tile on assistant messages", () => {
		renderMessage("anything", "assistant");
		expect(screen.getByLabelText("Recommendarr")).toBeInTheDocument();
	});

	it("does not render the Recommendarr label on user messages", () => {
		renderMessage("my prompt", "user");
		expect(screen.queryByText("Recommendarr")).toBeNull();
	});

	it("renders multiline assistant content", () => {
		renderMessage("Line one\nLine two", "assistant");
		const elements = screen.getAllByText(
			(_content, node) => node?.textContent === "Line one\nLine two",
		);
		const atLeastOne = 1;
		expect(elements.length).toBeGreaterThanOrEqual(atLeastOne);
	});
});
