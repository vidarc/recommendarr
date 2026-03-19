import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { settings } from "./schema.ts";

import type { FastifyInstance } from "fastify";

const defaultDbPath = "./data/recommendarr.db";

const dbPlugin = (app: FastifyInstance) => {
	const dbPath = process.env["DATABASE_PATH"] ?? defaultDbPath;

	const dir = dirname(dbPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const sqlite = new Database(dbPath);
	sqlite.pragma("journal_mode = WAL");

	const db = drizzle({ client: sqlite, schema: { settings } });

	db.run(
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)`,
	);

	db.insert(settings).values({ key: "app_version", value: "1.0.0" }).onConflictDoNothing().run();

	app.decorate("db", db);
	app.decorate("sqlite", sqlite);

	app.addHook("onClose", () => {
		sqlite.close();
	});
};

export { dbPlugin };
