import * as z from "zod/mini";

const PLEX_API_BASE = "https://plex.tv/api/v2";
const CLIENT_IDENTIFIER = "recommendarr";
const PRODUCT_NAME = "Recommendarr";
const DEFAULT_HISTORY_LIMIT = 200;
const FIRST_CONNECTION = 0;
const UNKNOWN_VIEWED_AT = 0;

interface PlexPin {
	id: number;
	code: string;
	authUrl: string;
}

interface PlexPinCheck {
	authToken: string | undefined;
}

interface PlexServer {
	name: string;
	address: string;
	port: number;
	scheme: string;
	uri: string;
	clientIdentifier: string;
	owned: boolean;
}

interface PlexLibrary {
	key: string;
	title: string;
	type: string;
}

interface PlexWatchedItem {
	title: string;
	type: string;
	year: number | undefined;
	ratingKey: string;
	grandparentTitle: string | undefined;
	parentIndex: number | undefined;
	index: number | undefined;
	viewedAt: number;
}

interface WatchHistoryOptions {
	serverUrl: string;
	authToken: string;
	libraryId?: string;
	limit?: number;
}

interface LibraryContentsOptions {
	serverUrl: string;
	authToken: string;
	libraryId: string;
	pageSize?: number;
}

interface PlexLibraryItem {
	title: string;
	type: string;
	year: number | undefined;
	ratingKey: string;
	genres: string;
}

const DEFAULT_PAGE_SIZE = 200;

const plexHeaders = (authToken?: string): Record<string, string> => {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"X-Plex-Client-Identifier": CLIENT_IDENTIFIER,
		"X-Plex-Product": PRODUCT_NAME,
	};
	if (authToken) {
		headers["X-Plex-Token"] = authToken;
	}
	return headers;
};

const plexPinResponseSchema = z.object({ id: z.number(), code: z.string() });

const plexPinCheckResponseSchema = z.object({
	authToken: z.optional(z.nullable(z.string())),
});

const plexResourceSchema = z.array(
	z.object({
		name: z.string(),
		provides: z.string(),
		owned: z.boolean(),
		clientIdentifier: z.string(),
		connections: z.array(
			z.object({
				address: z.string(),
				port: z.number(),
				protocol: z.string(),
				uri: z.string(),
				local: z.boolean(),
			}),
		),
	}),
);

const plexLibrariesResponseSchema = z.object({
	MediaContainer: z.object({
		Directory: z.array(
			z.object({
				key: z.string(),
				title: z.string(),
				type: z.string(),
			}),
		),
	}),
});

const plexWatchHistoryResponseSchema = z.object({
	MediaContainer: z.object({
		Metadata: z.optional(
			z.array(
				z.object({
					title: z.string(),
					type: z.string(),
					year: z.optional(z.number()),
					ratingKey: z.string(),
					grandparentTitle: z.optional(z.string()),
					parentIndex: z.optional(z.number()),
					index: z.optional(z.number()),
					viewedAt: z.optional(z.number()),
				}),
			),
		),
	}),
});

const plexLibraryContentsResponseSchema = z.object({
	MediaContainer: z.object({
		totalSize: z.number(),
		Metadata: z.optional(
			z.array(
				z.object({
					title: z.string(),
					type: z.string(),
					year: z.optional(z.number()),
					ratingKey: z.string(),
					Genre: z.optional(z.array(z.object({ tag: z.string() }))),
				}),
			),
		),
	}),
});

