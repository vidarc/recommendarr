import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { AccountTab } from "../AccountTab.tsx";

const renderTab = () => {
	onTestFinished(cleanup);
	render(<AccountTab />);
};

describe("AccountTab", () => {
	test("renders the change password heading", () => {
		renderTab();

		expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
	});

	test("shows coming soon badge", () => {
		renderTab();

		expect(screen.getByText("Coming Soon")).toBeInTheDocument();
	});

	test("renders all password fields as disabled", () => {
		renderTab();

		expect(screen.getByLabelText(/current password/i)).toBeDisabled();
		expect(screen.getByLabelText(/new password/i)).toBeDisabled();
		expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
	});

	test("renders update password button as disabled", () => {
		renderTab();

		expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
	});
});
