# Recommendarr MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversational AI recommendation engine for Plex users with session auth, Plex OAuth, configurable AI provider, chat-based recommendations, and \*arr integration hooks.

**Architecture:** Vertical slices on Fastify v5 + React 19 + SQLite (Drizzle ORM). Server-side sessions via httpOnly cookies. Plex PIN-based OAuth for watch history. Any OpenAI-compatible API for recommendations. Chat conversations persisted in SQLite.

**Tech Stack:** Fastify 5, React 19, Redux Toolkit, Wouter, SQLite/better-sqlite3, Drizzle ORM, Zod, Linaria, Vite+, Vitest, MSW

**Spec:** `docs/superpowers/specs/2026-03-20-recommendarr-mvp-design.md`

---

## File Structure Overview

### New Server Files

- `src/server/services/encryption.ts` — AES-256-GCM encrypt/decrypt for stored secrets
- `src/server/services/session.ts` — Session creation, lookup, deletion, purge
- `src/server/services/plex-api.ts` — Plex API client (PIN auth, servers, libraries, watch history)
- `src/server/services/ai-client.ts` — OpenAI-compatible chat completions client
- `src/server/services/prompt-builder.ts` — System prompt construction for recommendations
- `src/server/services/response-parser.ts` — Parse AI response into text + structured recommendations
- `src/server/middleware/auth.ts` — Session auth middleware (preHandler hook)
- `src/server/routes/plex.ts` — Plex OAuth and server management routes
- `src/server/routes/ai.ts` — AI configuration routes
- `src/server/routes/chat.ts` — Chat and conversation routes

### New Server Test Files

- `src/server/__tests__/encryption.test.ts`
- `src/server/__tests__/session.test.ts`
- `src/server/__tests__/auth-middleware.test.ts`
- `src/server/__tests__/plex.test.ts`
- `src/server/__tests__/ai.test.ts`
- `src/server/__tests__/chat.test.ts`

### New Client Files

- `src/client/components/AppLayout.tsx` — Sidebar navigation layout wrapper
- `src/client/components/ChatMessage.tsx` — Single chat message bubble
- `src/client/components/RecommendationCard.tsx` — Recommendation display card
- `src/client/components/ChatControls.tsx` — Media type toggle, library picker, result count
- `src/client/components/ChatInput.tsx` — Free-text input + genre buttons + predefined prompts
- `src/client/pages/Recommendations.tsx` — Main chat page (replaces Dashboard as home)
- `src/client/pages/History.tsx` — Past conversations list
- `src/client/pages/Settings.tsx` — Settings page with tabs (Plex, AI, Account, Integrations)

### Modified Files

- `src/server/schema.ts` — Add 7 new table definitions
- `src/server/db.ts` — Switch to Drizzle migrations, add new tables to schema
- `src/server/app.ts` — Await dbPlugin, register new routes and middleware
- `src/server/types.d.ts` — Add `request.user` type augmentation
- `src/server/routes/auth.ts` — Add session cookie on login/register, add logout and /me endpoints
- `src/client/api.ts` — Add new RTK Query endpoints
- `src/client/features/auth/auth-slice.ts` — Remove credential storage, add session-based auth
- `src/client/App.tsx` — Update routing, add AppLayout, replace Dashboard with Recommendations
- `src/client/pages/Dashboard.tsx` — Will be removed/replaced

---

## Task 0: Prerequisites — Fix dbPlugin and Migration Strategy

**Files:**

- Modify: `src/server/app.ts:28-29`
- Modify: `src/server/db.ts`
- Modify: `src/server/schema.ts`
- Modify: `src/server/types.d.ts`
- Test: `src/server/__tests__/db.test.ts`
- Test: `src/server/__tests__/api.test.ts`

### 0a: Fix dbPlugin await

- [ ] **Step 1: Read and understand the bug**

In `src/server/app.ts:29`, `dbPlugin(app)` is called without `await`. The function is async (it awaits `hashPassword`). This means routes could fire before the DB is ready.

- [ ] **Step 2: Fix the await**

In `src/server/app.ts`, change:

```typescript
if (!options.skipDB) {
	dbPlugin(app);
	authRoutes(app);
	apiRoutes(app);
}
```

To:

```typescript
if (!options.skipDB) {
	await dbPlugin(app);
	authRoutes(app);
	apiRoutes(app);
}
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

Run: `yarn vp test`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/server/app.ts
git commit -m "fix: await dbPlugin to ensure DB is ready before routes register"
```

### 0b: Switch to Drizzle migrations

- [ ] **Step 5: Generate initial migration from existing schema FIRST**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`

This creates a `drizzle/` folder with the migration SQL for the existing `settings` and `users` tables. **This must be done before modifying db.ts** so that `migrate()` has a migrations folder to read from.

- [ ] **Step 6: Add drizzle.config.ts**

Create `drizzle.config.ts` at the project root:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/server/schema.ts",
	out: "./drizzle",
});
```

- [ ] **Step 7: Replace raw CREATE TABLE with Drizzle migrations in db.ts**

Replace the raw SQL `CREATE TABLE IF NOT EXISTS` statements in `src/server/db.ts` with Drizzle's `migrate()` function. Keep explicit table imports (don't use `import *` — the beta Drizzle version may not handle Zod schema exports cleanly).

Update `src/server/db.ts` to:

```typescript
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { settings, users } from "./schema.ts";
import { hashPassword } from "./services/auth-utils.ts";

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

	migrate(db, { migrationsFolder: "./drizzle" });

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
```

- [ ] **Step 8: Run tests to verify migration works**

Run: `yarn vp test`
Expected: All existing tests still pass (migrations create the same tables the raw SQL did)

- [ ] **Step 9: Commit**

```bash
git add src/server/db.ts drizzle/ drizzle.config.ts
git commit -m "refactor: switch from raw SQL to Drizzle migrations"
```

---

## Task 1: Session Management — Backend

**Files:**

- Create: `src/server/services/session.ts`
- Create: `src/server/middleware/auth.ts`
- Modify: `src/server/schema.ts`
- Modify: `src/server/routes/auth.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/types.d.ts`
- Test: `src/server/__tests__/session.test.ts`
- Test: `src/server/__tests__/auth-middleware.test.ts`

### 1a: Add sessions table to schema

- [ ] **Step 1: Write failing test for session creation**

Create `src/server/__tests__/session.test.ts`:

