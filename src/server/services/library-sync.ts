import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { libraryItems, recommendations, userSettings } from "../schema.ts";
import { getAllMovies, getAllSeries } from "./arr-client.ts";
import { decrypt } from "./encryption.ts";
import { getLibraryContents, getPlexLibraries } from "./plex-api.ts";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

interface PlexConnectionRow {
	authToken: string;
	serverUrl: string | null;
}

interface ArrConnectionRow {
	serviceType: string;
	url: string;
	apiKey: string;
}

interface ExclusionTitle {
	title: string;
	year?: number;
	mediaType: string;
}

interface ExclusionSummary {
	movieCount: number;
	showCount: number;
	topGenres: string[];
}

interface ExclusionContext {
	titles: ExclusionTitle[];
	summary: ExclusionSummary;
	pastRecommendations: { title: string; year?: number }[];
}

const INTERVAL_MS: Record<string, number> = {
	"6h": 21_600_000,
	"12h": 43_200_000,
	"24h": 86_400_000,
	"7d": 604_800_000,
};

const TOP_GENRE_COUNT = 5;
const MAX_EXCLUSION_TITLES = 500;
const EMPTY_LENGTH = 0;
const GENRE_FREQUENCY_ENTRY_INDEX = 1;
const INCREMENT = 1;
const SLICE_FROM_START = 0;

interface SyncLibraryOptions {
	userId: string;
	db: BetterSQLite3Database<Record<string, unknown>>;
	plexConnection: PlexConnectionRow;
	arrConns: ArrConnectionRow[];
}

const syncLibrary = async ({
	userId,
	db,
	plexConnection,
	arrConns,
}: SyncLibraryOptions): Promise<void> => {
	const now = new Date().toISOString();
	const authToken = decrypt(plexConnection.authToken);
	const serverUrl = plexConnection.serverUrl ?? "";

	const newItems: (typeof libraryItems.$inferInsert)[] = [];

	// Fetch from Plex
	if (serverUrl) {
		const libraries = await getPlexLibraries(serverUrl, authToken);

		for (const library of libraries) {
			// eslint-disable-next-line no-await-in-loop -- sequential pagination required per library
			const contents = await getLibraryContents({
				serverUrl,
				authToken,
				libraryId: library.key,
			});

			for (const item of contents) {
				newItems.push({
					id: randomUUID(),
					userId,
					title: item.title,
					year: item.year ?? undefined,
					mediaType: item.type,
					source: "plex",
					plexRatingKey: item.ratingKey,
					externalId: undefined,
					genres: item.genres || undefined,
					syncedAt: now,
				});
			}
		}
	}

	// Fetch from Radarr
	const radarrConn = arrConns.find((conn) => conn.serviceType === "radarr");
	if (radarrConn) {
		const apiKey = decrypt(radarrConn.apiKey);
		const movies = await getAllMovies(radarrConn.url, apiKey);

		for (const movie of movies) {
			newItems.push({
				id: randomUUID(),
				userId,
				title: movie.title,
				year: movie.year,
				mediaType: "movie",
				source: "radarr",
				plexRatingKey: undefined,
				externalId: String(movie.tmdbId),
				genres: movie.genres || undefined,
				syncedAt: now,
			});
		}
	}

	// Fetch from Sonarr
	const sonarrConn = arrConns.find((conn) => conn.serviceType === "sonarr");
	if (sonarrConn) {
		const apiKey = decrypt(sonarrConn.apiKey);
		const series = await getAllSeries(sonarrConn.url, apiKey);

		for (const show of series) {
			newItems.push({
				id: randomUUID(),
				userId,
				title: show.title,
				year: show.year,
				mediaType: "show",
				source: "sonarr",
				plexRatingKey: undefined,
				externalId: String(show.tvdbId),
				genres: show.genres || undefined,
				syncedAt: now,
			});
		}
	}

	// Replace all existing items then insert fresh set
	db.delete(libraryItems).where(eq(libraryItems.userId, userId)).run();

	if (newItems.length > EMPTY_LENGTH) {
		db.insert(libraryItems).values(newItems).run();
	}

	// Upsert userSettings with librarySyncLast
	const existing = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

	if (existing) {
		db.update(userSettings)
			.set({ librarySyncLast: now })
			.where(eq(userSettings.userId, userId))
			.run();
	} else {
		db.insert(userSettings)
			.values({
				id: randomUUID(),
				userId,
				librarySyncInterval: "manual",
				librarySyncLast: now,
			})
			.run();
	}
};

const buildExclusionContext = async (
	userId: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
	options: { mediaType: "movie" | "show" | "either" },
): Promise<ExclusionContext> => {
	const allItems = db.select().from(libraryItems).where(eq(libraryItems.userId, userId)).all();

	const movieCount = allItems.filter((item) => item.mediaType === "movie").length;
	const showCount = allItems.filter((item) => item.mediaType === "show").length;

	// Aggregate genres across all items to find top 5
	const genreFrequency = new Map<string, number>();
	const itemsWithGenres = allItems.filter((item) => Boolean(item.genres));
	for (const item of itemsWithGenres) {
		const genres = item
			.genres!.split(",")
			.map((genre) => genre.trim())
			.filter(Boolean);
		for (const genre of genres) {
			genreFrequency.set(genre, (genreFrequency.get(genre) ?? EMPTY_LENGTH) + INCREMENT);
		}
	}

	const topGenres = [...genreFrequency.entries()]
		.toSorted(
			(entryA, entryB) => entryB[GENRE_FREQUENCY_ENTRY_INDEX] - entryA[GENRE_FREQUENCY_ENTRY_INDEX],
		)
		.slice(SLICE_FROM_START, TOP_GENRE_COUNT)
		.map(([genre]) => genre);

	// Filter items by mediaType for the exclusion titles list
	const filtered =
		options.mediaType === "either"
			? allItems
			: allItems.filter((item) => item.mediaType === options.mediaType);

	const titles: ExclusionTitle[] = filtered
		.slice(SLICE_FROM_START, MAX_EXCLUSION_TITLES)
		.map((item) => ({
			title: item.title,
			...(item.year !== null && item.year !== undefined && { year: item.year }),
			mediaType: item.mediaType,
		}));

	// Fetch all past recommendation titles
	const pastRecs = db.select().from(recommendations).all();

	const pastRecommendations = pastRecs.map((rec) => ({
		title: rec.title,
		...(rec.year !== null && rec.year !== undefined && { year: rec.year }),
	}));

	return {
		titles,
		summary: {
			movieCount,
			showCount,
			topGenres,
		},
		pastRecommendations,
	};
};

const shouldAutoSync = async (
	userId: string,
	db: BetterSQLite3Database<Record<string, unknown>>,
): Promise<boolean> => {
	const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

	if (!settings) {
		return false;
	}

	const { librarySyncInterval, librarySyncLast } = settings;

	if (librarySyncInterval === "manual") {
		return false;
	}

	if (!librarySyncLast) {
		return true;
	}

	const intervalMs = INTERVAL_MS[librarySyncInterval];
	if (intervalMs === undefined) {
		return false;
	}

	const lastSync = new Date(librarySyncLast).getTime();
	return Date.now() - lastSync >= intervalMs;
};

export { buildExclusionContext, shouldAutoSync, syncLibrary };

export type {
	ArrConnectionRow,
	ExclusionContext,
	ExclusionSummary,
	ExclusionTitle,
	PlexConnectionRow,
	SyncLibraryOptions,
};
