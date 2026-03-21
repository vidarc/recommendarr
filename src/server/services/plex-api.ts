const PLEX_API_BASE = "https://plex.tv/api/v2";
const CLIENT_IDENTIFIER = "recommendarr";
const PRODUCT_NAME = "Recommendarr";
const DEFAULT_HISTORY_LIMIT = 200;
const FIRST_CONNECTION = 0;

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

	const data = (await response.json()) as { id: number; code: string };
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

	const data = (await response.json()) as { authToken: string | undefined };

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

	const data = (await response.json()) as Array<{
		name: string;
		provides: string;
		owned: boolean;
		clientIdentifier: string;
		connections: Array<{
			address: string;
			port: number;
			protocol: string;
			uri: string;
			local: boolean;
		}>;
	}>;

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

	const data = (await response.json()) as {
		MediaContainer: {
			Directory: Array<{
				key: string;
				title: string;
				type: string;
			}>;
		};
	};

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

	params.set("viewedAt>>", "0");
	const basePath = libraryId ? `/library/sections/${libraryId}/allLeaves` : "/library/all";
	const url = `${serverUrl}${basePath}?type=4&${params.toString()}`;

	const response = await fetch(url, {
		method: "GET",
		headers: plexHeaders(authToken),
	});

	if (!response.ok) {
		throw new Error(`Failed to get watch history: ${response.status.toString()}`);
	}

	const data = (await response.json()) as {
		MediaContainer: {
			Metadata?: Array<{
				title: string;
				type: string;
				year?: number;
				ratingKey: string;
				grandparentTitle?: string;
				parentIndex?: number;
				index?: number;
				viewedAt: number;
			}>;
		};
	};

	return (data.MediaContainer.Metadata ?? []).map((item) => ({
		title: item.title,
		type: item.type,
		year: item.year,
		ratingKey: item.ratingKey,
		grandparentTitle: item.grandparentTitle,
		parentIndex: item.parentIndex,
		index: item.index,
		viewedAt: item.viewedAt,
	}));
};

export { checkPlexPin, createPlexPin, getPlexLibraries, getPlexServers, getWatchHistory };

export type {
	PlexLibrary,
	PlexPin,
	PlexPinCheck,
	PlexServer,
	PlexWatchedItem,
	WatchHistoryOptions,
};
