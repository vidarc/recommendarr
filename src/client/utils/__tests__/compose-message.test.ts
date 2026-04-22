import { describe, expect, it } from "vite-plus/test";

import { composeMessage } from "../compose-message.ts";

describe(composeMessage, () => {
	it("composes included + excluded + text", () => {
		expect(
			composeMessage({
				included: ["thriller", "horror"],
				excluded: ["comedy"],
				text: "something from the 90s",
			}),
		).toBe("Include: thriller, horror. Exclude: comedy. something from the 90s");
	});

	it("drops the exclude clause when none are excluded", () => {
		expect(
			composeMessage({
				included: ["thriller"],
				excluded: [],
				text: "something from the 90s",
			}),
		).toBe("Include: thriller. something from the 90s");
	});

	it("drops the include clause when none are included", () => {
		expect(
			composeMessage({
				included: [],
				excluded: ["comedy"],
				text: "something from the 90s",
			}),
		).toBe("Exclude: comedy. something from the 90s");
	});

	it("uses 'Give me recommendations.' fallback when text is empty but genres set", () => {
		expect(
			composeMessage({
				included: ["thriller"],
				excluded: ["comedy"],
				text: "",
			}),
		).toBe("Include: thriller. Exclude: comedy. Give me recommendations.");
	});

	it("returns trimmed text when no genres", () => {
		expect(composeMessage({ included: [], excluded: [], text: "hello" })).toBe("hello");
	});

	it("treats whitespace-only text as empty", () => {
		expect(composeMessage({ included: ["horror"], excluded: [], text: "   " })).toBe(
			"Include: horror. Give me recommendations.",
		);
	});

	it("trims surrounding whitespace from user text", () => {
		expect(composeMessage({ included: [], excluded: [], text: "  hello world  " })).toBe(
			"hello world",
		);
	});
});
