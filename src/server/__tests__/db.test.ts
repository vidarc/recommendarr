import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { buildServer } from "../app.ts";

const expectedTableCount = 1;
const firstIndex = 0;
const testDbDir = join(tmpdir(), "recommendarr-test-db");
const testDbPath = join(testDbDir, "test.db");

afterEach(() => {
	if (existsSync(testDbDir)) {
		rmSync(testDbDir, { recursive: true });
	}
});

describe("database plugin", () => {
	test("initializes database and creates settings table", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		const rows = app.db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
			.all();
		expect(rows).toHaveLength(expectedTableCount);

		await app.close();
		delete process.env["DATABASE_PATH"];
	});

	test("enables WAL journal mode", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		const result = app.db.pragma("journal_mode") as { journal_mode: string }[];
		expect(result[firstIndex]?.journal_mode).toBe("wal");

		await app.close();
		delete process.env["DATABASE_PATH"];
	});

	test("seeds default app_version setting", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		const row = app.db.prepare("SELECT value FROM settings WHERE key = ?").get("app_version") as
			| { value: string }
			| undefined;
		expect(row?.value).toBe("1.0.0");

		await app.close();
		delete process.env["DATABASE_PATH"];
	});

	test("closes database on server close", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		expect(app.db.open).toBe(true);
		await app.close();
		expect(app.db.open).toBe(false);

		delete process.env["DATABASE_PATH"];
	});
});