```typescript
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { sessions } from "../schema.ts";

const testDbDir = join(tmpdir(), "recommendarr-test-session");
const testDbPath = join(testDbDir, "test.db");

const setupDb = async () => {
	process.env["DATABASE_PATH"] = testDbPath;
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		delete process.env["DATABASE_PATH"];
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true });
		}
	});

	return app;
};

describe("sessions table", () => {
	test("sessions table exists after migration", async () => {
		const app = await setupDb();
		const result = app.db.select().from(sessions).all();
		expect(result).toStrictEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vp test src/server/__tests__/session.test.ts`
Expected: FAIL — `sessions` is not exported from schema

- [ ] **Step 3: Add sessions table to schema.ts**

Add to `src/server/schema.ts`:

```typescript
const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	createdAt: text("created_at").notNull(),
	expiresAt: text("expires_at").notNull(),
});

const selectSessionSchema = createSelectSchema(sessions);
const insertSessionSchema = createInsertSchema(sessions);
```

Add `sessions`, `selectSessionSchema`, `insertSessionSchema` to the export block.

- [ ] **Step 4: Generate migration for new table**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`

- [ ] **Step 5: Update types.d.ts to include sessions in schema**

Update the `db` type in `src/server/types.d.ts` to include `sessions`:

```typescript
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
```

Note: As more tables are added later, update this type to include them. Going forward, this plan will note "update types.d.ts" when new tables are added.

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn vp test src/server/__tests__/session.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/schema.ts src/server/types.d.ts src/server/__tests__/session.test.ts drizzle/
git commit -m "feat: add sessions table schema and migration"
```

### 1b: Session service

- [ ] **Step 8: Write failing tests for session service**

Add to `src/server/__tests__/session.test.ts`:

```typescript
import {
	createSession,
	deleteSession,
	getSession,
	purgeExpiredSessions,
} from "../services/session.ts";

describe("session service", () => {
	test("createSession returns a session with valid fields", async () => {
		const app = await setupDb();
		const session = createSession(app.db, "user-123");

		expect(session.id).toBeDefined();
		expect(session.userId).toBe("user-123");
		expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
	});

	test("getSession returns session by id", async () => {
		const app = await setupDb();
		const created = createSession(app.db, "user-123");
		const found = getSession(app.db, created.id);

		expect(found).toBeDefined();
		expect(found?.userId).toBe("user-123");
	});

	test("getSession returns undefined for expired session", async () => {
		const app = await setupDb();
		const pastDate = new Date(Date.now() - 1000).toISOString();
		app.db
			.insert(sessions)
			.values({
				id: "expired-id",
				userId: "user-123",
				createdAt: pastDate,
				expiresAt: pastDate,
			})
			.run();

		const found = getSession(app.db, "expired-id");
		expect(found).toBeUndefined();
	});

	test("deleteSession removes the session", async () => {
		const app = await setupDb();
		const created = createSession(app.db, "user-123");
		deleteSession(app.db, created.id);

		const found = getSession(app.db, created.id);
		expect(found).toBeUndefined();
	});

	test("purgeExpiredSessions removes only expired sessions", async () => {
		const app = await setupDb();
		const validSession = createSession(app.db, "user-123");
		const pastDate = new Date(Date.now() - 1000).toISOString();
		app.db
			.insert(sessions)
			.values({
				id: "expired-id",
				userId: "user-456",
				createdAt: pastDate,
				expiresAt: pastDate,
			})
			.run();

		purgeExpiredSessions(app.db);

		expect(getSession(app.db, validSession.id)).toBeDefined();
		const allSessions = app.db.select().from(sessions).all();
		expect(allSessions).toHaveLength(1);
	});
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `yarn vp test src/server/__tests__/session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 10: Implement session service**

Create `src/server/services/session.ts`:

```typescript
import { randomUUID } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { sessions } from "../schema.ts";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_SESSION_DAYS = 7;
const MS_PER_DAY = 86_400_000;

const getSessionDurationMs = (): number => {
	const days = process.env["SESSION_DURATION_DAYS"]
		? Number(process.env["SESSION_DURATION_DAYS"])
		: DEFAULT_SESSION_DAYS;
	return days * MS_PER_DAY;
};

const createSession = (db: BetterSQLite3Database, userId: string) => {
	const now = new Date();
	const session = {
		id: randomUUID(),
		userId,
		createdAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + getSessionDurationMs()).toISOString(),
	};
	db.insert(sessions).values(session).run();
	return session;
};

const getSession = (db: BetterSQLite3Database, sessionId: string) => {
	const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

	if (!session) return undefined;
	if (new Date(session.expiresAt).getTime() < Date.now()) return undefined;

	return session;
};

const deleteSession = (db: BetterSQLite3Database, sessionId: string) => {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
};

const purgeExpiredSessions = (db: BetterSQLite3Database) => {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
};

export { createSession, deleteSession, getSession, purgeExpiredSessions };
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `yarn vp test src/server/__tests__/session.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/server/services/session.ts src/server/__tests__/session.test.ts
git commit -m "feat: add session service with create, get, delete, and purge"
```

### 1c: Auth middleware

- [ ] **Step 13: Write failing tests for auth middleware**

Create `src/server/__tests__/auth-middleware.test.ts`:

```typescript
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";

const testDbDir = join(tmpdir(), "recommendarr-test-auth-mw");
const testDbPath = join(testDbDir, "test.db");

const setupDb = async () => {
	process.env["DATABASE_PATH"] = testDbPath;
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		delete process.env["DATABASE_PATH"];
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true });
		}
	});

	return app;
};

describe("auth middleware", () => {
	test("GET /api/settings returns 401 without session cookie", async () => {
		const app = await setupDb();
		const response = await app.inject({ method: "GET", url: "/api/settings" });
		expect(response.statusCode).toBe(401);
	});

	test("GET /api/settings returns 200 with valid session cookie", async () => {
		const app = await setupDb();
		// Register a user first
		await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "testuser", password: "password123" },
		});

		// Login to get a session cookie
		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: { username: "testuser", password: "password123" },
		});

		const cookies = loginResponse.cookies;
		const sessionCookie = cookies.find((c: { name: string }) => c.name === "session");
		expect(sessionCookie).toBeDefined();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session: sessionCookie!.value },
		});
		expect(response.statusCode).toBe(200);
	});

	test("public auth routes work without session", async () => {
		const app = await setupDb();

		const setupResponse = await app.inject({ method: "GET", url: "/api/auth/setup-status" });
		expect(setupResponse.statusCode).toBe(200);

		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: { username: "noone", password: "password123" },
		});
		expect(loginResponse.statusCode).toBe(401);

		const registerResponse = await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "newuser", password: "password123" },
		});
		expect(registerResponse.statusCode).toBe(201);
	});
});
```

- [ ] **Step 14: Run tests to verify they fail**

Run: `yarn vp test src/server/__tests__/auth-middleware.test.ts`
Expected: FAIL — /api/settings returns 200 without session (no middleware yet)

- [ ] **Step 15: Install @fastify/cookie**

This must be installed before writing the auth middleware, as the middleware accesses `request.cookies` which is typed by this plugin.

```bash
yarn vp add @fastify/cookie
```

- [ ] **Step 16: Implement auth middleware**

Create `src/server/middleware/auth.ts`:

```typescript
import { eq } from "drizzle-orm";

