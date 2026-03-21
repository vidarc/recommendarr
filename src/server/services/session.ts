import { randomUUID } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { sessions } from "../schema.ts";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_SESSION_DURATION_DAYS = 7;
const MS_PER_DAY = 86_400_000;

type DbSchema = {
	sessions: typeof sessions;
};

const getSessionDurationMs = (): number => {
	const envDays = process.env["SESSION_DURATION_DAYS"];
	const days = envDays ? Number(envDays) : DEFAULT_SESSION_DURATION_DAYS;
	return days * MS_PER_DAY;
};

const createSession = (db: BetterSQLite3Database<DbSchema>, userId: string) => {
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

const getSession = (db: BetterSQLite3Database<DbSchema>, sessionId: string) => {
	const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

	if (!session) {
		return undefined;
	}

	if (new Date(session.expiresAt) <= new Date()) {
		return undefined;
	}

	return session;
};

const deleteSession = (db: BetterSQLite3Database<DbSchema>, sessionId: string) => {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
};

const purgeExpiredSessions = (db: BetterSQLite3Database<DbSchema>) => {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
};

export { createSession, deleteSession, getSession, purgeExpiredSessions };
