import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, onTestFinished, test } from "vite-plus/test";
import { buildServer } from "../app.ts";

const expectedTableCount = 1;
const firstIndex = 0;
const testDbDir = join(tmpdir(), "recommendarr-test-db");
const testDbPath = join(testDbDir, "test.db");

const setupDb = async () => {
	process.env["DATABASE_PATH"] = testDbPath;
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		delete process.env["DATABASE_PATH"];
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true });
		}
	});

	return app;
};

describe("database plugin", () => {
	test("initializes database and creates settings table", async () => {
		const app = await setupDb();

		const rows = app.db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
			.all();
		expect(rows).toHaveLength(expectedTableCount);
	});

	test("enables WAL journal mode", async () => {
		const app = await setupDb();

		const result = app.db.pragma("journal_mode") as { journal_mode: string }[];
		expect(result[firstIndex]?.journal_mode).toBe("wal");
	});

	test("seeds default app_version setting", async () => {
		const app = await setupDb();

		const row = app.db.prepare("SELECT value FROM settings WHERE key = ?").get("app_version") as
			| { value: string }
			| undefined;
		expect(row?.value).toBe("1.0.0");
	});

	test("does not overwrite existing app_version on restart", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const firstApp = await buildServer({ skipSSR: true });

		firstApp.db.prepare("UPDATE settings SET value = ? WHERE key = ?").run("2.0.0", "app_version");
		await firstApp.close();

		const secondApp = await buildServer({ skipSSR: true });

		onTestFinished(async () => {
			await secondApp.close();
			delete process.env["DATABASE_PATH"];
			if (existsSync(testDbDir)) {
				rmSync(testDbDir, { recursive: true });
			}
		});

		const row = secondApp.db
			.prepare("SELECT value FROM settings WHERE key = ?")
			.get("app_version") as { value: string } | undefined;
		expect(row?.value).toBe("2.0.0");
	});

	test("creates data directory if it does not exist", async () => {
		const nestedDir = join(tmpdir(), "recommendarr-test-nested", "deep");
		const nestedPath = join(nestedDir, "test.db");
		process.env["DATABASE_PATH"] = nestedPath;

		const app = await buildServer({ skipSSR: true });

		onTestFinished(async () => {
			await app.close();
			delete process.env["DATABASE_PATH"];
			rmSync(join(tmpdir(), "recommendarr-test-nested"), { recursive: true });
		});

		expect(existsSync(nestedDir)).toBe(true);
		expect(existsSync(nestedPath)).toBe(true);
	});

	test("closes database on server close", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		onTestFinished(() => {
			delete process.env["DATABASE_PATH"];
			if (existsSync(testDbDir)) {
				rmSync(testDbDir, { recursive: true });
			}
		});

		expect(app.db.open).toBe(true);
		await app.close();
		expect(app.db.open).toBe(false);
	});
});