import { users } from "../schema.ts";
import { getSession } from "../services/session.ts";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const PUBLIC_ROUTES = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/setup-status"]);

const authMiddleware = (app: FastifyInstance) => {
	app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
		const { url } = request;

		// Skip non-API routes and public auth routes
		if (!url.startsWith("/api/") || PUBLIC_ROUTES.has(url)) {
			return;
		}

		const sessionId = request.cookies?.["session"];
		if (!sessionId) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(401).send({ error: "Unauthorized" });
		}

		const session = getSession(app.db, sessionId);
		if (!session) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(401).send({ error: "Unauthorized" });
		}

		const user = app.db
			.select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
			.from(users)
			.where(eq(users.id, session.userId))
			.get();

		if (!user) {
			reply.clearCookie("session", { path: "/" });
			return reply.code(401).send({ error: "Unauthorized" });
		}

		request.user = user;
	});
};

export { authMiddleware };
```

- [ ] **Step 17: Register cookie plugin and auth middleware in app.ts**

Update `src/server/app.ts`:

```typescript
import { randomUUID } from "node:crypto";

import cookie from "@fastify/cookie";
import { fastify } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { dbPlugin } from "./db.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { apiRoutes } from "./routes/api.ts";
import { authRoutes } from "./routes/auth.ts";
import { healthRoutes } from "./routes/health.ts";
import { ssrRoutes } from "./ssr.ts";

interface BuildServerOptions {
	skipSSR?: boolean;
	skipDB?: boolean;
}

const buildServer = async (options: BuildServerOptions = {}) => {
	const app = fastify({
		logger: process.env["NODE_ENV"] !== "test",
		genReqId: () => randomUUID(),
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(cookie);

	healthRoutes(app);

	if (!options.skipDB) {
		await dbPlugin(app);
		authMiddleware(app);
		authRoutes(app);
		apiRoutes(app);
	}

	if (!options.skipSSR) {
		await ssrRoutes(app);
	}

	await app.ready();

	return app;
};

export { buildServer };
```

- [ ] **Step 18: Update types.d.ts for request.user**

Update `src/server/types.d.ts`:

```typescript
import type { sessions, settings, users } from "./schema.ts";
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
```

Note: `@fastify/cookie` adds its own `cookies` type to `FastifyRequest`, so you do not need to declare `cookies` manually.

- [ ] **Step 19: Run tests to verify they pass**

Run: `yarn vp test src/server/__tests__/auth-middleware.test.ts`
Expected: PASS

Note: The existing `api.test.ts` tests will now fail because `/api/settings` requires auth. They need to be updated to include a session cookie.

- [ ] **Step 20: Fix existing api.test.ts tests**

Update `src/server/__tests__/api.test.ts` to register a user and use a session cookie:

```typescript
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildServer } from "../app.ts";
import { settings } from "../schema.ts";

const testDbDir = join(tmpdir(), "recommendarr-test-api");
const testDbPath = join(testDbDir, "test.db");

const setupDb = async () => {
	process.env["DATABASE_PATH"] = testDbPath;
	const app = await buildServer({ skipSSR: true });

	onTestFinished(async () => {
		await app.close();
		delete process.env["DATABASE_PATH"];
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
		payload: { username: "testuser", password: "password123" },
	});
	const loginResponse = await app.inject({
		method: "POST",
		url: "/api/auth/login",
		payload: { username: "testuser", password: "password123" },
	});
	const sessionCookie = loginResponse.cookies.find((c: { name: string }) => c.name === "session");
	return sessionCookie!.value;
};

describe("GET /api/settings", () => {
	test("returns settings as key-value object", async () => {
		const expectedStatusCode = 200;
		const app = await setupDb();
		const session = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session },
		});

		expect(response.statusCode).toBe(expectedStatusCode);
		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
		});
	});

	test("returns additional settings when inserted", async () => {
		const app = await setupDb();
		const session = await getSessionCookie(app);

		app.db.insert(settings).values({ key: "theme", value: "dark" }).run();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session },
		});

		expect(response.json()).toStrictEqual({
			app_version: "1.0.0",
			theme: "dark",
		});
	});

	test("returns empty object when no settings exist", async () => {
		const app = await setupDb();
		const session = await getSessionCookie(app);

		app.db.delete(settings).run();

		const response = await app.inject({
			method: "GET",
			url: "/api/settings",
			cookies: { session },
		});

		expect(response.json()).toStrictEqual({});
	});

	test("returns 404 for unknown API routes", async () => {
		const expectedStatusCode = 404;
		const app = await setupDb();
		const session = await getSessionCookie(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/unknown",
			cookies: { session },
		});

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});

