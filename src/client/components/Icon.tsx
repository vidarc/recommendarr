interface IconProps {
	name: "spark" | "clock" | "settings" | "logout" | "plus";
	size?: number;
	color?: string;
}

const DEFAULT_SIZE = 17;
const STROKE_WIDTH = "1.3";

export const Icon = ({ name, size = DEFAULT_SIZE, color = "currentColor" }: IconProps) => {
	if (name === "spark") {
		return (
			<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path
					d="M9 2l1.5 4.5H15l-3.75 2.75 1.5 4.5L9 11 5.25 13.75l1.5-4.5L3 6.5h4.5L9 2z"
					stroke={color}
					strokeWidth="1.2"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (name === "clock") {
		return (
			<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth={STROKE_WIDTH} />
				<path
					d="M9 5.5V9l2.5 1.5"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (name === "settings") {
		return (
			<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<circle cx="9" cy="9" r="2.5" stroke={color} strokeWidth={STROKE_WIDTH} />
				<path
					d="M9 1v2M9 15v2M1 9h2M15 9h2M3.1 3.1l1.4 1.4M13.5 13.5l1.4 1.4M3.1 14.9l1.4-1.4M13.5 4.5l1.4-1.4"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (name === "logout") {
		return (
			<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path
					d="M7 3H3a1 1 0 00-1 1v10a1 1 0 001 1h4M12 13l3-4-3-4M15 9H7"
					stroke={color}
					strokeWidth={STROKE_WIDTH}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (name === "plus") {
		return (
			<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path d="M9 3v12M3 9h12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
			</svg>
		);
	}
	// oxlint-disable-next-line unicorn/no-null -- intentional null for unsupported icon name
	return null;
};
