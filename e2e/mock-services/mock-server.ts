import Fastify from "fastify";

import type { FastifyReply, FastifyRequest } from "fastify";

const PLEX_PORT = 9090;
const RADARR_PORT = 7878;
const SONARR_PORT = 8989;

// ── Auth middleware helpers ──────────────────────────────────

const requirePlexToken = (request: FastifyRequest, reply: FastifyReply) => {
	const token = request.headers["x-plex-token"];
	if (!token) {
		reply.code(401).send({ error: "Unauthorized" });
	}
};

const requireArrApiKey = (request: FastifyRequest, reply: FastifyReply) => {
	const key = request.headers["x-api-key"];
	if (!key) {
		reply.code(401).send({ error: "Unauthorized" });
	}
};

// ── Mock data ───────────────────────────────────────────────

const plexMovieLibrary = {
	MediaContainer: {
		totalSize: 3,
		Metadata: [
			{
				title: "The Shawshank Redemption",
				type: "movie",
				year: 1994,
				ratingKey: "1001",
				Genre: [{ tag: "Drama" }],
			},
			{
				title: "The Dark Knight",
				type: "movie",
				year: 2008,
				ratingKey: "1002",
				Genre: [{ tag: "Action" }, { tag: "Drama" }],
			},
			{
				title: "Inception",
				type: "movie",
				year: 2010,
				ratingKey: "1003",
				Genre: [{ tag: "Sci-Fi" }, { tag: "Action" }],
			},
		],
	},
};

const plexShowLibrary = {
	MediaContainer: {
		totalSize: 2,
		Metadata: [
			{
				title: "Breaking Bad",
				type: "show",
				year: 2008,
				ratingKey: "2001",
				Genre: [{ tag: "Drama" }, { tag: "Crime" }],
			},
			{
				title: "The Office",
				type: "show",
				year: 2005,
				ratingKey: "2002",
				Genre: [{ tag: "Comedy" }],
			},
		],
	},
};

const radarrLibraryMovies = [
	{ title: "Interstellar", year: 2014, tmdbId: 157_336, genres: ["Sci-Fi", "Drama"] },
];

const sonarrLibrarySeries = [
	{ title: "Stranger Things", year: 2016, tvdbId: 305_288, genres: ["Sci-Fi", "Horror"] },
];

const plexLibraries = {
	MediaContainer: {
		Directory: [
			{ key: "1", title: "Movies", type: "movie" },
			{ key: "2", title: "TV Shows", type: "show" },
		],
	},
};

const plexWatchHistory = {
	MediaContainer: {
		Metadata: [
			{
				title: "The Shawshank Redemption",
				type: "movie",
				year: 1994,
				ratingKey: "1001",
				viewedAt: 1_711_500_000,
			},
			{
				title: "The Dark Knight",
				type: "movie",
				year: 2008,
				ratingKey: "1002",
				viewedAt: 1_711_400_000,
			},
			{ title: "Inception", type: "movie", year: 2010, ratingKey: "1003", viewedAt: 1_711_300_000 },
			{
				title: "Pulp Fiction",
				type: "movie",
				year: 1994,
				ratingKey: "1004",
				viewedAt: 1_711_200_000,
			},
			{
				title: "The Matrix",
				type: "movie",
				year: 1999,
				ratingKey: "1005",
				viewedAt: 1_711_100_000,
			},
		],
	},
};

const radarrMovieLookup = [
	{
		id: 0,
		title: "The Shawshank Redemption",
		year: 1994,
		tmdbId: 278,
		overview:
			"Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison.",
	},
	{
		id: 0,
		title: "The Shawshank Redemption 2",
		year: 2025,
		tmdbId: 99_999,
		overview: "A fictional sequel for testing purposes.",
	},
];

const sonarrSeriesLookup = [
	{
		id: 0,
		title: "Breaking Bad",
		year: 2008,
		tvdbId: 81_189,
		overview:
			"A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
	},
	{
		id: 0,
		title: "Better Call Saul",
		year: 2015,
		tvdbId: 273_181,
		overview: "The trials and tribulations of criminal lawyer Jimmy McGill.",
	},
];

// ── Plex mock (port 9090) ───────────────────────────────────

const createPlexMock = async () => {
	const plex = Fastify();

	plex.get("/healthz", async () => ({ status: "ok" }));

	plex.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requirePlexToken(request, reply);
		done();
	});

	plex.get("/library/sections", async () => plexLibraries);

	plex.get("/library/sections/:id/allLeaves", async () => plexWatchHistory);

	plex.get<{ Params: { id: string } }>("/library/sections/:id/all", async (request) => {
		const { id } = request.params;
		if (id === "1") {
			return plexMovieLibrary;
		}
		if (id === "2") {
			return plexShowLibrary;
		}
		return { MediaContainer: { totalSize: 0, Metadata: [] } };
	});

	plex.get("/library/all", async () => plexWatchHistory);

	await plex.listen({ port: PLEX_PORT, host: "0.0.0.0" });
	console.log(`Mock Plex server listening on port ${String(PLEX_PORT)}`);
};

// ── Radarr mock (port 7878) ─────────────────────────────────

const createRadarrMock = async () => {
	const radarr = Fastify();

	radarr.get("/healthz", async () => ({ status: "ok" }));

	radarr.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requireArrApiKey(request, reply);
		done();
	});

	radarr.get("/api/v3/system/status", async () => ({ version: "5.3.6" }));
	radarr.get("/api/v3/rootfolder", async () => [
		{ id: 1, path: "/movies", freeSpace: 100_000_000_000 },
	]);
	radarr.get("/api/v3/qualityprofile", async () => [{ id: 1, name: "HD-1080p" }]);
	radarr.get("/api/v3/movie", async () => radarrLibraryMovies);
	radarr.get("/api/v3/movie/lookup", async () => radarrMovieLookup);
	radarr.post("/api/v3/movie", async () => ({ id: 1 }));

	await radarr.listen({ port: RADARR_PORT, host: "0.0.0.0" });
	console.log(`Mock Radarr server listening on port ${String(RADARR_PORT)}`);
};

// ── Sonarr mock (port 8989) ─────────────────────────────────

const createSonarrMock = async () => {
	const sonarr = Fastify();

	sonarr.get("/healthz", async () => ({ status: "ok" }));

	sonarr.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requireArrApiKey(request, reply);
		done();
	});

	sonarr.get("/api/v3/system/status", async () => ({ version: "4.0.1" }));
	sonarr.get("/api/v3/rootfolder", async () => [
		{ id: 1, path: "/tv", freeSpace: 100_000_000_000 },
	]);
	sonarr.get("/api/v3/qualityprofile", async () => [{ id: 1, name: "HD-1080p" }]);
	sonarr.get("/api/v3/series", async () => sonarrLibrarySeries);
	sonarr.get("/api/v3/series/lookup", async () => sonarrSeriesLookup);
	sonarr.post("/api/v3/series", async () => ({ id: 1 }));

	await sonarr.listen({ port: SONARR_PORT, host: "0.0.0.0" });
	console.log(`Mock Sonarr server listening on port ${String(SONARR_PORT)}`);
};

// ── Start all ───────────────────────────────────────────────

await Promise.all([createPlexMock(), createRadarrMock(), createSonarrMock()]);
console.log("All mock services started");
