import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { users } from "../schema.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const testDbDir = join(tmpdir(), "recommendarr-test-auth-middleware");
const testDbPath = join(testDbDir, "test.db");

const testUser = { username: "testuser", password: "password123" };

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

const getSessionCookie = async (
	app: Awaited<ReturnType<typeof buildServer>>,
	credentials = testUser,
) => {
	await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: credentials,
	});

	const user = app.db.select().from(users).where(eq(users.username, credentials.username)).get();

	if (!user) {
		throw new Error("User not found after registration");
	}

	const userId = user.id;

	const session = createSession(app.db, userId);
	return session.id;
};

describe("auth middleware", () => {
	test("returns 401 without session cookie on /api/settings", async () => {
		const app = await setupDb();

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		expect(response.json()).toStrictEqual({ error: "Authentication required" });
	});

	test("returns 200 with valid session cookie on /api/settings", async () => {
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
	});

	test("public auth routes work without session", async () => {
		const app = await setupDb();

		const setupResponse = await app.inject({
			method: "GET",
			url: "/api/auth/setup-status",
		});
		expect(setupResponse.statusCode).toBe(StatusCodes.OK);

		const registerResponse = await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: testUser,
		});
		expect(registerResponse.statusCode).toBe(StatusCodes.CREATED);

		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: testUser,
		});
		expect(loginResponse.statusCode).toBe(StatusCodes.OK);
	});

	test("returns 401 with invalid session cookie", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: "invalid-session-id" },
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
		expect(response.json()).toStrictEqual({ error: "Invalid or expired session" });
	});
});

describe("auth routes with sessions", () => {
	test("login sets a session cookie", async () => {
		const app = await setupDb();

		await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: testUser,
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: testUser,
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const { cookies } = response;
		const sessionCookie = cookies.find((ck) => ck.name === "session");
		expect(sessionCookie).toBeDefined();
		expect(sessionCookie?.httpOnly).toBe(true);
	});

	test("register sets a session cookie", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: testUser,
		});

		expect(response.statusCode).toBe(StatusCodes.CREATED);
		const { cookies } = response;
		const sessionCookie = cookies.find((ck) => ck.name === "session");
		expect(sessionCookie).toBeDefined();
		expect(sessionCookie?.httpOnly).toBe(true);
	});

	test("GET /api/auth/me returns user with valid session", async () => {
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/auth/me",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.username).toBe(testUser.username);
		expect(body.id).toBeDefined();
		expect(body.isAdmin).toBe(true);
	});

	test("GET /api/auth/me returns 401 without session", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "GET",
			url: "/api/auth/me",
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});

	test("POST /api/auth/logout clears session and cookie", async () => {
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/logout",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json()).toStrictEqual({ success: true });

		// Verify session is no longer valid
		const meResponse = await app.inject({
			method: "GET",
			url: "/api/auth/me",
			cookies: { session: sessionId },
		});
		expect(meResponse.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});
});
