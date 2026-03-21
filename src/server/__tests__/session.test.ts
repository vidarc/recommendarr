import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";

const expectedSessionsTableCount = 1;
const testDbDir = join(tmpdir(), "recommendarr-test-session");
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

describe("sessions table", () => {
	test("sessions table exists in database", async () => {
		const app = await setupDb();

		const rows = app.sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
			.all();
		expect(rows).toHaveLength(expectedSessionsTableCount);
	});
});
