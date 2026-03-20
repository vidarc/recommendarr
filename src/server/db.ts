import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { hashPassword } from "./auth-utils.ts";
import { settings, users } from "./schema.ts";

import type { FastifyInstance } from "fastify";

const defaultDbPath = "./data/recommendarr.db";

const dbPlugin = async (app: FastifyInstance) => {
	const dbPath = process.env["DATABASE_PATH"] ?? defaultDbPath;

	const dir = dirname(dbPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const sqlite = new Database(dbPath);
	sqlite.pragma("journal_mode = WAL");

	const db = drizzle({ client: sqlite, schema: { settings, users } });

	db.run(
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)`,
	);

	db.run(
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			is_admin INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		)`,
	);

	db.insert(settings).values({ key: "app_version", value: "1.0.0" }).onConflictDoNothing().run();

	const defaultAdminPassword = process.env["DEFAULT_ADMIN_PASSWORD"];
	if (defaultAdminPassword) {
		const defaultAdminUsername = process.env["DEFAULT_ADMIN_USERNAME"] ?? "admin";
		db.insert(users)
			.values({
				id: randomUUID(),
				username: defaultAdminUsername,
				passwordHash: await hashPassword(defaultAdminPassword),
				isAdmin: true,
				createdAt: new Date().toISOString(),
			})
			.onConflictDoNothing()
			.run();
	}

	app.decorate("db", db);
	app.decorate("sqlite", sqlite);

	app.addHook("onClose", () => {
		sqlite.close();
	});
};

export { dbPlugin };
