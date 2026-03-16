import { describe, expect, test } from "vite-plus/test";

import { buildServer } from "../app.ts";

describe("GET /health", () => {
	test("returns status ok and uptimeSeconds", async () => {
		const app = await buildServer();
		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);

		expect(response.json()).toStrictEqual({
			status: "ok",
			uptime: expect.any(Number),
		});
	});

	test("ping route", async () => {
		const app = await buildServer();

		const response = await app.inject().get("/ping");

		expect(response.json()).toStrictEqual({
			ping: "pong",
		});
	});
});
