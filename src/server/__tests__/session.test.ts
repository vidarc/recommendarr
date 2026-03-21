import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { sessions } from "../schema.ts";
import {
	createSession,
	deleteSession,
	getSession,
	purgeExpiredSessions,
} from "../services/session.ts";

const expectedSessionsTableCount = 1;
const expectedOneSession = 1;
const firstIndex = 0;
const HEX_KEY_LENGTH = 64;
const pastOffsetMs = 1000;
const testDbDir = join(tmpdir(), "recommendarr-test-session");
const testDbPath = join(testDbDir, "test.db");

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

describe("sessions table", () => {
	test("sessions table exists in database", async () => {
		const app = await setupDb();

		const rows = app.sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
			.all();
		expect(rows).toHaveLength(expectedSessionsTableCount);
	});
});

describe("session service", () => {
	test("createSession creates a session row and returns it", async () => {
		const app = await setupDb();
		const userId = randomUUID();

		const session = createSession(app.db, userId);

		expect(session.id).toBeDefined();
		expect(session.userId).toBe(userId);
		expect(session.createdAt).toBeDefined();
		expect(session.expiresAt).toBeDefined();
		expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(
			new Date(session.createdAt).getTime(),
		);
	});

	test("getSession returns a valid non-expired session", async () => {
		const app = await setupDb();
		const userId = randomUUID();
		const created = createSession(app.db, userId);

		const retrieved = getSession(app.db, created.id);

		expect(retrieved).toBeDefined();
		expect(retrieved?.id).toBe(created.id);
		expect(retrieved?.userId).toBe(userId);
	});

	test("getSession returns undefined for non-existent session", async () => {
		const app = await setupDb();

		const result = getSession(app.db, "non-existent-id");

		expect(result).toBeUndefined();
	});

	test("getSession returns undefined for expired session", async () => {
		const app = await setupDb();
		const userId = randomUUID();
		const pastDate = new Date(Date.now() - pastOffsetMs).toISOString();

		app.db
			.insert(sessions)
			.values({
				id: randomUUID(),
				userId,
				createdAt: pastDate,
				expiresAt: pastDate,
			})
			.run();

		const allSessions = app.db.select().from(sessions).all();
		const result = getSession(app.db, allSessions[firstIndex]!.id);

		expect(result).toBeUndefined();
	});

	test("deleteSession removes a session", async () => {
		const app = await setupDb();
		const userId = randomUUID();
		const session = createSession(app.db, userId);

		deleteSession(app.db, session.id);

		const result = getSession(app.db, session.id);
		expect(result).toBeUndefined();
	});

	test("purgeExpiredSessions removes only expired sessions", async () => {
		const app = await setupDb();
		const userId = randomUUID();
		const pastDate = new Date(Date.now() - pastOffsetMs).toISOString();

		// Create an expired session directly
		app.db
			.insert(sessions)
			.values({
				id: randomUUID(),
				userId,
				createdAt: pastDate,
				expiresAt: pastDate,
			})
			.run();

		// Create a valid session
		const validSession = createSession(app.db, userId);

		purgeExpiredSessions(app.db);

		const remaining = app.db.select().from(sessions).all();
		expect(remaining).toHaveLength(expectedOneSession);
		expect(remaining[firstIndex]?.id).toBe(validSession.id);
	});
});
