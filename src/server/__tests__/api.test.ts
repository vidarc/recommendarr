import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { buildServer } from "../app.ts";

const testDbDir = join(tmpdir(), "recommendarr-test-api");
const testDbPath = join(testDbDir, "test.db");

afterEach(() => {
	if (existsSync(testDbDir)) {
		rmSync(testDbDir, { recursive: true });
	}
});

describe("GET /api/settings", () => {
	test("returns settings as key-value object", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const expectedStatusCode = 200;
		const app = await buildServer({ skipSSR: true });

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
		});

		await app.close();
		delete process.env["DATABASE_PATH"];
	});

	test("returns additional settings when inserted", async () => {
		process.env["DATABASE_PATH"] = testDbPath;
		const app = await buildServer({ skipSSR: true });

		app.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("theme", "dark");

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
			theme: "dark",
		});

		await app.close();
		delete process.env["DATABASE_PATH"];
	});
});