describe("skipDB option", () => {
	test("does not register /api/settings when skipDB is true", async () => {
		const expectedStatusCode = 404;
		const app = await buildServer({ skipSSR: true, skipDB: true });

		onTestFinished(async () => {
			await app.close();
		});

		const response = await app.inject({ method: "GET", url: "/api/settings" });

		expect(response.statusCode).toBe(expectedStatusCode);
	});
});
```

- [ ] **Step 21: Run all tests**

Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 22: Commit**

```bash
git add src/server/middleware/auth.ts src/server/__tests__/auth-middleware.test.ts src/server/__tests__/api.test.ts src/server/app.ts src/server/types.d.ts package.json yarn.lock
git commit -m "feat: add session auth middleware with cookie support"
```

### 1d: Update auth routes for sessions

- [ ] **Step 23: Write tests for session-based login/register/logout/me**

Add tests to `src/server/__tests__/auth-middleware.test.ts`:

```typescript
describe("auth routes with sessions", () => {
	test("POST /api/auth/login sets session cookie", async () => {
		const app = await setupDb();
		await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "testuser", password: "password123" },
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: { username: "testuser", password: "password123" },
		});

		expect(response.statusCode).toBe(200);
		const sessionCookie = response.cookies.find((c: { name: string }) => c.name === "session");
		expect(sessionCookie).toBeDefined();
		expect(sessionCookie?.httpOnly).toBe(true);
	});

	test("POST /api/auth/register sets session cookie", async () => {
		const app = await setupDb();

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "newuser", password: "password123" },
		});

		expect(response.statusCode).toBe(201);
		const sessionCookie = response.cookies.find((c: { name: string }) => c.name === "session");
		expect(sessionCookie).toBeDefined();
	});

	test("GET /api/auth/me returns user from session", async () => {
		const app = await setupDb();
		await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "testuser", password: "password123" },
		});

		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: { username: "testuser", password: "password123" },
		});
		const sessionCookie = loginResponse.cookies.find((c: { name: string }) => c.name === "session");

		const meResponse = await app.inject({
			method: "GET",
			url: "/api/auth/me",
			cookies: { session: sessionCookie!.value },
		});

		expect(meResponse.statusCode).toBe(200);
		expect(meResponse.json()).toMatchObject({
			username: "testuser",
		});
	});

	test("POST /api/auth/logout clears session", async () => {
		const app = await setupDb();
		await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: { username: "testuser", password: "password123" },
		});

		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: { username: "testuser", password: "password123" },
		});
		const sessionCookie = loginResponse.cookies.find((c: { name: string }) => c.name === "session");

		const logoutResponse = await app.inject({
			method: "POST",
			url: "/api/auth/logout",
			cookies: { session: sessionCookie!.value },
		});

		expect(logoutResponse.statusCode).toBe(200);

		// Session should no longer work
		const meResponse = await app.inject({
			method: "GET",
			url: "/api/auth/me",
			cookies: { session: sessionCookie!.value },
		});
		expect(meResponse.statusCode).toBe(401);
	});
});
```

- [ ] **Step 24: Run tests to verify they fail**

Run: `yarn vp test src/server/__tests__/auth-middleware.test.ts`
Expected: FAIL — no /me or /logout routes, no cookies set on login/register

- [ ] **Step 25: Update auth routes**

Update `src/server/routes/auth.ts` to:

- Import `createSession` and `deleteSession` from session service
- On login success: call `createSession`, set httpOnly cookie with `reply.setCookie`
- On register success: same — create session and set cookie
- Add `GET /api/auth/me` — returns `request.user` or 401
- Add `POST /api/auth/logout` — deletes session, clears cookie

Cookie options: `{ path: "/", httpOnly: true, secure: process.env["NODE_ENV"] === "production", sameSite: "strict" }`

- [ ] **Step 26: Run all tests**

Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 27: Run check**

Run: `yarn vp check`
Expected: No lint or type errors

- [ ] **Step 28: Commit**

```bash
git add src/server/routes/auth.ts src/server/__tests__/auth-middleware.test.ts
git commit -m "feat: add session cookies to login/register, add /me and /logout endpoints"
```

### 1e: Purge expired sessions on startup

- [ ] **Step 29: Add purge call to dbPlugin**

In `src/server/db.ts`, after `migrate(db, ...)`, add:

```typescript
import { purgeExpiredSessions } from "./services/session.ts";
// ... after migrate call:
purgeExpiredSessions(db);
```

- [ ] **Step 30: Run all tests**

Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 31: Commit**

```bash
git add src/server/db.ts
git commit -m "feat: purge expired sessions on server startup"
```

---

## Task 2: Session Management — Frontend

**Files:**

- Modify: `src/client/api.ts`
- Modify: `src/client/features/auth/auth-slice.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/pages/Login.tsx`
- Modify: `src/client/pages/Register.tsx`
- Test: `src/client/__tests__/App.test.tsx`

### 2a: Add /me and /logout API endpoints to RTK Query

- [ ] **Step 1: Update api.ts**

Add to `src/client/api.ts`:

```typescript
getMe: builder.query<User, void>({
	query: () => "api/auth/me",
}),
logout: builder.mutation<{ success: boolean }, void>({
	query: () => ({
		url: "api/auth/logout",
		method: "POST",
	}),
}),
```

Export the new hooks: `useGetMeQuery`, `useLogoutMutation`.

- [ ] **Step 2: Commit**

```bash
git add src/client/api.ts
git commit -m "feat: add /me and /logout RTK Query endpoints"
```

### 2b: Update frontend auth flow

- [ ] **Step 3: Update App.tsx to use session-based auth**

Replace the `useSelector` auth check with `useGetMeQuery`:

- `ProtectedDashboard`: use `useGetMeQuery()` — if loading show spinner, if no user redirect to `/login`
- `LoginPage`: use `useGetMeQuery()` — if user exists redirect to `/`
- `RegisterPage`: same pattern
- Remove `import { useSelector }` and `import type { RootState }`

- [ ] **Step 4: Update Login.tsx — remove Redux dispatch, rely on cookie**

After successful login, instead of dispatching `setUser`, force refetch of the `/me` query so App re-checks auth. Remove the `setUser` import and dispatch.

- [ ] **Step 5: Update Register.tsx — same pattern as Login**

Same change as Login — remove `setUser`, invalidate cache after register.

- [ ] **Step 6: Simplify auth-slice.ts**

Remove `setUser` action since auth state now comes from the `/me` query. Keep `clearUser` for logout if needed, or remove the slice entirely if auth state is fully managed by RTK Query.

- [ ] **Step 7: Update client tests**

Update `src/client/__tests__/App.test.tsx` to mock the `/api/auth/me` endpoint instead of relying on Redux state for auth. Use MSW to mock the endpoint responses.

- [ ] **Step 8: Run tests and check**

Run: `yarn vp test && yarn vp check`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/client/api.ts src/client/features/auth/auth-slice.ts src/client/App.tsx src/client/pages/Login.tsx src/client/pages/Register.tsx src/client/__tests__/App.test.tsx
git commit -m "feat: switch frontend auth to session-based via /me endpoint"
```

---

## Task 3: Encryption Service

**Files:**

- Create: `src/server/services/encryption.ts`
- Test: `src/server/__tests__/encryption.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/__tests__/encryption.test.ts`:

