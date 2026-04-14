import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	onTestFinished,
	test,
	vi,
} from "vite-plus/test";

import { buildServer } from "../app.ts";
import { plexConnections, users } from "../schema.ts";
import { encrypt } from "../services/encryption.ts";
import {
	checkPlexPin,
	createPlexPin,
	getPlexLibraries,
	getPlexServers,
	getWatchHistory,
} from "../services/plex-api.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const MOCK_PIN_ID = 12_345;
const MOCK_PENDING_PIN_ID = 99_999;
const ONE_SERVER = 1;
const ONE_CONNECTION = 1;
const TWO_ITEMS = 2;
const THREE_LIBRARIES = 3;
const FIRST = 0;
const SECOND = 1;

const testDbDir = join(tmpdir(), "recommendarr-test-plex");
const testDbPath = join(testDbDir, "test.db");
const testUser = { username: "testuser", password: "password123" };
const testServerUrl = "https://test-server.plex.direct:32400";

const mockPinResponse = {
	id: MOCK_PIN_ID,
	code: "ABCD1234",
};

const mockPinCheckClaimedResponse = {
	id: MOCK_PIN_ID,
	code: "ABCD1234",
	authToken: "plex-auth-token-xyz",
};

const mockPinCheckPendingResponse = {
	id: MOCK_PIN_ID,
	code: "ABCD1234",
	// oxlint-disable-next-line unicorn/no-null
	authToken: null,
};

const mockResourcesResponse = [
	{
		name: "My Plex Server",
		provides: "server",
		owned: true,
		clientIdentifier: "server-machine-id-123",
		connections: [
			{
				address: "192.168.1.100",
				port: 32_400,
				protocol: "http",
				uri: "http://192.168.1.100:32400",
				local: true,
			},
			{
				address: "my-server.plex.direct",
				port: 32_400,
				protocol: "https",
				uri: "https://my-server.plex.direct:32400",
				local: false,
			},
		],
	},
	{
		name: "A Player",
		provides: "player",
		owned: true,
		clientIdentifier: "player-id",
		connections: [
			{
				address: "192.168.1.50",
				port: 32_500,
				protocol: "http",
				uri: "http://192.168.1.50:32500",
				local: true,
			},
		],
	},
];

const mockLibrariesResponse = {
	MediaContainer: {
		Directory: [
			{ key: "1", title: "Movies", type: "movie" },
			{ key: "2", title: "TV Shows", type: "show" },
			{ key: "3", title: "Music", type: "artist" },
		],
	},
};

const mockHistoryResponse = {
	MediaContainer: {
		Metadata: [
			{
				title: "Episode 1",
				type: "episode",
				year: 2024,
				ratingKey: "100",
				grandparentTitle: "Some Show",
				parentIndex: 1,
				index: 1,
				viewedAt: 1_700_000_000,
			},
			{
				title: "A Movie",
				type: "movie",
				year: 2023,
				ratingKey: "200",
				viewedAt: 1_699_999_000,
			},
		],
	},
};

const handlers = [
	http.post("https://plex.tv/api/v2/pins", () => HttpResponse.json(mockPinResponse)),
	http.get(`https://plex.tv/api/v2/pins/${MOCK_PIN_ID.toString()}`, () =>
		HttpResponse.json(mockPinCheckClaimedResponse),
	),
	http.get(`https://plex.tv/api/v2/pins/${MOCK_PENDING_PIN_ID.toString()}`, () =>
		HttpResponse.json(mockPinCheckPendingResponse),
	),
	http.get("https://plex.tv/api/v2/resources", () => HttpResponse.json(mockResourcesResponse)),
	http.get(`${testServerUrl}/library/sections`, () => HttpResponse.json(mockLibrariesResponse)),
	http.get(`${testServerUrl}/library/all`, () => HttpResponse.json(mockHistoryResponse)),
	http.get(`${testServerUrl}/library/sections/1/allLeaves`, () =>
		HttpResponse.json(mockHistoryResponse),
	),
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

// --- Plex API client tests ---

describe("createPlexPin", () => {
	test("creates a PIN and returns id, code, and authUrl", async () => {
		const result = await createPlexPin();

		expect(result.id).toBe(MOCK_PIN_ID);
		expect(result.code).toBe("ABCD1234");
		expect(result.authUrl).toContain("app.plex.tv/auth");
		expect(result.authUrl).toContain("ABCD1234");
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.post("https://plex.tv/api/v2/pins", () => new HttpResponse(undefined, { status: 500 })),
		);

		await expect(createPlexPin()).rejects.toThrow("Failed to create Plex PIN");
	});
});

describe("checkPlexPin", () => {
	test("returns auth token when PIN is claimed", async () => {
		const result = await checkPlexPin(MOCK_PIN_ID);

		expect(result.authToken).toBe("plex-auth-token-xyz");
	});

	test("returns undefined when PIN is not yet claimed", async () => {
		const result = await checkPlexPin(MOCK_PENDING_PIN_ID);

		expect(result.authToken).toBeUndefined();
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.get(
				`https://plex.tv/api/v2/pins/${MOCK_PIN_ID.toString()}`,
				() => new HttpResponse(undefined, { status: 404 }),
			),
		);

		await expect(checkPlexPin(MOCK_PIN_ID)).rejects.toThrow("Failed to check Plex PIN");
	});
});

