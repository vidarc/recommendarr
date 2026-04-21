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
	accentDim: "rgba(127,219,202,0.15)",
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
	xs: "0.25rem",
	sm: "0.5rem",
	md: "1rem",
	lg: "1.5rem",
	xl: "2rem",
	xxl: "3rem",
} as const;

const radii = {
	sm: "0.25rem",
	md: "0.5rem",
	lg: "0.75rem",
} as const;

const fontSizes = {
	xs: "0.75rem",
	sm: "0.8125rem",
	base: "0.875rem",
	md: "0.9375rem",
	lg: "1.375rem",
} as const;

const fonts = {
	body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	mono: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
} as const;

export { colors, fonts, fontSizes, radii, spacing };