```typescript
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { decrypt, encrypt } from "../services/encryption.ts";

describe("encryption service", () => {
	const testKey = "a".repeat(64); // valid 64-char hex string

	test("encrypt returns a string different from input", () => {
		process.env["ENCRYPTION_KEY"] = testKey;
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		const encrypted = encrypt("hello world");
		expect(encrypted).not.toBe("hello world");
	});

	test("decrypt reverses encrypt", () => {
		process.env["ENCRYPTION_KEY"] = testKey;
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		const encrypted = encrypt("secret token");
		const decrypted = decrypt(encrypted);
		expect(decrypted).toBe("secret token");
	});

	test("encrypt throws without ENCRYPTION_KEY", () => {
		delete process.env["ENCRYPTION_KEY"];
		expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
	});

	test("encrypt throws with invalid key length", () => {
		process.env["ENCRYPTION_KEY"] = "tooshort";
		onTestFinished(() => {
			delete process.env["ENCRYPTION_KEY"];
		});

		expect(() => encrypt("test")).toThrow();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vp test src/server/__tests__/encryption.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement encryption service**

Create `src/server/services/encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const HEX_KEY_LENGTH = 64;

const getKey = (): Buffer => {
	const keyHex = process.env["ENCRYPTION_KEY"];
	if (!keyHex) {
		throw new Error(
			"ENCRYPTION_KEY environment variable is required. " +
				"Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
		);
	}
	if (keyHex.length !== HEX_KEY_LENGTH) {
		throw new Error(`ENCRYPTION_KEY must be a ${HEX_KEY_LENGTH}-character hex string (32 bytes)`);
	}
	return Buffer.from(keyHex, "hex");
};

const encrypt = (plaintext: string): string => {
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Format: iv:authTag:ciphertext (all hex)
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (ciphertext: string): string => {
	const key = getKey();
	const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
	if (!ivHex || !authTagHex || !encryptedHex) {
		throw new Error("Invalid ciphertext format");
	}

	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const encrypted = Buffer.from(encryptedHex, "hex");

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

export { decrypt, encrypt, getKey };
```

Also export `getKey` so it can be called at startup to validate the key is present.

- [ ] **Step 4: Run tests**

Run: `yarn vp test src/server/__tests__/encryption.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/encryption.ts src/server/__tests__/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption service for stored secrets"
```

### 3b: Enforce ENCRYPTION_KEY at server startup

- [ ] **Step 6: Add ENCRYPTION_KEY validation to server startup**

The spec requires: "If not set, the server refuses to start with a clear error message."

In `src/server/app.ts`, add a call to `getKey()` from the encryption service at the top of `buildServer()` (before any plugins are loaded). This validates the key format and throws a clear error if it is missing or malformed.

```typescript
import { getKey } from "./services/encryption.ts";

// At the top of buildServer():
getKey(); // Validates ENCRYPTION_KEY is set and correctly formatted
```

**Important:** This means ALL existing tests that use `buildServer()` without `skipDB: true` will need `ENCRYPTION_KEY` set. Update the test helper `setupDb` functions across test files to set `process.env["ENCRYPTION_KEY"] = "a".repeat(64)` in their setup, and clean it up in `onTestFinished`.

- [ ] **Step 7: Update all test setupDb functions to set ENCRYPTION_KEY**

In each test file that calls `buildServer({ skipSSR: true })`:

- `src/server/__tests__/db.test.ts`
- `src/server/__tests__/api.test.ts`
- `src/server/__tests__/session.test.ts`
- `src/server/__tests__/auth-middleware.test.ts`

Add to each `setupDb`:

```typescript
process.env["ENCRYPTION_KEY"] = "a".repeat(64);
```

And in `onTestFinished`:

```typescript
delete process.env["ENCRYPTION_KEY"];
```

- [ ] **Step 8: Run all tests**

Run: `yarn vp test`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/server/app.ts src/server/__tests__/
git commit -m "feat: enforce ENCRYPTION_KEY validation at server startup"
```

---

## Task 4: Plex OAuth — Backend

**Files:**

- Create: `src/server/services/plex-api.ts`
- Create: `src/server/routes/plex.ts`
- Modify: `src/server/schema.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/types.d.ts`
- Test: `src/server/__tests__/plex.test.ts`

### 4a: Add plex_connections table

- [ ] **Step 1: Add table to schema.ts**

```typescript
const plexConnections = sqliteTable("plex_connections", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	authToken: text("auth_token").notNull(),
	serverUrl: text("server_url"),
	serverName: text("server_name"),
	machineIdentifier: text("machine_identifier"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
```

Export it. Update `types.d.ts` to include `plexConnections` in the db schema type.

- [ ] **Step 2: Generate migration and run tests**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`
Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/server/schema.ts src/server/types.d.ts drizzle/
git commit -m "feat: add plex_connections table schema and migration"
```

### 4b: Plex API client

- [ ] **Step 4: Write tests for Plex API client**

Create `src/server/__tests__/plex.test.ts`. Use MSW to mock Plex API endpoints (`https://plex.tv/api/v2/pins`, etc.). Test:

- `createPlexPin()` — calls Plex API to create a PIN, returns `{ id, code, authUrl }`
- `checkPlexPin(pinId)` — checks if PIN has been claimed, returns auth token or null
- `getPlexServers(authToken)` — returns list of servers
- `getPlexLibraries(serverUrl, authToken)` — returns movie/TV libraries
- `getWatchHistory(serverUrl, authToken, libraryId?, limit?)` — returns recently watched items (max 200)

- [ ] **Step 5: Implement Plex API client**

Create `src/server/services/plex-api.ts`. Use `fetch` with headers `X-Plex-Client-Identifier`, `X-Plex-Product: Recommendarr`, `Accept: application/json`. Functions:

- `createPlexPin()` — POST `https://plex.tv/api/v2/pins` with `strong: true`
- `checkPlexPin(pinId)` — GET `https://plex.tv/api/v2/pins/{id}`
- `getPlexServers(authToken)` — GET `https://plex.tv/api/v2/resources?includeHttps=1`
- `getPlexLibraries(serverUrl, authToken)` — GET `{serverUrl}/library/sections`
- `getWatchHistory(serverUrl, authToken, libraryId?, limit?)` — GET history endpoint, default limit 200

- [ ] **Step 6: Run tests**

Run: `yarn vp test src/server/__tests__/plex.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/services/plex-api.ts src/server/__tests__/plex.test.ts
git commit -m "feat: add Plex API client for PIN auth, servers, libraries, and watch history"
```

### 4c: Plex routes

- [ ] **Step 8: Write tests for Plex routes**

Add route-level tests to `src/server/__tests__/plex.test.ts`:

- `POST /api/plex/auth/start` — returns `{ pinId, authUrl }`
- `GET /api/plex/auth/check?pinId=123` — returns status
- `GET /api/plex/servers` — returns server list (requires stored Plex connection)
- `POST /api/plex/servers/select` — saves selected server
- `DELETE /api/plex/connection` — removes connection
- `GET /api/plex/libraries` — returns libraries (requires selected server)

All routes require a valid session cookie. Use MSW to mock external Plex API calls.

- [ ] **Step 9: Implement Plex routes**

Create `src/server/routes/plex.ts`. Each handler uses `request.user` (enforced by auth middleware), `encrypt`/`decrypt` for auth tokens, and the Plex API client functions.

- [ ] **Step 10: Register Plex routes in app.ts**

Add `plexRoutes(app)` inside the `!options.skipDB` block in `src/server/app.ts`.

- [ ] **Step 11: Run all tests and check**

Run: `yarn vp test && yarn vp check`
Expected: All pass

- [ ] **Step 12: Commit**

```bash
git add src/server/routes/plex.ts src/server/__tests__/plex.test.ts src/server/app.ts
git commit -m "feat: add Plex OAuth routes for auth, server selection, and library listing"
```

---

## Task 5: AI Configuration — Backend

**Files:**

- Create: `src/server/services/ai-client.ts`
- Create: `src/server/routes/ai.ts`
- Modify: `src/server/schema.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/types.d.ts`
- Test: `src/server/__tests__/ai.test.ts`

### 5a: Add ai_configs table

- [ ] **Step 1: Add table to schema.ts**

```typescript
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const aiConfigs = sqliteTable("ai_configs", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().unique(),
	endpointUrl: text("endpoint_url").notNull(),
	apiKey: text("api_key").notNull(),
	modelName: text("model_name").notNull(),
	temperature: real("temperature").notNull().default(0.7),
	maxTokens: integer("max_tokens").notNull().default(2048),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
```

Export. Update `types.d.ts`.

- [ ] **Step 2: Generate migration and run tests**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`
Run: `yarn vp test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/server/schema.ts src/server/types.d.ts drizzle/
git commit -m "feat: add ai_configs table schema and migration"
```

### 5b: AI client

- [ ] **Step 4: Write tests for AI client**

Create `src/server/__tests__/ai.test.ts`. Use MSW to mock `/v1/chat/completions`. Test:

- `chatCompletion(config, messages)` — sends request with correct headers/body, returns response content
- `testConnection(config)` — returns `{ success: true }` on valid response
- Error handling: network failure returns `{ success: false, error: "..." }`

- [ ] **Step 5: Implement AI client**

Create `src/server/services/ai-client.ts` — thin `fetch` wrapper around the OpenAI-compatible chat completions endpoint. No SDK dependency.

```typescript
interface AiConfig {
	endpointUrl: string;
	apiKey: string;
	modelName: string;
	temperature: number;
	maxTokens: number;
}

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
```

Functions: `chatCompletion(config, messages)` and `testConnection(config)`.

- [ ] **Step 6: Run tests**

Run: `yarn vp test src/server/__tests__/ai.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/services/ai-client.ts src/server/__tests__/ai.test.ts
git commit -m "feat: add OpenAI-compatible AI client"
```

### 5c: AI config routes

- [ ] **Step 8: Write tests for AI config routes**

Add to `src/server/__tests__/ai.test.ts`:

- `GET /api/ai/config` — returns config with masked API key, or 404 if none
- `PUT /api/ai/config` — creates or updates config (encrypts API key)
- `DELETE /api/ai/config` — removes config
- `POST /api/ai/test` — tests connection (uses MSW to mock AI endpoint)

All require session cookie. Set `ENCRYPTION_KEY` env var in test setup.

- [ ] **Step 9: Implement AI config routes**

Create `src/server/routes/ai.ts`:

- GET: decrypt API key, return masked version (e.g., `sk-****1234`)
- PUT: encrypt API key, upsert into `ai_configs`
- DELETE: remove row
- POST test: decrypt API key, call `testConnection`

- [ ] **Step 10: Register AI routes in app.ts**

Add `aiRoutes(app)` in `src/server/app.ts`.

- [ ] **Step 11: Run all tests and check**

Run: `yarn vp test && yarn vp check`
Expected: All pass

- [ ] **Step 12: Commit**

```bash
git add src/server/routes/ai.ts src/server/__tests__/ai.test.ts src/server/app.ts
git commit -m "feat: add AI config CRUD routes with encrypted API key storage"
```

---

## Task 6: Recommendation Chat — Backend

**Files:**

- Create: `src/server/services/prompt-builder.ts`
- Create: `src/server/services/response-parser.ts`
- Create: `src/server/routes/chat.ts`
- Modify: `src/server/schema.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/types.d.ts`
- Test: `src/server/__tests__/chat.test.ts`

### 6a: Add conversations, messages, and recommendations tables

- [ ] **Step 1: Add tables to schema.ts**

```typescript
const conversations = sqliteTable("conversations", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	mediaType: text("media_type").notNull(),
	title: text("title"),
	createdAt: text("created_at").notNull(),
});

const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id").notNull(),
	role: text("role").notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at").notNull(),
});

