import type { sessions, settings, users } from "./schema.ts";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

declare module "fastify" {
	interface FastifyInstance {
		db: BetterSQLite3Database<{
			sessions: typeof sessions;
			settings: typeof settings;
			users: typeof users;
		}>;
		sqlite: Database.Database;
	}
}
