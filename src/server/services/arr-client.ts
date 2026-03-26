import { z } from "zod";

type ServiceType = "radarr" | "sonarr";

interface TestConnectionResult {
	success: boolean;
	version?: string;
	error?: string;
}

interface RootFolder {
	id: number;
	path: string;
	freeSpace: number;
}

interface QualityProfile {
	id: number;
	name: string;
}

interface LookupResult {
	title: string;
	year: number;
	tmdbId: number | undefined;
	tvdbId: number | undefined;
	overview: string;
	existsInLibrary: boolean;
	arrId: number;
}

interface AddMediaParams {
	tmdbId?: number;
	tvdbId?: number;
	title: string;
	year: number;
	qualityProfileId: number;
	rootFolderPath: string;
}

interface AddMediaResult {
	success: boolean;
	id?: number;
	error?: string;
}

interface ArrFetchOptions {
	url: string;
	apiKey: string;
	path: string;
	init?: RequestInit;
}

const ARR_API_PREFIX = "/api/v3";

const LIBRARY_ID_THRESHOLD = 0;

const systemStatusSchema = z.object({ version: z.string() });

const rootFolderSchema = z.array(
	z.object({ id: z.number(), path: z.string(), freeSpace: z.number() }),
);

const qualityProfileSchema = z.array(z.object({ id: z.number(), name: z.string() }));

const lookupItemSchema = z.array(
	z.object({
		id: z.number(),
		title: z.string(),
		year: z.number(),
		tmdbId: z.number().optional(),
		tvdbId: z.number().optional(),
		overview: z.string(),
	}),
);

const addMediaResponseSchema = z.object({ id: z.number() });

const mergeHeaders = (
	apiKey: string,
	existing?: RequestInit["headers"],
): Record<string, string> => {
	const base: Record<string, string> = { "X-Api-Key": apiKey };
	if (!existing) {
		return base;
	}
	if (existing instanceof Headers) {
		existing.forEach((value, key) => {
			base[key] = value;
		});
		return base;
	}
	if (Array.isArray(existing)) {
		for (const [key, value] of existing) {
			if (key !== undefined && value !== undefined) {
				base[key] = value;
			}
		}
		return base;
	}
	return { ...existing, ...base };
};

const arrFetch = async ({ url, apiKey, path, init }: ArrFetchOptions): Promise<Response> =>
	fetch(`${url}${ARR_API_PREFIX}${path}`, {
		...init,
		headers: mergeHeaders(apiKey, init?.headers),
	});

const testConnection = async (url: string, apiKey: string): Promise<TestConnectionResult> => {
	try {
		const response = await arrFetch({ url, apiKey, path: "/system/status" });
		if (!response.ok) {
			return { success: false, error: `Request failed with status ${response.status.toString()}` };
		}
		const data = systemStatusSchema.parse(await response.json());
		return { success: true, version: data.version };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: message };
	}
};

const getRootFolders = async (url: string, apiKey: string): Promise<RootFolder[]> => {
	const response = await arrFetch({ url, apiKey, path: "/rootfolder" });
	if (!response.ok) {
		throw new Error(`Failed to get root folders: ${response.status.toString()}`);
	}
	return rootFolderSchema.parse(await response.json());
};

const getQualityProfiles = async (url: string, apiKey: string): Promise<QualityProfile[]> => {
	const response = await arrFetch({ url, apiKey, path: "/qualityprofile" });
	if (!response.ok) {
		throw new Error(`Failed to get quality profiles: ${response.status.toString()}`);
	}
	return qualityProfileSchema.parse(await response.json());
};

interface LookupOptions {
	url: string;
	apiKey: string;
	serviceType: ServiceType;
	title: string;
	year?: number;
}

const lookupMedia = async ({
	url,
	apiKey,
	serviceType,
	title,
	year,
}: LookupOptions): Promise<LookupResult[]> => {
	const term = year !== undefined ? `${title} ${year.toString()}` : title;
	const encodedTerm = encodeURIComponent(term);

	const path =
		serviceType === "radarr"
			? `/movie/lookup?term=${encodedTerm}`
			: `/series/lookup?term=${encodedTerm}`;

	const response = await arrFetch({ url, apiKey, path });
	if (!response.ok) {
		throw new Error(`Failed to lookup media: ${response.status.toString()}`);
	}

	const items = lookupItemSchema.parse(await response.json());

	return items.map(
		(item): LookupResult => ({
			title: item.title,
			year: item.year,
			tmdbId: item.tmdbId,
			tvdbId: item.tvdbId,
			overview: item.overview,
			existsInLibrary: item.id > LIBRARY_ID_THRESHOLD,
			arrId: item.id,
		}),
	);
};

interface AddMediaOptions {
	url: string;
	apiKey: string;
	serviceType: ServiceType;
	params: AddMediaParams;
}

const addMedia = async ({
	url,
	apiKey,
	serviceType,
	params,
}: AddMediaOptions): Promise<AddMediaResult> => {
	try {
		const path = serviceType === "radarr" ? "/movie" : "/series";

		const body =
			serviceType === "radarr"
				? {
						tmdbId: params.tmdbId,
						title: params.title,
						year: params.year,
						qualityProfileId: params.qualityProfileId,
						rootFolderPath: params.rootFolderPath,
						minimumAvailability: "released",
						monitored: true,
						addOptions: { searchForMovie: true },
					}
				: {
						tvdbId: params.tvdbId,
						title: params.title,
						year: params.year,
						qualityProfileId: params.qualityProfileId,
						rootFolderPath: params.rootFolderPath,
						monitored: true,
						seasonFolder: true,
						seriesType: "standard",
						addOptions: { searchForMissingEpisodes: true },
					};

		const response = await arrFetch({
			url,
			apiKey,
			path,
			init: {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				error: errorText || `Request failed with status ${response.status.toString()}`,
			};
		}

		const data = addMediaResponseSchema.parse(await response.json());
		return { success: true, id: data.id };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: message };
	}
};

export { addMedia, getQualityProfiles, getRootFolders, lookupMedia, testConnection };
export type {
	AddMediaOptions,
	AddMediaParams,
	AddMediaResult,
	ArrFetchOptions,
	LookupOptions,
	LookupResult,
	QualityProfile,
	RootFolder,
	ServiceType,
	TestConnectionResult,
};
