import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { FastifyInstance } from "fastify";

const defaultDbPath = "./data/recommendarr.db";

const dbPlugin = (app: FastifyInstance) => {
	const dbPath = process.env["DATABASE_PATH"] ?? defaultDbPath;

	const dir = dirname(dbPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const db = new Database(dbPath);

	db.pragma("journal_mode = WAL");

	db.exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)
	`);

	db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(
		"app_version",
		"1.0.0",
	);

	app.decorate("db", db);

	app.addHook("onClose", () => {
		db.close();
	});
};

export { dbPlugin };
