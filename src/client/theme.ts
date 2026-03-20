// Night Owl color scheme tokens
const colors = {
	bg: "#011627",
	bgLight: "#0b2942",
	bgLighter: "#13344f",
	surface: "#112b45",
	surfaceHover: "#1a3a5c",
	border: "#1e4976",
	borderFocus: "#7fdbca",

	text: "#d6deeb",
	textMuted: "#7f9bba",
	textDim: "#637777",

	accent: "#7fdbca",
	accentHover: "#5cc5b0",
	blue: "#82aaff",
	green: "#addb67",
	yellow: "#ecc48d",
	orange: "#f78c6c",
	red: "#ef5350",
	purple: "#c792ea",
	pink: "#ff5874",
} as const;

const spacing = {
	xs: "4px",
	sm: "8px",
	md: "16px",
	lg: "24px",
	xl: "32px",
	xxl: "48px",
} as const;

const radii = {
	sm: "4px",
	md: "8px",
	lg: "12px",
} as const;

const fonts = {
	body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	mono: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
} as const;

export { colors, fonts, radii, spacing };
