import { describe, expect, test } from "vite-plus/test";

import { formatRelativeDate } from "../format-date.ts";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const AT_LEAST_ONE = 1;

const minutesAgo = (count: number) =>
	new Date(Date.now() - count * SECONDS_PER_MINUTE * MS_PER_SECOND).toISOString();

const hoursAgo = (count: number) =>
	new Date(
		Date.now() - count * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND,
	).toISOString();

const daysAgo = (count: number) =>
	new Date(
		Date.now() - count * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND,
	).toISOString();

describe("formatRelativeDate", () => {
	test("returns 'just now' for timestamps less than a minute ago", () => {
		const now = new Date().toISOString();
		expect(formatRelativeDate(now)).toBe("just now");
	});

	test("returns minutes ago for timestamps under an hour", () => {
		const fiveMinutes = 5;
		expect(formatRelativeDate(minutesAgo(fiveMinutes))).toBe("5m ago");
	});

	test("returns 1m ago for exactly one minute", () => {
		expect(formatRelativeDate(minutesAgo(AT_LEAST_ONE))).toBe("1m ago");
	});

	test("returns hours ago for timestamps under a day", () => {
		const threeHours = 3;
		expect(formatRelativeDate(hoursAgo(threeHours))).toBe("3h ago");
	});

	test("returns 1h ago for exactly one hour", () => {
		expect(formatRelativeDate(hoursAgo(AT_LEAST_ONE))).toBe("1h ago");
	});

	test("returns days ago for timestamps under a week", () => {
		const fourDays = 4;
		expect(formatRelativeDate(daysAgo(fourDays))).toBe("4d ago");
	});

	test("returns weeks ago for timestamps under a month", () => {
		const fourteenDays = 14;
		expect(formatRelativeDate(daysAgo(fourteenDays))).toBe("2w ago");
	});

	test("returns months ago for timestamps under a year", () => {
		const sixtyDays = 60;
		expect(formatRelativeDate(daysAgo(sixtyDays))).toBe("2mo ago");
	});

	test("returns years ago for timestamps over a year", () => {
		const fourHundredDays = 400;
		expect(formatRelativeDate(daysAgo(fourHundredDays))).toBe("1y ago");
	});

	test("handles boundary between days and weeks (exactly 7 days)", () => {
		const sevenDays = 7;
		expect(formatRelativeDate(daysAgo(sevenDays))).toBe("1w ago");
	});

	test("handles boundary between weeks and months (exactly 30 days)", () => {
		const thirtyDays = 30;
		expect(formatRelativeDate(daysAgo(thirtyDays))).toBe("1mo ago");
	});

	test("handles boundary between months and years (exactly 365 days)", () => {
		const threeSixtyFive = 365;
		expect(formatRelativeDate(daysAgo(threeSixtyFive))).toBe("1y ago");
	});

	test("handles multiple years", () => {
		const eightHundredDays = 800;
		expect(formatRelativeDate(daysAgo(eightHundredDays))).toBe("2y ago");
	});
});
