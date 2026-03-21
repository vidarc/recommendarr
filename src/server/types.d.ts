import type { aiConfigs, plexConnections, sessions, settings, users } from "./schema.ts";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

interface SessionUser {
	id: string;
	username: string;
	isAdmin: boolean;
}

declare module "fastify" {
	interface FastifyInstance {
		db: BetterSQLite3Database<{
			aiConfigs: typeof aiConfigs;
			plexConnections: typeof plexConnections;
			sessions: typeof sessions;
			settings: typeof settings;
			users: typeof users;
		}>;
		sqlite: Database.Database;
	}

	interface FastifyRequest {
		user?: SessionUser;
	}
}
