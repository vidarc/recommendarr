import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";

describe("GET /health", () => {
	test("returns status ok and uptimeSeconds", async () => {
		const expectedStatusCode = 200;
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
		});

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toStrictEqual(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			status: "ok",
			uptime: expect.any(Number),
		});
	});

	test("ping route", async () => {
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
		});

		const response = await app.inject().get("/ping");

		expect(response.json()).toStrictEqual({
			ping: "pong",
		});
	});
});
