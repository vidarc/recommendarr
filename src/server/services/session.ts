import { randomUUID } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { sessions } from "../schema.ts";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_SESSION_DURATION_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const MIN_DURATION_DAYS = 0;

const getSessionDurationMs = (): number => {
	const envDays = process.env["SESSION_DURATION_DAYS"];
	if (!envDays) {
		return DEFAULT_SESSION_DURATION_DAYS * MS_PER_DAY;
	}
	const days = Number(envDays);
	if (!Number.isFinite(days) || days <= MIN_DURATION_DAYS) {
		throw new Error(
			`Invalid SESSION_DURATION_DAYS value: "${envDays}". Must be a positive number.`,
		);
	}
	return days * MS_PER_DAY;
};

const createSession = <TSchema extends Record<string, unknown>>(
	db: BetterSQLite3Database<TSchema>,
	userId: string,
) => {
	const id = randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + getSessionDurationMs());

	const session = {
		id,
		userId,
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	};

	db.insert(sessions).values(session).run();

	return session;
};

const getSession = <TSchema extends Record<string, unknown>>(
	db: BetterSQLite3Database<TSchema>,
	sessionId: string,
) => {
	const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

	if (!session) {
		return undefined;
	}

	if (new Date(session.expiresAt) <= new Date()) {
		return undefined;
	}

	return session;
};

const deleteSession = <TSchema extends Record<string, unknown>>(
	db: BetterSQLite3Database<TSchema>,
	sessionId: string,
) => {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
};

const purgeExpiredSessions = <TSchema extends Record<string, unknown>>(
	db: BetterSQLite3Database<TSchema>,
) => {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
};

export { createSession, deleteSession, getSession, purgeExpiredSessions };