describe("getPlexServers", () => {
	test("returns only server resources with remote connections preferred", async () => {
		const servers = await getPlexServers("test-token");

		expect(servers).toHaveLength(ONE_SERVER);
		expect(servers[FIRST]!.name).toBe("My Plex Server");
		expect(servers[FIRST]!.uri).toBe("https://my-server.plex.direct:32400");
		expect(servers[FIRST]!.clientIdentifier).toBe("server-machine-id-123");
		expect(servers[FIRST]!.owned).toBe(true);
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.get(
				"https://plex.tv/api/v2/resources",
				() => new HttpResponse(undefined, { status: 401 }),
			),
		);

		await expect(getPlexServers("bad-token")).rejects.toThrow("Failed to get Plex servers");
	});
});

describe("getPlexLibraries", () => {
	test("returns libraries from server", async () => {
		const libraries = await getPlexLibraries(testServerUrl, "test-token");

		expect(libraries).toHaveLength(THREE_LIBRARIES);
		expect(libraries[FIRST]).toStrictEqual({
			key: "1",
			title: "Movies",
			type: "movie",
		});
		expect(libraries[SECOND]).toStrictEqual({
			key: "2",
			title: "TV Shows",
			type: "show",
		});
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.get(
				`${testServerUrl}/library/sections`,
				() => new HttpResponse(undefined, { status: 500 }),
			),
		);

		await expect(getPlexLibraries(testServerUrl, "test-token")).rejects.toThrow(
			"Failed to get Plex libraries",
		);
	});
});

describe("getWatchHistory", () => {
	test("returns watch history items", async () => {
		const items = await getWatchHistory({
			serverUrl: testServerUrl,
			authToken: "test-token",
		});

		expect(items).toHaveLength(TWO_ITEMS);
		expect(items[FIRST]!.title).toBe("Episode 1");
		expect(items[FIRST]!.grandparentTitle).toBe("Some Show");
		expect(items[SECOND]!.title).toBe("A Movie");
		expect(items[SECOND]!.type).toBe("movie");
	});

	test("returns history for a specific library", async () => {
		const items = await getWatchHistory({
			serverUrl: testServerUrl,
			authToken: "test-token",
			libraryId: "1",
		});

		expect(items).toHaveLength(TWO_ITEMS);
	});

	test("returns empty array when no metadata present", async () => {
		mswServer.use(
			http.get(`${testServerUrl}/library/all`, () => HttpResponse.json({ MediaContainer: {} })),
		);

		const items = await getWatchHistory({
			serverUrl: testServerUrl,
			authToken: "test-token",
		});

		expect(items).toStrictEqual([]);
	});

	test("throws on non-ok response", async () => {
		mswServer.use(
			http.get(`${testServerUrl}/library/all`, () => new HttpResponse(undefined, { status: 500 })),
		);

		await expect(
			getWatchHistory({ serverUrl: testServerUrl, authToken: "test-token" }),
		).rejects.toThrow("Failed to get watch history");
	});
});

// --- Plex route tests ---

const setupDb = async () => {
	vi.stubEnv("DATABASE_PATH", testDbPath);
	vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		vi.unstubAllEnvs();
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true });
		}
	});

	return app;
};

const getSessionCookie = async (app: Awaited<ReturnType<typeof buildServer>>) => {
	await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: testUser,
	});

	const user = app.db.select().from(users).where(eq(users.username, testUser.username)).get();

	if (!user) {
		throw new Error("User not found after registration");
	}

	const session = createSession(app.db, user.id);
	return { sessionId: session.id, userId: user.id };
};

const insertPlexConnection = (
	app: Awaited<ReturnType<typeof buildServer>>,
	userId: string,
	overrides: Partial<{
		serverUrl: string | undefined;
		serverName: string | undefined;
		machineIdentifier: string | undefined;
	}> = {},
) => {
	const now = new Date().toISOString();
	const hasServerUrl = "serverUrl" in overrides;
	const hasServerName = "serverName" in overrides;
	const hasMachineId = "machineIdentifier" in overrides;
	app.db
		.insert(plexConnections)
		.values({
			id: "test-plex-conn-id",
			userId,
			authToken: encrypt("plex-auth-token-xyz"),
			serverUrl: hasServerUrl ? overrides.serverUrl : testServerUrl,
			serverName: hasServerName ? overrides.serverName : "My Plex Server",
			machineIdentifier: hasMachineId ? overrides.machineIdentifier : "server-machine-id-123",
			createdAt: now,
			updatedAt: now,
		})
		.run();
};

