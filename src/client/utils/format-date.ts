const NO_TIME_ELAPSED = 0;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export const formatRelativeDate = (dateString: string): string => {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / MS_PER_SECOND);
	const diffMinutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
	const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
	const diffDays = Math.floor(diffHours / HOURS_PER_DAY);

	if (diffDays >= DAYS_PER_YEAR) {
		const years = Math.floor(diffDays / DAYS_PER_YEAR);
		return `${String(years)}y ago`;
	}
	if (diffDays >= DAYS_PER_MONTH) {
		const months = Math.floor(diffDays / DAYS_PER_MONTH);
		return `${String(months)}mo ago`;
	}
	if (diffDays >= DAYS_PER_WEEK) {
		const weeks = Math.floor(diffDays / DAYS_PER_WEEK);
		return `${String(weeks)}w ago`;
	}
	if (diffDays > NO_TIME_ELAPSED) {
		return `${String(diffDays)}d ago`;
	}
	if (diffHours > NO_TIME_ELAPSED) {
		return `${String(diffHours)}h ago`;
	}
	if (diffMinutes > NO_TIME_ELAPSED) {
		return `${String(diffMinutes)}m ago`;
	}
	return "just now";
};
