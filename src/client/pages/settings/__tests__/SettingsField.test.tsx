import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, it, vi } from "vite-plus/test";

import { SettingsField } from "../SettingsField.tsx";

import type { ChangeEvent } from "react";

const renderField = (
	overrides: {
		id?: string;
		label?: string;
		type?: string;
		value?: string;
		onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
		disabled?: boolean;
		placeholder?: string;
	} = {},
) => {
	const onChange = overrides.onChange ?? vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>();

	onTestFinished(cleanup);

	const props = {
		id: overrides.id ?? "test-field",
		label: overrides.label ?? "Test Label",
		value: overrides.value ?? "",
		onChange,
		...(overrides.type !== undefined ? { type: overrides.type } : {}),
		...(overrides.disabled !== undefined ? { disabled: overrides.disabled } : {}),
		...(overrides.placeholder !== undefined ? { placeholder: overrides.placeholder } : {}),
	};

	// eslint-disable-next-line react/jsx-props-no-spreading -- test helper
	render(<SettingsField {...props} />);

	return { onChange };
};

describe(SettingsField, () => {
	it("renders label and input", () => {
		renderField({ label: "Endpoint URL" });

		expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
	});

	it("renders with correct input type", () => {
		renderField({ type: "password" });

		expect(screen.getByLabelText(/test label/i)).toHaveAttribute("type", "password");
	});

	it("defaults to text type", () => {
		renderField();

		expect(screen.getByLabelText(/test label/i)).toHaveAttribute("type", "text");
	});

	it("renders with placeholder", () => {
		renderField({ placeholder: "https://api.example.com" });

		expect(screen.getByPlaceholderText("https://api.example.com")).toBeInTheDocument();
	});

	it("renders as disabled when disabled prop is true", () => {
		renderField({ disabled: true });

		expect(screen.getByLabelText(/test label/i)).toBeDisabled();
	});

	it("displays the provided value", () => {
		renderField({ value: "current-value" });

		expect(screen.getByLabelText(/test label/i)).toHaveValue("current-value");
	});

	it("calls onChange when user types", async () => {
		const { onChange } = renderField();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/test label/i), "a");

		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "change" }));
	});
});