describe("POST /api/plex/auth/start", () => {
	test("returns pinId and authUrl", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/auth/start",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.pinId).toBe(MOCK_PIN_ID);
		expect(body.authUrl).toContain("app.plex.tv/auth");
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/auth/start",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("GET /api/plex/auth/check", () => {
	test("returns claimed status with auth token", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: `/api/plex/auth/check?pinId=${MOCK_PIN_ID.toString()}`,
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.claimed).toBe(true);

		// Verify the connection was saved to the database
		const connection = app.db
			.select()
			.from(plexConnections)
			.where(eq(plexConnections.userId, userId))
			.get();
		expect(connection).toBeDefined();
	});

	test("returns pending status when PIN not yet claimed", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: `/api/plex/auth/check?pinId=${MOCK_PENDING_PIN_ID.toString()}`,
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.claimed).toBe(false);
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "GET",
			url: `/api/plex/auth/check?pinId=${MOCK_PIN_ID.toString()}`,
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("GET /api/plex/servers", () => {
	test("returns server list when Plex connection exists", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId);

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/servers",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.selected).toBe(true);
		expect(body.servers).toHaveLength(ONE_SERVER);
		expect(body.servers[FIRST].name).toBe("My Plex Server");
	});

	test("returns unselected server list when connection has no stored serverUrl", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId, {
			serverUrl: undefined,
			serverName: undefined,
			machineIdentifier: undefined,
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/servers",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.selected).toBe(false);
	});

	test("returns 404 when no Plex connection exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/servers",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	test("returns stored server when serverUrl is set (skips Plex API)", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);

		// Manually insert a connection with serverUrl set (simulates manual auth)
		const now = new Date().toISOString();
		app.db
			.insert(plexConnections)
			.values({
				id: randomUUID(),
				userId,
				authToken: encrypt("fake-token"),
				serverUrl: "http://my-plex:32400",
				serverName: "My Manual Server",
				machineIdentifier: "manual-abc",
				createdAt: now,
				updatedAt: now,
			})
			.run();

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/servers",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.selected).toBe(true);
		expect(body.servers).toHaveLength(ONE_SERVER);
		expect(body.servers[FIRST].name).toBe("My Manual Server");
		expect(body.servers[FIRST].uri).toBe("http://my-plex:32400");
		expect(body.servers[FIRST].owned).toBe(true);
	});
});

describe("POST /api/plex/auth/manual", () => {
	test("stores connection and returns success", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/auth/manual",
			payload: {
				authToken: "manual-test-token-123",
				serverUrl: "http://192.168.1.100:32400",
				serverName: "My Local Server",
			},
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		const connections = app.db.select().from(plexConnections).all();

		expect(connections).toHaveLength(ONE_CONNECTION);
		expect(connections[FIRST]?.serverUrl).toBe("http://192.168.1.100:32400");
		expect(connections[FIRST]?.serverName).toBe("My Local Server");
	});

	test("returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/auth/manual",
			payload: {
				authToken: "token",
				serverUrl: "http://192.168.1.100:32400",
				serverName: "Server",
			},
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});

describe("POST /api/plex/servers/select", () => {
	test("saves selected server to plex connection", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId, {
			serverUrl: undefined,
			serverName: undefined,
			machineIdentifier: undefined,
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/servers/select",
			cookies: { session: sessionId },
			payload: {
				serverUrl: "https://new-server.plex.direct:32400",
				serverName: "New Server",
				machineIdentifier: "new-machine-id",
			},
		});

		expect(response.statusCode).toBe(StatusCodes.OK);

		const connection = app.db
			.select()
			.from(plexConnections)
			.where(eq(plexConnections.userId, userId))
			.get();
		expect(connection?.serverUrl).toBe("https://new-server.plex.direct:32400");
		expect(connection?.serverName).toBe("New Server");
		expect(connection?.machineIdentifier).toBe("new-machine-id");
	});

	test("returns 404 when no Plex connection exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/plex/servers/select",
			cookies: { session: sessionId },
			payload: {
				serverUrl: "https://server.plex.direct:32400",
				serverName: "Server",
				machineIdentifier: "machine-id",
			},
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});
});

describe("DELETE /api/plex/connection", () => {
	test("removes Plex connection", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId);

		const response = await app.inject({
			method: "DELETE",
			url: "/api/plex/connection",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		const connection = app.db
			.select()
			.from(plexConnections)
			.where(eq(plexConnections.userId, userId))
			.get();
		expect(connection).toBeUndefined();
	});

	test("returns 404 when no connection exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "DELETE",
			url: "/api/plex/connection",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});
});

describe("GET /api/plex/libraries", () => {
	test("returns libraries when server is selected", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId);

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/libraries",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.libraries).toHaveLength(THREE_LIBRARIES);
		expect(body.libraries[FIRST].title).toBe("Movies");
	});

	test("returns 404 when no connection exists", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/libraries",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
	});

	test("returns 400 when no server is selected", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		insertPlexConnection(app, userId, {
			serverUrl: undefined,
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/plex/libraries",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
	});
});
