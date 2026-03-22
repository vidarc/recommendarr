import { expect, test } from "@playwright/test";

test.describe("health checks", () => {
	test("GET /ping returns ok", async ({ request }) => {
		const response = await request.get("/ping");

		expect(response.ok()).toBe(true);
		expect(await response.json()).toEqual({ ping: "pong" });
	});

	test("GET /health returns ok with uptime", async ({ request }) => {
		const response = await request.get("/health");

		const body = await response.json();

		expect(body.status).toBe("ok");
		expect(typeof body.uptime).toBe("number");
	});
});
