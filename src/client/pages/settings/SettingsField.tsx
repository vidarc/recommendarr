import { fieldGroup, inputStyle, labelStyle } from "./settings-styles.ts";

import type { ChangeEvent } from "react";

interface SettingsFieldProps {
	id: string;
	label: string;
	type?: string;
	value: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	disabled?: boolean;
	placeholder?: string;
}

export const SettingsField = ({
	id,
	label,
	type = "text",
	value,
	onChange,
	disabled,
	placeholder,
}: SettingsFieldProps) => (
	<div className={fieldGroup}>
		<label htmlFor={id} className={labelStyle}>
			{label}
		</label>
		<input
			id={id}
			type={type}
			value={value}
			onChange={onChange}
			disabled={disabled}
			placeholder={placeholder}
			className={inputStyle}
		/>
	</div>
);
