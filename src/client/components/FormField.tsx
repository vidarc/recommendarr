import { css } from "@linaria/atomic";

import { colors, radii, spacing } from "../theme.ts";

const fieldGroup = css`
	margin-bottom: ${spacing.md};
`;

const labelStyle = css`
	display: block;
	font-size: 0.85rem;
	font-weight: 500;
	color: ${colors.textMuted};
	margin-bottom: ${spacing.xs};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const inputStyle = css`
	width: 100%;
	padding: ${spacing.sm} ${spacing.md};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 1rem;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: ${colors.borderFocus};
	}

	&::placeholder {
		color: ${colors.textDim};
	}
`;

export const FormField = ({
	id,
	label,
	type = "text",
	value,
	onChange,
	required,
	minLength,
}: {
	id: string;
	label: string;
	type?: string;
	value: string;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	required?: boolean;
	minLength?: number;
}) => (
	<div className={fieldGroup}>
		<label htmlFor={id} className={labelStyle}>
			{label}
		</label>
		<input
			id={id}
			type={type}
			value={value}
			onChange={onChange}
			required={required}
			minLength={minLength}
			className={inputStyle}
		/>
	</div>
);
