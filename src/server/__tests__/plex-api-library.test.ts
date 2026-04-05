import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import { getLibraryContents } from "../services/plex-api.ts";

const THREE_ITEMS = 3;
const TWO_ITEMS = 2;
const ONE_ITEM = 1;
const FIRST = 0;
const SECOND = 1;
const THIRD = 2;
const MATRIX_YEAR = 1999;

const testServerUrl = "https://test-server.plex.direct:32400";
const testAuthToken = "test-auth-token";
const testLibraryId = "1";

const mockMovies = [
	{
		title: "The Matrix",
		type: "movie",
		year: 1999,
		ratingKey: "101",
		Genre: [{ tag: "Action" }, { tag: "Sci-Fi" }],
	},
	{
		title: "Inception",
		type: "movie",
		year: 2010,
		ratingKey: "102",
		Genre: [{ tag: "Action" }, { tag: "Thriller" }],
	},
	{
		title: "Interstellar",
		type: "movie",
		year: 2014,
		ratingKey: "103",
		Genre: [{ tag: "Sci-Fi" }, { tag: "Drama" }],
	},
];

const handlers = [
	http.get(`${testServerUrl}/library/sections/${testLibraryId}/all`, ({ request }) => {
		const url = new URL(request.url);
		const start = Number(url.searchParams.get("X-Plex-Container-Start") ?? "0");
		const size = Number(url.searchParams.get("X-Plex-Container-Size") ?? "200");

		const page = mockMovies.slice(start, start + size);
		return HttpResponse.json({
			MediaContainer: {
				totalSize: THREE_ITEMS,
				Metadata: page,
			},
		});
	}),
];

const mswServer = setupServer(...handlers);

beforeAll(() => {
	mswServer.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
	mswServer.resetHandlers();
});

afterAll(() => {
	mswServer.close();
});

describe("getLibraryContents", () => {
	test("fetches all items from a library", async () => {
		const items = await getLibraryContents({
			serverUrl: testServerUrl,
			authToken: testAuthToken,
			libraryId: testLibraryId,
		});

		expect(items).toHaveLength(THREE_ITEMS);
		expect(items[FIRST]!.title).toBe("The Matrix");
		expect(items[FIRST]!.type).toBe("movie");
		expect(items[FIRST]!.year).toBe(MATRIX_YEAR);
		expect(items[FIRST]!.ratingKey).toBe("101");
		expect(items[SECOND]!.title).toBe("Inception");
		expect(items[THIRD]!.title).toBe("Interstellar");
	});

	test("paginates through results with pageSize of 2 for 3 items", async () => {
		const requests: { start: number; size: number }[] = [];

		mswServer.use(
			http.get(`${testServerUrl}/library/sections/${testLibraryId}/all`, ({ request }) => {
				const url = new URL(request.url);
				const start = Number(url.searchParams.get("X-Plex-Container-Start") ?? "0");
				const size = Number(url.searchParams.get("X-Plex-Container-Size") ?? "200");
				requests.push({ start, size });

				const page = mockMovies.slice(start, start + size);
				return HttpResponse.json({
					MediaContainer: {
						totalSize: THREE_ITEMS,
						Metadata: page,
					},
				});
			}),
		);

		const items = await getLibraryContents({
			serverUrl: testServerUrl,
			authToken: testAuthToken,
			libraryId: testLibraryId,
			pageSize: 2,
		});

		expect(items).toHaveLength(THREE_ITEMS);
		expect(requests).toHaveLength(TWO_ITEMS);
		expect(requests[FIRST]).toStrictEqual({ start: 0, size: 2 });
		expect(requests[SECOND]).toStrictEqual({ start: 2, size: 2 });
	});

	test("handles empty library", async () => {
		mswServer.use(
			http.get(`${testServerUrl}/library/sections/${testLibraryId}/all`, () =>
				HttpResponse.json({
					MediaContainer: {
						totalSize: 0,
					},
				}),
			),
		);

		const items = await getLibraryContents({
			serverUrl: testServerUrl,
			authToken: testAuthToken,
			libraryId: testLibraryId,
		});

		expect(items).toStrictEqual([]);
	});

	test("extracts genres from Plex Genre tag format", async () => {
		const items = await getLibraryContents({
			serverUrl: testServerUrl,
			authToken: testAuthToken,
			libraryId: testLibraryId,
		});

		expect(items[FIRST]!.genres).toBe("Action,Sci-Fi");
		expect(items[SECOND]!.genres).toBe("Action,Thriller");
		expect(items[THIRD]!.genres).toBe("Sci-Fi,Drama");
	});

	test("handles items with no genres", async () => {
		mswServer.use(
			http.get(`${testServerUrl}/library/sections/${testLibraryId}/all`, () =>
				HttpResponse.json({
					MediaContainer: {
						totalSize: ONE_ITEM,
						Metadata: [
							{
								title: "No Genre Movie",
								type: "movie",
								year: 2020,
								ratingKey: "999",
							},
						],
					},
				}),
			),
		);

		const items = await getLibraryContents({
			serverUrl: testServerUrl,
			authToken: testAuthToken,
			libraryId: testLibraryId,
		});

		expect(items).toHaveLength(ONE_ITEM);
		expect(items[FIRST]!.genres).toBe("");
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.get(
				`${testServerUrl}/library/sections/${testLibraryId}/all`,
				() => new HttpResponse(undefined, { status: 500 }),
			),
		);

		await expect(
			getLibraryContents({
				serverUrl: testServerUrl,
				authToken: testAuthToken,
				libraryId: testLibraryId,
			}),
		).rejects.toThrow("Failed to get library contents");
	});
});
