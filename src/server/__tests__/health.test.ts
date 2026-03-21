import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";

const HEX_KEY_LENGTH = 64;

describe("GET /health", () => {
	test("returns status ok and uptimeSeconds", async () => {
		const expectedStatusCode = 200;
		process.env["ENCRYPTION_KEY"] = "a".repeat(HEX_KEY_LENGTH);
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
			delete process.env["ENCRYPTION_KEY"];
		});

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toStrictEqual(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			status: "ok",
			uptime: expect.any(Number),
		});
	});

	test("ping route", async () => {
		process.env["ENCRYPTION_KEY"] = "a".repeat(HEX_KEY_LENGTH);
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
			delete process.env["ENCRYPTION_KEY"];
		});

		const response = await app.inject().get("/ping");

		expect(response.json()).toStrictEqual({
			ping: "pong",
		});
	});
});
