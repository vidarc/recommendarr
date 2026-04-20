import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { describe, expect, onTestFinished, it, vi } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { conversations, messages, recommendations, users } from "../schema.ts";
import { hashPassword } from "../services/auth-utils.ts";
import { createSession } from "../services/session.ts";

const HEX_KEY_LENGTH = 64;

const testUser = { username: "testuser", password: "password123" };

const setupDb = async () => {
	const testDbDir = join(tmpdir(), `recommendarr-test-feedback-${randomUUID()}`);
	const testDbPath = join(testDbDir, "test.db");

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

const getSessionCookie = async (app: Awaited<ReturnType<typeof buildServer>>) => {
	await app.inject({
		method: "POST",
		url: "/api/auth/register",
		payload: testUser,
	});

	const user = app.db.select().from(users).where(eq(users.username, testUser.username)).get();

	if (!user) {
		throw new Error("User not found after registration");
	}

	const session = createSession(app.db, user.id);
	return { sessionId: session.id, userId: user.id };
};

const seedRecommendation = (app: Awaited<ReturnType<typeof buildServer>>, userId: string) => {
	const now = new Date().toISOString();
	const conversationId = randomUUID();
	const messageId = randomUUID();
	const recId = randomUUID();

	app.db
		.insert(conversations)
		.values({
			id: conversationId,
			userId,
			mediaType: "movie",
			title: "Test Conversation",
			createdAt: now,
		})
		.run();

	app.db
		.insert(messages)
		.values({
			id: messageId,
			conversationId,
			role: "assistant",
			content: "Here are some recommendations.",
			createdAt: now,
		})
		.run();

	app.db
		.insert(recommendations)
		.values({
			id: recId,
			messageId,
			title: "The Matrix",
			year: 1999,
			mediaType: "movie",
			synopsis: "A hacker discovers reality is a simulation.",
		})
		.run();

	return { conversationId, messageId, recId };
};

describe("pATCH /api/recommendations/:id/feedback", () => {
	it("sets feedback to liked", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "liked" },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		const body = response.json();
		expect(body.id).toBe(recId);
		expect(body.feedback).toBe("liked");

		// Verify DB state
		const rec = app.db.select().from(recommendations).where(eq(recommendations.id, recId)).get();
		expect(rec?.feedback).toBe("liked");
	});

	it("sets feedback to disliked", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "disliked" },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json().feedback).toBe("disliked");
	});

	it("clears feedback by sending null", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		// First set feedback
		await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "liked" },
		});

		// Then clear it
		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			// oxlint-disable-next-line unicorn/no-null
			payload: { feedback: null },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		// oxlint-disable-next-line unicorn/no-null
		expect(response.json().feedback).toBeNull();

		// Verify DB state
		const rec = app.db.select().from(recommendations).where(eq(recommendations.id, recId)).get();
		// oxlint-disable-next-line unicorn/no-null
		expect(rec?.feedback).toBeNull();
	});

	it("toggles feedback from liked to disliked", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		// Set to liked
		await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "liked" },
		});

		// Toggle to disliked
		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "disliked" },
		});

		expect(response.statusCode).toBe(StatusCodes.OK);
		expect(response.json().feedback).toBe("disliked");

		// Verify DB state
		const rec = app.db.select().from(recommendations).where(eq(recommendations.id, recId)).get();
		expect(rec?.feedback).toBe("disliked");
	});

	it("returns 404 for non-existent recommendation", async () => {
		const app = await setupDb();
		const { sessionId } = await getSessionCookie(app);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${randomUUID()}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "liked" },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		expect(response.json().error).toBe("Recommendation not found");
	});

	it("returns 404 for recommendation belonging to another user", async () => {
		const app = await setupDb();
		const { userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		// Create a second user directly in DB (registration is disabled after first user)
		const otherUserId = randomUUID();
		app.db
			.insert(users)
			.values({
				id: otherUserId,
				username: "otheruser",
				passwordHash: await hashPassword("password456"),
				isAdmin: false,
				createdAt: new Date().toISOString(),
			})
			.run();

		const otherSession = createSession(app.db, otherUserId);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: otherSession.id },
			payload: { feedback: "liked" },
		});

		expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
		expect(response.json().error).toBe("Recommendation not found");
	});

	it("returns 401 without session cookie", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${randomUUID()}/feedback`,
			payload: { feedback: "liked" },
		});

		expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
	});

	it("rejects invalid feedback values", async () => {
		const app = await setupDb();
		const { sessionId, userId } = await getSessionCookie(app);
		const { recId } = seedRecommendation(app, userId);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/recommendations/${recId}/feedback`,
			cookies: { session: sessionId },
			payload: { feedback: "love" },
		});

		expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
	});
});
