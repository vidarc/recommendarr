const MEDIA_TYPES = [
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "TV Shows" },
	{ value: "any", label: "Either" },
] as const;

type MediaType = (typeof MEDIA_TYPES)[number]["value"];

export type { MediaType };
export { MEDIA_TYPES };
