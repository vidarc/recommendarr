import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import {
	aiConfigs,
	arrConnections,
	conversations,
	libraryItems,
	messages,
	plexConnections,
	recommendations,
	sessions,
	settings,
	userSettings,
	users,
} from "./schema.ts";
import { hashPassword } from "./services/auth-utils.ts";
import { purgeExpiredSessions } from "./services/session.ts";

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

	const db = drizzle({
		client: sqlite,
		schema: {
			aiConfigs,
			arrConnections,
			conversations,
			libraryItems,
			messages,
			plexConnections,
			recommendations,
			sessions,
			settings,
			userSettings,
			users,
		},
	});

	migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../../drizzle") });

	purgeExpiredSessions(db);

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
