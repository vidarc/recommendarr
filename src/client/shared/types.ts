interface Recommendation {
	id: string;
	title: string;
	year?: number;
	mediaType: string;
	synopsis?: string;
	tmdbId?: number;
	addedToArr: boolean;
}

interface ChatMessageResponse {
	id: string;
	content: string;
	role: string;
	createdAt: string;
	recommendations: Recommendation[];
}

export type { ChatMessageResponse, Recommendation };
