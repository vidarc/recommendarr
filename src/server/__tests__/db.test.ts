import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { settings } from "../schema.ts";

const expectedTableCount = 3;
const firstIndex = 0;
const HEX_KEY_LENGTH = 64;
const testDbDir = join(tmpdir(), "recommendarr-test-db");
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

describe("database plugin", () => {
	test("initializes database and creates tables", async () => {
		const app = await setupDb();

		const rows = app.sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'settings', 'users')",
			)
			.all();
		expect(rows).toHaveLength(expectedTableCount);
	});

	test("enables WAL journal mode", async () => {
		const app = await setupDb();

		const result = app.sqlite.pragma("journal_mode") as { journal_mode: string }[];
		expect(result[firstIndex]?.journal_mode).toBe("wal");
	});

	test("seeds default app_version setting", async () => {
		const app = await setupDb();

		const rows = app.db.select().from(settings).where(eq(settings.key, "app_version")).all();
		expect(rows[firstIndex]?.value).toBe("1.0.0");
	});

	test("does not overwrite existing app_version on restart", async () => {
		vi.stubEnv("DATABASE_PATH", testDbPath);
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
		const firstApp = await buildServer({ skipSSR: true });

		firstApp.db
			.update(settings)
			.set({ value: "2.0.0" })
			.where(eq(settings.key, "app_version"))
			.run();
		await firstApp.close();

		const secondApp = await buildServer({ skipSSR: true });

		onTestFinished(async () => {
			await secondApp.close();
			vi.unstubAllEnvs();
			if (existsSync(testDbDir)) {
				rmSync(testDbDir, { recursive: true });
			}
		});

		const rows = secondApp.db.select().from(settings).where(eq(settings.key, "app_version")).all();
		expect(rows[firstIndex]?.value).toBe("2.0.0");
	});

	test("creates data directory if it does not exist", async () => {
		const nestedDir = join(tmpdir(), "recommendarr-test-nested", "deep");
		const nestedPath = join(nestedDir, "test.db");
		vi.stubEnv("DATABASE_PATH", nestedPath);
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));

		const app = await buildServer({ skipSSR: true });

		onTestFinished(async () => {
			await app.close();
			vi.unstubAllEnvs();
			rmSync(join(tmpdir(), "recommendarr-test-nested"), { recursive: true });
		});

		expect(existsSync(nestedDir)).toBe(true);
		expect(existsSync(nestedPath)).toBe(true);
	});

	test("closes database on server close", async () => {
		vi.stubEnv("DATABASE_PATH", testDbPath);
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
		const app = await buildServer({ skipSSR: true });

		onTestFinished(() => {
			vi.unstubAllEnvs();
			if (existsSync(testDbDir)) {
				rmSync(testDbDir, { recursive: true });
			}
		});

		expect(app.sqlite.open).toBe(true);
		await app.close();
		expect(app.sqlite.open).toBe(false);
	});
});