const recommendations = sqliteTable("recommendations", {
	id: text("id").primaryKey(),
	messageId: text("message_id").notNull(),
	title: text("title").notNull(),
	year: integer("year"),
	mediaType: text("media_type").notNull(),
	synopsis: text("synopsis"),
	tmdbId: integer("tmdb_id"),
	addedToArr: integer("added_to_arr", { mode: "boolean" }).notNull().default(false),
});
```

Export all. Update `types.d.ts`.

- [ ] **Step 2: Generate migration and run tests**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`
Run: `yarn vp test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/server/schema.ts src/server/types.d.ts drizzle/
git commit -m "feat: add conversations, messages, and recommendations table schemas"
```

### 6b: Prompt builder and response parser

- [ ] **Step 4: Write tests for prompt builder**

Create `src/server/__tests__/chat.test.ts`:

```typescript
import { describe, expect, test } from "vite-plus/test";

import { buildSystemPrompt } from "../services/prompt-builder.ts";

describe("prompt builder", () => {
	test("builds system prompt with watch history and constraints", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [
				{ title: "Inception", year: 2010, type: "movie" },
				{ title: "Breaking Bad", year: 2008, type: "show" },
			],
			mediaType: "movie",
			resultCount: 5,
		});

		expect(prompt).toContain("Inception");
		expect(prompt).toContain("5");
		expect(prompt).toContain("movie");
		expect(prompt).toContain("JSON");
	});

	test("handles empty watch history", () => {
		const prompt = buildSystemPrompt({
			watchHistory: [],
			mediaType: "either",
			resultCount: 10,
		});

		expect(prompt).toContain("10");
		expect(prompt).toBeDefined();
	});
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn vp test src/server/__tests__/chat.test.ts`
Expected: FAIL

