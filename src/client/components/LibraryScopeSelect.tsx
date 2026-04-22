import { css } from "@linaria/atomic";
import { useCallback } from "react";

import { useGetPlexLibrariesQuery } from "../features/plex/api.ts";
import { colors, radii, spacing } from "../theme.ts";

import type { ChangeEvent } from "react";

const selectStyle = css`
	padding: ${spacing.xs} ${spacing.sm};
	background: ${colors.bgLight};
	border: 1px solid ${colors.border};
	border-radius: ${radii.sm};
	color: ${colors.text};
	font-size: 0.85rem;
	outline: none;

	&:focus {
		border-color: ${colors.borderFocus};
	}
`;

interface LibraryScopeSelectProps {
	value: string;
	onChange: (value: string) => void;
	id?: string;
}

const LibraryScopeSelect = ({ value, onChange, id }: LibraryScopeSelectProps) => {
	const { data } = useGetPlexLibrariesQuery();
	const libraries = data?.libraries ?? [];

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.target.value);
		},
		[onChange],
	);

	return (
		<select id={id} className={selectStyle} value={value} onChange={handleChange}>
			<option value="">Whole library</option>
			{libraries.map((lib) => (
				<option key={lib.key} value={lib.key}>
					{lib.title}
				</option>
			))}
		</select>
	);
};

export { LibraryScopeSelect };
