import { afterEach, describe, expect, onTestFinished, it, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";

const HEX_KEY_LENGTH = 64;

describe("gET /health", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns status ok and uptimeSeconds", async () => {
		const expectedStatusCode = 200;
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
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

	it("ping route", async () => {
		vi.stubEnv("ENCRYPTION_KEY", "a".repeat(HEX_KEY_LENGTH));
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