- [ ] **Step 6: Implement prompt builder**

Create `src/server/services/prompt-builder.ts` — builds system prompt with watch history, media type constraint, result count, and instruction to return JSON recommendations.

- [ ] **Step 7: Write tests for response parser**

Add to `src/server/__tests__/chat.test.ts`:

```typescript
import { parseRecommendations } from "../services/response-parser.ts";

describe("response parser", () => {
	test("extracts recommendations from AI response with JSON block", () => {
		const response = `Here are some great movies!

\`\`\`json
[
  { "title": "The Matrix", "year": 1999, "mediaType": "movie", "synopsis": "A hacker discovers reality is a simulation." },
  { "title": "Blade Runner", "year": 1982, "mediaType": "movie", "synopsis": "A detective hunts rogue androids." }
]
\`\`\`

Enjoy!`;

		const result = parseRecommendations(response);
		expect(result.conversationalText).toContain("great movies");
		expect(result.recommendations).toHaveLength(2);
		expect(result.recommendations[0].title).toBe("The Matrix");
	});

	test("returns empty recommendations when no JSON block found", () => {
		const result = parseRecommendations("Just a regular message.");
		expect(result.recommendations).toHaveLength(0);
		expect(result.conversationalText).toBe("Just a regular message.");
	});
});
```

- [ ] **Step 8: Implement response parser**

Create `src/server/services/response-parser.ts` — extracts JSON recommendation block from AI response text using regex.

- [ ] **Step 9: Run tests**

Run: `yarn vp test src/server/__tests__/chat.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/server/services/prompt-builder.ts src/server/services/response-parser.ts src/server/__tests__/chat.test.ts
git commit -m "feat: add prompt builder and response parser for AI recommendations"
```

### 6c: Chat routes

- [ ] **Step 11: Write tests for chat routes**

Add route-level tests to `src/server/__tests__/chat.test.ts` using MSW to mock both Plex API (watch history) and AI API (chat completions):

- `POST /api/chat` with no `conversationId` — creates new conversation, returns `{ conversationId, message, recommendations }`
- `POST /api/chat` with existing `conversationId` — appends to conversation
- `GET /api/conversations` — lists user's conversations
- `GET /api/conversations/:id` — returns full conversation with messages and recommendations
- `DELETE /api/conversations/:id` — deletes conversation and cascade-deletes messages/recommendations

All require session cookie. Set `ENCRYPTION_KEY` env var.

- [ ] **Step 12: Implement chat routes**

Create `src/server/routes/chat.ts`:

`POST /api/chat` handler flow:

1. Validate request body (Zod schema for `message`, `mediaType`, `resultCount`, optional `conversationId`, optional `libraryIds`)
2. Create or fetch conversation (update `media_type` if changed)
3. Save user message to `messages` table
4. Fetch watch history from Plex via stored connection
5. Build system prompt via `buildSystemPrompt`
6. Fetch full message history for the conversation from DB
7. Call AI via `chatCompletion` with system prompt + conversation history
8. Parse response via `parseRecommendations`
9. Save assistant message and individual recommendations to DB
10. If first user message in conversation, make second AI call to generate title (6 words max)
11. Return `{ conversationId, message, recommendations }`

- [ ] **Step 13: Register chat routes in app.ts**

Add `chatRoutes(app)` in `src/server/app.ts`.

- [ ] **Step 14: Run all tests and check**

Run: `yarn vp test && yarn vp check`
Expected: All pass

- [ ] **Step 15: Commit**

```bash
git add src/server/routes/chat.ts src/server/__tests__/chat.test.ts src/server/app.ts
git commit -m "feat: add chat routes for conversational recommendations"
```

---

## Task 7: App Layout and Navigation — Frontend

**Files:**

- Create: `src/client/components/AppLayout.tsx`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Create AppLayout component**

Create `src/client/components/AppLayout.tsx` — sidebar navigation layout:

- Sidebar links: Recommendations (home), History, Settings
- Active route highlighting via wouter
- Logout button at sidebar bottom (calls `useLogoutMutation`)
- Main content area renders `children`
- Night Owl theme styling via Linaria

- [ ] **Step 2: Update App.tsx routing**

Wrap authenticated routes in `AppLayout`. Update routing to include `/history` and `/settings` routes. The `/` route renders the Recommendations page (to be created in Task 9).

- [ ] **Step 3: Run check**

Run: `yarn vp check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/client/components/AppLayout.tsx src/client/App.tsx
git commit -m "feat: add app layout with sidebar navigation"
```

---

## Task 8: Settings Page — Frontend

**Files:**

- Create: `src/client/pages/Settings.tsx`
- Modify: `src/client/api.ts`

- [ ] **Step 1: Add RTK Query endpoints for settings page**

Add to `src/client/api.ts`:

- Plex endpoints: `startPlexAuth`, `checkPlexAuth`, `getPlexServers`, `selectPlexServer`, `disconnectPlex`, `getPlexLibraries`
- AI endpoints: `getAiConfig`, `updateAiConfig`, `deleteAiConfig`, `testAiConnection`

Export all hooks.

- [ ] **Step 2: Create Settings page with tabs**

Create `src/client/pages/Settings.tsx`:

**Plex Connection tab:**

- Not connected: "Connect Plex" button → opens Plex auth URL in new window, polls for PIN completion
- Connected: shows server name, status indicator, "Disconnect" button
- Server selection dropdown (after auth, before server selected)

**AI Configuration tab:**

- Form: endpoint URL, API key (password field), model name
- Advanced (collapsible): temperature slider, max tokens input
- "Test Connection" and "Save" buttons

**Account tab:**

- Change password form (deferred — render as disabled with "Coming soon" for MVP, no backend endpoint yet)
- Logout button

**Integrations tab (placeholder):**

- Radarr/Sonarr fields, disabled with "Coming soon" label

- [ ] **Step 3: Run check**

Run: `yarn vp check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/client/pages/Settings.tsx src/client/api.ts
git commit -m "feat: add Settings page with Plex, AI, Account, and Integrations tabs"
```

---

## Task 9: Recommendations Page — Frontend

**Files:**

- Create: `src/client/components/ChatControls.tsx`
- Create: `src/client/components/ChatInput.tsx`
- Create: `src/client/components/ChatMessage.tsx`
- Create: `src/client/components/RecommendationCard.tsx`
- Create: `src/client/pages/Recommendations.tsx`
- Modify: `src/client/api.ts`
- Delete: `src/client/pages/Dashboard.tsx`

### 9a: Add chat API endpoints

- [ ] **Step 1: Add RTK Query endpoints for chat**

Add to `src/client/api.ts`:

- `sendChatMessage` — POST `/api/chat` mutation
- `getConversations` — GET `/api/conversations` query
- `getConversation` — GET `/api/conversations/:id` query
- `deleteConversation` — DELETE `/api/conversations/:id` mutation

Export hooks.

- [ ] **Step 2: Commit**

```bash
git add src/client/api.ts
git commit -m "feat: add RTK Query endpoints for chat and conversations"
```

### 9b: Chat UI components

- [ ] **Step 3: Create ChatControls component**

`src/client/components/ChatControls.tsx` — top bar:

- Media type toggle buttons (Movies / TV Shows / Either)
- Library scope dropdown (Whole library or specific Plex libraries via `useGetPlexLibrariesQuery`)
- Result count number input (default 10)

- [ ] **Step 4: Create ChatInput component**

`src/client/components/ChatInput.tsx` — bottom input area:

- Genre button row (action, comedy, thriller, horror, sci-fi, drama, romance, documentary, animation)
- Predefined prompt buttons ("more from this director", "similar actors", "this film style")
- Free-text input with send button
- Clicking a genre/predefined button sends it as the message

- [ ] **Step 5: Create ChatMessage component**

`src/client/components/ChatMessage.tsx`:

- User messages: right-aligned, accent-tinted background
- Assistant messages: left-aligned, surface background

- [ ] **Step 6: Create RecommendationCard component**

`src/client/components/RecommendationCard.tsx`:

- Title, year, media type badge (movie/TV)
- Synopsis text
- "Add to Radarr" / "Add to Sonarr" buttons — disabled, tooltip: "Connect Radarr/Sonarr in Settings to enable"

- [ ] **Step 7: Commit**

```bash
git add src/client/components/ChatControls.tsx src/client/components/ChatInput.tsx src/client/components/ChatMessage.tsx src/client/components/RecommendationCard.tsx
git commit -m "feat: add chat UI components (controls, input, message, recommendation card)"
```

### 9c: Recommendations page

- [ ] **Step 8: Create Recommendations page**

`src/client/pages/Recommendations.tsx`:

- `ChatControls` at top
- Scrollable message thread with `ChatMessage` and inline `RecommendationCard` components
- `ChatInput` fixed at bottom
- "New Conversation" button in header
- Manages current conversation state, sends messages via `useSendChatMessageMutation`
- Loading indicator while waiting for AI response

- [ ] **Step 9: Remove old Dashboard page**

Delete `src/client/pages/Dashboard.tsx`. Update `src/client/App.tsx` to render `Recommendations` instead.

- [ ] **Step 10: Run check**

Run: `yarn vp check`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/client/pages/Recommendations.tsx src/client/App.tsx
git rm src/client/pages/Dashboard.tsx
git commit -m "feat: add Recommendations chat page, remove old Dashboard"
```

