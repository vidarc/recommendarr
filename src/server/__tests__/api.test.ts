import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, onTestFinished, test } from "vite-plus/test";
import { buildServer } from "../app.ts";
import { settings } from "../schema.ts";

const testDbDir = join(tmpdir(), "recommendarr-test-api");
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

describe("GET /api/settings", () => {
	test("returns settings as key-value object", async () => {
		const expectedStatusCode = 200;
		const app = await setupDb();

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
		});
	});

	test("returns additional settings when inserted", async () => {
		const app = await setupDb();

		app.db.insert(settings).values({ key: "theme", value: "dark" }).run();

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
			theme: "dark",
		});
	});

	test("returns empty object when no settings exist", async () => {
		const app = await setupDb();

		app.db.delete(settings).run();

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.json()).toStrictEqual({});
	});

	test("returns 404 for unknown API routes", async () => {
		const expectedStatusCode = 404;
		const app = await setupDb();

		const response = await app.inject({ method: "GET", url: "/api/unknown" });

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});

describe("skipDB option", () => {
	test("does not register /api/settings when skipDB is true", async () => {
		const expectedStatusCode = 404;
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
		});

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});
