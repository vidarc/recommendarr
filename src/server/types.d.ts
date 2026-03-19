import type { settings } from "./schema.ts";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

declare module "fastify" {
	interface FastifyInstance {
		db: BetterSQLite3Database<{ settings: typeof settings }>;
		sqlite: Database.Database;
	}
}