const createPlexPin = async (): Promise<PlexPin> => {
	const response = await fetch(`${PLEX_API_BASE}/pins`, {
		method: "POST",
		headers: {
			...plexHeaders(),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "strong=true",
	});

	if (!response.ok) {
		throw new Error(`Failed to create Plex PIN: ${response.status.toString()}`);
	}

	const data = plexPinResponseSchema.parse(await response.json());
	const authUrl = `https://app.plex.tv/auth#?clientID=${CLIENT_IDENTIFIER}&code=${data.code}&context%5Bdevice%5D%5Bproduct%5D=${PRODUCT_NAME}`;

	return {
		id: data.id,
		code: data.code,
		authUrl,
	};
};

const checkPlexPin = async (pinId: number): Promise<PlexPinCheck> => {
	const response = await fetch(`${PLEX_API_BASE}/pins/${pinId.toString()}`, {
		method: "GET",
		headers: plexHeaders(),
	});

	if (!response.ok) {
		throw new Error(`Failed to check Plex PIN: ${response.status.toString()}`);
	}

	const data = plexPinCheckResponseSchema.parse(await response.json());

	return {
		authToken: data.authToken ?? undefined,
	};
};

const getPlexServers = async (authToken: string): Promise<PlexServer[]> => {
	const response = await fetch(`${PLEX_API_BASE}/resources?includeHttps=1`, {
		method: "GET",
		headers: plexHeaders(authToken),
	});

	if (!response.ok) {
		throw new Error(`Failed to get Plex servers: ${response.status.toString()}`);
	}

	const data = plexResourceSchema.parse(await response.json());

	return data
		.filter((resource) => resource.provides.includes("server"))
		.map((resource) => {
			const connection =
				resource.connections.find((conn) => !conn.local) ?? resource.connections[FIRST_CONNECTION];
			if (!connection) {
				throw new Error(`No connections found for server ${resource.name}`);
			}
			return {
				name: resource.name,
				address: connection.address,
				port: connection.port,
				scheme: connection.protocol,
				uri: connection.uri,
				clientIdentifier: resource.clientIdentifier,
				owned: resource.owned,
			};
		});
};

const getPlexLibraries = async (serverUrl: string, authToken: string): Promise<PlexLibrary[]> => {
	const response = await fetch(`${serverUrl}/library/sections`, {
		method: "GET",
		headers: plexHeaders(authToken),
	});

	if (!response.ok) {
		throw new Error(`Failed to get Plex libraries: ${response.status.toString()}`);
	}

	const data = plexLibrariesResponseSchema.parse(await response.json());

	return data.MediaContainer.Directory.map((dir) => ({
		key: dir.key,
		title: dir.title,
		type: dir.type,
	}));
};

const getWatchHistory = async (options: WatchHistoryOptions): Promise<PlexWatchedItem[]> => {
	const { serverUrl, authToken, libraryId, limit = DEFAULT_HISTORY_LIMIT } = options;

	const params = new URLSearchParams({
		sort: "viewedAt:desc",
		"X-Plex-Container-Start": "0",
		"X-Plex-Container-Size": limit.toString(),
	});

	if (libraryId) {
		params.set("librarySectionID", libraryId);
	}

	const url = `${serverUrl}/status/sessions/history/all?${params.toString()}`;

	const response = await fetch(url, {
		method: "GET",
		headers: plexHeaders(authToken),
	});

	if (!response.ok) {
		throw new Error(`Failed to get watch history: ${response.status.toString()}`);
	}

	const data = plexWatchHistoryResponseSchema.parse(await response.json());

	return (data.MediaContainer.Metadata ?? []).map((item) => ({
		title: item.title,
		type: item.type,
		year: item.year,
		ratingKey: item.ratingKey,
		grandparentTitle: item.grandparentTitle,
		parentIndex: item.parentIndex,
		index: item.index,
		viewedAt: item.viewedAt ?? UNKNOWN_VIEWED_AT,
	}));
};

const EMPTY_LENGTH = 0;

const getLibraryContents = async (options: LibraryContentsOptions): Promise<PlexLibraryItem[]> => {
	const { serverUrl, authToken, libraryId, pageSize = DEFAULT_PAGE_SIZE } = options;

	const items: PlexLibraryItem[] = [];
	let start = 0;
	let totalSize = Infinity;

	while (start < totalSize) {
		const params = new URLSearchParams({
			"X-Plex-Container-Start": start.toString(),
			"X-Plex-Container-Size": pageSize.toString(),
		});
		const url = `${serverUrl}/library/sections/${libraryId}/all?${params.toString()}`;

		// eslint-disable-next-line no-await-in-loop -- pagination requires sequential requests; each page depends on the previous response
		const response = await fetch(url, {
			method: "GET",
			headers: plexHeaders(authToken),
		});

		if (!response.ok) {
			throw new Error(`Failed to get library contents: ${response.status.toString()}`);
		}

		// eslint-disable-next-line no-await-in-loop -- sequential await required for pagination
		const data = plexLibraryContentsResponseSchema.parse(await response.json());
		const { totalSize: responseTotal, Metadata } = data.MediaContainer;
		totalSize = responseTotal;

		const metadata = Metadata ?? [];
		if (metadata.length === EMPTY_LENGTH) {
			break;
		}

		for (const item of metadata) {
			items.push({
				title: item.title,
				type: item.type,
				year: item.year,
				ratingKey: item.ratingKey,
				genres: (item.Genre ?? []).map((genre) => genre.tag).join(","),
			});
		}

		start += metadata.length;
	}

	return items;
};

export {
	checkPlexPin,
	createPlexPin,
	getLibraryContents,
	getPlexLibraries,
	getPlexServers,
	getWatchHistory,
};

export type {
	LibraryContentsOptions,
	PlexLibrary,
	PlexLibraryItem,
	PlexPin,
	PlexPinCheck,
	PlexServer,
	PlexWatchedItem,
	WatchHistoryOptions,
};
