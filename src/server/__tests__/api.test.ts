import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { settings, users } from "../schema.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;
const testDbDir = join(tmpdir(), "recommendarr-test-api");
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

	const userId = user.id;

	const session = createSession(app.db, userId);
	return session.id;
};

describe("GET /api/settings", () => {
	test("returns settings as key-value object", async () => {
		const expectedStatusCode = 200;
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
		});
	});

	test("returns additional settings when inserted", async () => {
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		app.db.insert(settings).values({ key: "theme", value: "dark" }).run();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: sessionId },
		});

		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
			theme: "dark",
		});
	});

	test("returns empty object when no settings exist", async () => {
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		app.db.delete(settings).run();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: sessionId },
		});

		expect(response.json()).toStrictEqual({});
	});

	test("returns 404 for unknown API routes", async () => {
		const expectedStatusCode = 404;
		const app = await setupDb();
		const sessionId = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/unknown",
			cookies: { session: sessionId },
		});

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});

describe("skipDB option", () => {
	test("does not register /api/settings when skipDB is true", async () => {
		const expectedStatusCode = 404;
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
			vi.unstubAllEnvs();
		});

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});
