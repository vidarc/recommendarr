import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { SettingsField } from "../SettingsField.tsx";

const renderField = (
	overrides: {
		id?: string;
		label?: string;
		type?: string;
		value?: string;
		onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
		disabled?: boolean;
		placeholder?: string;
	} = {},
) => {
	const onChange = overrides.onChange ?? vi.fn();
	const id = overrides.id ?? "test-field";
	const label = overrides.label ?? "Test Label";
	const value = overrides.value ?? "";

	onTestFinished(cleanup);

	if (
		overrides.type !== undefined &&
		overrides.disabled !== undefined &&
		overrides.placeholder !== undefined
	) {
		render(
			<SettingsField
				id={id}
				label={label}
				value={value}
				onChange={onChange}
				type={overrides.type}
				disabled={overrides.disabled}
				placeholder={overrides.placeholder}
			/>,
		);
	} else if (overrides.type !== undefined) {
		render(
			<SettingsField
				id={id}
				label={label}
				value={value}
				onChange={onChange}
				type={overrides.type}
			/>,
		);
	} else if (overrides.disabled !== undefined) {
		render(
			<SettingsField
				id={id}
				label={label}
				value={value}
				onChange={onChange}
				disabled={overrides.disabled}
			/>,
		);
	} else if (overrides.placeholder !== undefined) {
		render(
			<SettingsField
				id={id}
				label={label}
				value={value}
				onChange={onChange}
				placeholder={overrides.placeholder}
			/>,
		);
	} else {
		render(<SettingsField id={id} label={label} value={value} onChange={onChange} />);
	}

	return { onChange };
};

describe("SettingsField", () => {
	test("renders label and input", () => {
		renderField({ label: "Endpoint URL" });

		expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
	});

	test("renders with correct input type", () => {
		renderField({ type: "password" });

		expect(screen.getByLabelText(/test label/i)).toHaveAttribute("type", "password");
	});

	test("defaults to text type", () => {
		renderField();

		expect(screen.getByLabelText(/test label/i)).toHaveAttribute("type", "text");
	});

	test("renders with placeholder", () => {
		renderField({ placeholder: "https://api.example.com" });

		expect(screen.getByPlaceholderText("https://api.example.com")).toBeInTheDocument();
	});

	test("renders as disabled when disabled prop is true", () => {
		renderField({ disabled: true });

		expect(screen.getByLabelText(/test label/i)).toBeDisabled();
	});

	test("displays the provided value", () => {
		renderField({ value: "current-value" });

		expect(screen.getByLabelText(/test label/i)).toHaveValue("current-value");
	});

	test("calls onChange when user types", async () => {
		const { onChange } = renderField();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText(/test label/i), "a");

		expect(onChange).toHaveBeenCalled();
	});
});
