interface CreditPerson {
	name: string;
	role: string;
	character: string | undefined;
}

interface MediaMetadata {
	externalId: number;
	source: "tvdb" | "tmdb";
	title: string;
	overview: string | undefined;
	posterUrl: string | undefined;
	genres: string[];
	rating: number | undefined;
	year: number | undefined;
	cast: CreditPerson[];
	crew: CreditPerson[];
	status: string | undefined;
}

export type { CreditPerson, MediaMetadata };