---

## Task 10: History Page — Frontend

**Files:**

- Create: `src/client/pages/History.tsx`

- [ ] **Step 1: Create History page**

`src/client/pages/History.tsx`:

- Lists conversations from `useGetConversationsQuery`
- Each item: title (or "Untitled"), media type badge, relative date
- Click navigates to Recommendations page with that conversation loaded
- Delete button with confirmation on each item
- Empty state: "No conversations yet. Start one from the Recommendations page."

- [ ] **Step 2: Run check**

Run: `yarn vp check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/client/pages/History.tsx
git commit -m "feat: add History page for past conversations"
```

---

## Task 11: \*arr Integration Hooks — Schema Only

**Files:**

- Modify: `src/server/schema.ts`
- Modify: `src/server/types.d.ts`

- [ ] **Step 1: Add arr_connections table to schema**

```typescript
import { uniqueIndex } from "drizzle-orm/sqlite-core";

const arrConnections = sqliteTable(
	"arr_connections",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		serviceType: text("service_type").notNull(),
		url: text("url").notNull(),
		apiKey: text("api_key").notNull(),
		createdAt: text("created_at").notNull(),
	},
	(table) => [uniqueIndex("arr_user_service_idx").on(table.userId, table.serviceType)],
);
```

Export. Update `types.d.ts`.

- [ ] **Step 2: Generate migration**

Run: `yarn vp exec drizzle-kit generate --dialect sqlite --schema src/server/schema.ts --out drizzle`

- [ ] **Step 3: Run all tests**

Run: `yarn vp test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/server/schema.ts src/server/types.d.ts drizzle/
git commit -m "feat: add arr_connections table schema (integration hooks, schema-only)"
```

---

## Task 12: Documentation and Environment Updates

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update API documentation**

Add all new routes to `docs/api.md`:

- Auth: `GET /api/auth/me`, `POST /api/auth/logout`
- Plex: all 6 endpoints with request/response schemas
- AI: all 4 endpoints with request/response schemas
- Chat: all 4 endpoints with request/response schemas

- [ ] **Step 2: Update environment variable docs**

Add to `docs/README.md`:

- `ENCRYPTION_KEY` — required, 64-char hex string for AES-256-GCM
- `SESSION_DURATION_DAYS` — optional, default 7

- [ ] **Step 3: Update CLAUDE.md architecture section**

Update to reflect: new route files, services, middleware, all new tables, new env vars, updated client structure.

- [ ] **Step 4: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: update API reference, env vars, and architecture docs for MVP"
```

---

## Task 13: Final Integration Test and Verification

- [ ] **Step 1: Run full test suite**

Run: `yarn vp test`
Expected: All tests pass

- [ ] **Step 2: Run full check**

Run: `yarn vp check`
Expected: No lint, format, or type errors

- [ ] **Step 3: Test build**

Run: `yarn build`
Expected: Builds successfully (client, SSR, server)

- [ ] **Step 4: Manual smoke test**

Start the dev server with an encryption key and walk through the full flow:

1. Register a new user — verify session cookie is set
2. Connect Plex via OAuth flow
3. Configure AI provider with endpoint URL, API key, model
4. Start a recommendation conversation — verify recommendations display
5. Refine with follow-up message — verify conversation continues
6. Check conversation appears in History
7. Open Settings, verify Plex and AI configs are shown
8. Logout and verify redirect to login

- [ ] **Step 5: Commit any fixes found during smoke testing**
