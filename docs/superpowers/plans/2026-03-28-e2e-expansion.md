# E2E Test Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual Plex token auth, Docker Compose mock services, and comprehensive e2e tests that exercise real server code.

**Architecture:** New `POST /api/plex/auth/manual` endpoint stores token + server info directly, bypassing OAuth. `GET /api/plex/servers` returns stored server info when `serverUrl` is already set (skipping Plex discovery). A Fastify-based mock server runs three instances (Plex :9090, Radarr :7878, Sonarr :8989) in Docker Compose alongside the app. E2e tests configure these mock URLs through the UI, so requests flow through the full Fastify stack.

**Tech Stack:** Fastify, Zod, Drizzle ORM, RTK Query, Playwright, Docker Compose

**Spec:** `docs/superpowers/specs/2026-03-28-e2e-expansion-design.md`

---

## File Map

**Server — new/modified:**

- Modify: `src/server/routes/plex.ts` — add `POST /api/plex/auth/manual`, modify `GET /api/plex/servers` to return stored server when `serverUrl` is set

**Client — new/modified:**

- Modify: `src/client/features/plex/api.ts` — add `manualPlexAuth` mutation
- Modify: `src/client/pages/settings/PlexTab.tsx` — add collapsible manual connection form to `PlexNotConnected`, update `PlexTab` to show connected state for manual connections

**Mock services — all new:**

- Create: `e2e/mock-services/package.json`
- Create: `e2e/mock-services/tsconfig.json`
- Create: `e2e/mock-services/mock-server.ts`
- Create: `e2e/mock-services/Dockerfile.mock`

**Infrastructure:**

- Modify: `scripts/docker-compose.yml` — add `mock-services` container (compose `build` directive handles building the mock image)

**E2E tests — new/modified:**

- Create: `e2e/plex-connection.test.ts`
- Create: `e2e/ai-config.test.ts`
- Create: `e2e/navigation.test.ts`
- Modify: `e2e/arr-integration.test.ts` — use mock service URL, remove `page.route` intercept

**Unit tests:**

- Modify: `src/server/__tests__/plex.test.ts` — add tests for manual auth endpoint and servers shortcut

**Docs:**

- Modify: `CLAUDE.md` — add manual auth route to route list

---

### Task 1: Manual Plex Auth — Server Endpoint

**Files:**

- Modify: `src/server/routes/plex.ts`

- [ ] **Step 1: Add manual auth Zod schema and endpoint**

In `src/server/routes/plex.ts`, add the schema after the existing `authCheckResponseSchema`:

```typescript
const manualAuthBodySchema = z.object({
	authToken: z.string().min(1),
	serverUrl: z.string().url(),
	serverName: z.string().min(1),
});
```

Then add the route inside the `plexRoutes` function, after the `/api/plex/auth/check` route:

```typescript
typedApp.post(
	"/api/plex/auth/manual",
	{
		schema: {
			body: manualAuthBodySchema,
			response: {
				[StatusCodes.OK]: successResponseSchema,
				[StatusCodes.UNAUTHORIZED]: errorResponseSchema,
			},
		},
	},
	async (request, reply) => {
		if (!request.user) {
			return reply.code(StatusCodes.UNAUTHORIZED).send({ error: "Authentication required" });
		}

		const { authToken, serverUrl, serverName } = request.body;
		const now = new Date().toISOString();
		const encryptedToken = encrypt(authToken);

		const existing = app.db
			.select()
			.from(plexConnections)
			.where(eq(plexConnections.userId, request.user.id))
			.get();

		if (existing) {
			app.db
				.update(plexConnections)
				.set({
					authToken: encryptedToken,
					serverUrl,
					serverName,
					machineIdentifier: `manual-${randomUUID()}`,
					updatedAt: now,
				})
				.where(eq(plexConnections.userId, request.user.id))
				.run();
		} else {
			app.db
				.insert(plexConnections)
				.values({
					id: randomUUID(),
					userId: request.user.id,
					authToken: encryptedToken,
					serverUrl,
					serverName,
					machineIdentifier: `manual-${randomUUID()}`,
					createdAt: now,
					updatedAt: now,
				})
				.run();
		}

		return reply.code(StatusCodes.OK).send({ success: true });
	},
);
```

- [ ] **Step 2: Modify GET /api/plex/servers to return stored server when serverUrl is set**

In the same file, modify the existing `GET /api/plex/servers` handler. Replace the section after the `!connection` check (lines ~175-178) so that if `serverUrl` is already set, it returns the stored info directly instead of calling the Plex discovery API:

Replace:

```typescript
const authToken = decrypt(connection.authToken);
const servers = await getPlexServers(authToken);

return reply.code(StatusCodes.OK).send({ servers });
```

With:

```typescript
if (connection.serverUrl && connection.serverName) {
	return reply.code(StatusCodes.OK).send({
		servers: [
			{
				name: connection.serverName,
				address: connection.serverUrl,
				port: 32400,
				scheme: "http",
				uri: connection.serverUrl,
				clientIdentifier: connection.machineIdentifier ?? "manual",
				owned: true,
			},
		],
	});
}

const authToken = decrypt(connection.authToken);
const servers = await getPlexServers(authToken);

return reply.code(StatusCodes.OK).send({ servers });
```

- [ ] **Step 3: Run existing unit tests to confirm no regressions**

Run: `yarn vp test src/server/__tests__/plex.test.ts`
Expected: All existing tests pass. The `getPlexServers` mock in existing tests stores connections without `serverUrl` set, so they still hit the mocked discovery path.

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/plex.ts
git commit -m "feat: add POST /api/plex/auth/manual endpoint and servers shortcut for stored connections"
```

---

### Task 2: Manual Plex Auth — Unit Tests

**Files:**

- Modify: `src/server/__tests__/plex.test.ts`

- [ ] **Step 1: Add unit test for POST /api/plex/auth/manual**

Add these tests inside the existing `describe("plex routes", ...)` block in `src/server/__tests__/plex.test.ts`. Use the same `getSessionCookie` helper that exists in the file:

```typescript
test("POST /api/plex/auth/manual stores connection and returns success", async () => {
	const app = await buildServer({ skipSSR: true });
	onTestFinished(async () => {
		await app.close();
	});

	const { sessionId } = await getSessionCookie(app);

	const response = await app.inject({
		method: "POST",
		url: "/api/plex/auth/manual",
		payload: {
			authToken: "manual-test-token-123",
			serverUrl: "http://192.168.1.100:32400",
			serverName: "My Local Server",
		},
		cookies: { session: sessionId },
	});

	expect(response.statusCode).toBe(StatusCodes.OK);
	expect(response.json()).toEqual({ success: true });

	// Verify the connection is stored in the database
	const connections = app.db.select().from(plexConnections).all();

	expect(connections).toHaveLength(1);
	expect(connections[FIRST]?.serverUrl).toBe("http://192.168.1.100:32400");
	expect(connections[FIRST]?.serverName).toBe("My Local Server");
});

test("POST /api/plex/auth/manual returns 401 without session", async () => {
	const app = await buildServer({ skipSSR: true });
	onTestFinished(async () => {
		await app.close();
	});

	const response = await app.inject({
		method: "POST",
		url: "/api/plex/auth/manual",
		payload: {
			authToken: "token",
			serverUrl: "http://192.168.1.100:32400",
			serverName: "Server",
		},
	});

	expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
});
```

- [ ] **Step 2: Add unit test for GET /api/plex/servers returning stored server**

```typescript
test("GET /api/plex/servers returns stored server when serverUrl is set", async () => {
	const app = await buildServer({ skipSSR: true });
	onTestFinished(async () => {
		await app.close();
	});

	const { sessionId, userId } = await getSessionCookie(app);

	// Manually insert a connection with serverUrl set (simulates manual auth)
	const now = new Date().toISOString();
	app.db
		.insert(plexConnections)
		.values({
			id: randomUUID(),
			userId,
			authToken: encrypt("fake-token"),
			serverUrl: "http://my-plex:32400",
			serverName: "My Manual Server",
			machineIdentifier: "manual-abc",
			createdAt: now,
			updatedAt: now,
		})
		.run();

	const response = await app.inject({
		method: "GET",
		url: "/api/plex/servers",
		cookies: { session: sessionId },
	});

	expect(response.statusCode).toBe(StatusCodes.OK);
	const body = response.json();
	expect(body.servers).toHaveLength(ONE_SERVER);
	expect(body.servers[FIRST].name).toBe("My Manual Server");
	expect(body.servers[FIRST].uri).toBe("http://my-plex:32400");
	expect(body.servers[FIRST].owned).toBe(true);
});
```

You'll need to add `randomUUID` to the imports from `node:crypto` at the top of the file (it's already imported in the routes file but check the test file). Also add `encrypt` to the imports from `../services/encryption.ts`.

- [ ] **Step 3: Run the tests**

Run: `yarn vp test src/server/__tests__/plex.test.ts`
Expected: All tests pass, including the new ones.

- [ ] **Step 4: Commit**

```bash
git add src/server/__tests__/plex.test.ts
git commit -m "test: add unit tests for manual Plex auth and stored server shortcut"
```

---

### Task 3: Manual Plex Auth — Client API + UI

**Files:**

- Modify: `src/client/features/plex/api.ts`
- Modify: `src/client/pages/settings/PlexTab.tsx`

- [ ] **Step 1: Add manualPlexAuth mutation to client API**

In `src/client/features/plex/api.ts`, add the interface and mutation endpoint:

Add the interface after `SelectPlexServerBody`:

```typescript
interface ManualPlexAuthBody {
	authToken: string;
	serverUrl: string;
	serverName: string;
}
```

Add the endpoint inside `api.injectEndpoints` after `disconnectPlex`:

```typescript
manualPlexAuth: builder.mutation<{ success: boolean }, ManualPlexAuthBody>({
	query: (body) => ({
		url: "api/plex/auth/manual",
		method: "POST",
		body,
	}),
	invalidatesTags: ["PlexConnection"],
}),
```

Add to the destructured hooks:

```typescript
useManualPlexAuthMutation,
```

Add to the export block:

```typescript
useManualPlexAuthMutation,
```

- [ ] **Step 2: Add ManualPlexConnection component to PlexTab**

In `src/client/pages/settings/PlexTab.tsx`, add the imports and component.

Add to the imports at the top:

```typescript
import { css } from "@linaria/atomic";
import { useCallback, useMemo, useState } from "react";
```

(Replace the existing import — add `useState` to it.)

Add `useManualPlexAuthMutation` to the plex api import:

```typescript
import {
	useDisconnectPlexMutation,
	useGetPlexServersQuery,
	useManualPlexAuthMutation,
	useSelectPlexServerMutation,
} from "../../features/plex/api.ts";
```

Add `SettingsField` import:

```typescript
import { SettingsField } from "./SettingsField.tsx";
```

Add these styles after the existing `connectedLabel` style:

```typescript
const collapsibleHeader = css`
	display: flex;
	align-items: center;
	gap: ${spacing.sm};
	background: none;
	border: none;
	color: ${colors.textMuted};
	cursor: pointer;
	font-size: 0.9rem;
	padding: ${spacing.sm} 0;
	width: 100%;
	text-align: left;
	transition: color 0.2s ease;

	&:hover {
		color: ${colors.text};
	}
`;

const collapsibleContent = css`
	padding-top: ${spacing.sm};
`;
```

Add the `ManualPlexConnection` component before `PlexNotConnected`:

```typescript
const ManualPlexConnection = () => {
	const [showManual, setShowManual] = useState(false);
	const [authToken, setAuthToken] = useState("");
	const [serverUrl, setServerUrl] = useState("");
	const [serverName, setServerName] = useState("");
	const [manualAuth, { isLoading, error }] = useManualPlexAuthMutation();

	const toggleManual = useCallback(() => {
		setShowManual((prev) => !prev);
	}, []);

	const handleAuthTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setAuthToken(event.target.value);
	}, []);

	const handleServerUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setServerUrl(event.target.value);
	}, []);

	const handleServerNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setServerName(event.target.value);
	}, []);

	const handleConnect = useCallback(async () => {
		await manualAuth({ authToken, serverUrl, serverName });
	}, [manualAuth, authToken, serverUrl, serverName]);

	return (
		<>
			<button type="button" className={collapsibleHeader} onClick={toggleManual}>
				{showManual ? "Hide" : "Show"} Manual Connection
			</button>
			{showManual && (
				<div className={collapsibleContent}>
					<SettingsField
						id="plexAuthToken"
						label="Auth Token"
						type="password"
						value={authToken}
						onChange={handleAuthTokenChange}
					/>
					<SettingsField
						id="plexServerUrl"
						label="Server URL"
						value={serverUrl}
						onChange={handleServerUrlChange}
						placeholder="http://192.168.1.100:32400"
					/>
					<SettingsField
						id="plexServerName"
						label="Server Name"
						value={serverName}
						onChange={handleServerNameChange}
						placeholder="My Plex Server"
					/>
					<div className={buttonRow}>
						<button
							type="button"
							className={primaryButton}
							onClick={handleConnect}
							disabled={isLoading}
						>
							{isLoading ? "Connecting..." : "Connect"}
						</button>
					</div>
					{error && <p className={errorText}>Failed to connect</p>}
				</div>
			)}
		</>
	);
};
```

- [ ] **Step 3: Update PlexNotConnected to include ManualPlexConnection**

Replace the `PlexNotConnected` component:

```typescript
const PlexNotConnected = () => {
	const { connect, isStarting, polling, error } = usePlexAuth();

	return (
		<div className={sectionCard}>
			<h3 className={sectionTitle}>Plex Connection</h3>
			<p className={statusText}>Connect your Plex account to get personalized recommendations.</p>
			<div className={buttonRow}>
				<button
					type="button"
					className={primaryButton}
					onClick={connect}
					disabled={isStarting || polling}
				>
					{polling ? "Waiting for authentication..." : "Connect Plex"}
				</button>
			</div>
			{error && <p className={errorText}>{error}</p>}
			<ManualPlexConnection />
		</div>
	);
};
```

- [ ] **Step 4: Run type check and lint**

Run: `yarn vp check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/features/plex/api.ts src/client/pages/settings/PlexTab.tsx
git commit -m "feat: add manual Plex connection UI with collapsible form"
```

---

### Task 4: Mock Services

**Files:**

- Create: `e2e/mock-services/package.json`
- Create: `e2e/mock-services/tsconfig.json`
- Create: `e2e/mock-services/mock-server.ts`
- Create: `e2e/mock-services/Dockerfile.mock`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "recommendarr-mock-services",
	"version": "1.0.0",
	"private": true,
	"type": "module",
	"dependencies": {
		"fastify": "5.3.3"
	}
}
```

Use whatever the latest Fastify 5.x is — check the main project's `package.json` for the exact version pinned there.

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"outDir": "dist",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true
	},
	"include": ["mock-server.ts"]
}
```

- [ ] **Step 3: Create mock-server.ts**

```typescript
import Fastify from "fastify";

import type { FastifyReply, FastifyRequest } from "fastify";

const PLEX_PORT = 9090;
const RADARR_PORT = 7878;
const SONARR_PORT = 8989;

// ── Auth middleware helpers ──────────────────────────────────

const requirePlexToken = (request: FastifyRequest, reply: FastifyReply) => {
	const token = request.headers["x-plex-token"];
	if (!token) {
		reply.code(401).send({ error: "Unauthorized" });
	}
};

const requireArrApiKey = (request: FastifyRequest, reply: FastifyReply) => {
	const key = request.headers["x-api-key"];
	if (!key) {
		reply.code(401).send({ error: "Unauthorized" });
	}
};

// ── Mock data ───────────────────────────────────────────────

const plexLibraries = {
	MediaContainer: {
		Directory: [
			{ key: "1", title: "Movies", type: "movie" },
			{ key: "2", title: "TV Shows", type: "show" },
		],
	},
};

const plexWatchHistory = {
	MediaContainer: {
		Metadata: [
			{
				title: "The Shawshank Redemption",
				type: "movie",
				year: 1994,
				ratingKey: "1001",
				viewedAt: 1711500000,
			},
			{
				title: "The Dark Knight",
				type: "movie",
				year: 2008,
				ratingKey: "1002",
				viewedAt: 1711400000,
			},
			{ title: "Inception", type: "movie", year: 2010, ratingKey: "1003", viewedAt: 1711300000 },
			{ title: "Pulp Fiction", type: "movie", year: 1994, ratingKey: "1004", viewedAt: 1711200000 },
			{ title: "The Matrix", type: "movie", year: 1999, ratingKey: "1005", viewedAt: 1711100000 },
		],
	},
};

const radarrMovieLookup = [
	{
		id: 0,
		title: "The Shawshank Redemption",
		year: 1994,
		tmdbId: 278,
		overview:
			"Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison.",
	},
	{
		id: 0,
		title: "The Shawshank Redemption 2",
		year: 2025,
		tmdbId: 99999,
		overview: "A fictional sequel for testing purposes.",
	},
];

const sonarrSeriesLookup = [
	{
		id: 0,
		title: "Breaking Bad",
		year: 2008,
		tvdbId: 81189,
		overview:
			"A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
	},
	{
		id: 0,
		title: "Better Call Saul",
		year: 2015,
		tvdbId: 273181,
		overview: "The trials and tribulations of criminal lawyer Jimmy McGill.",
	},
];

// ── Plex mock (port 9090) ───────────────────────────────────

const createPlexMock = async () => {
	const plex = Fastify();

	plex.get("/healthz", async () => ({ status: "ok" }));

	plex.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requirePlexToken(request, reply);
		done();
	});

	plex.get("/library/sections", async () => plexLibraries);

	plex.get("/library/sections/:id/allLeaves", async () => plexWatchHistory);

	await plex.listen({ port: PLEX_PORT, host: "0.0.0.0" });
	console.log(`Mock Plex server listening on port ${String(PLEX_PORT)}`);
};

// ── Radarr mock (port 7878) ─────────────────────────────────

const createRadarrMock = async () => {
	const radarr = Fastify();

	radarr.get("/healthz", async () => ({ status: "ok" }));

	radarr.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requireArrApiKey(request, reply);
		done();
	});

	radarr.get("/api/v3/system/status", async () => ({ version: "5.3.6" }));
	radarr.get("/api/v3/rootfolder", async () => [
		{ id: 1, path: "/movies", freeSpace: 100000000000 },
	]);
	radarr.get("/api/v3/qualityprofile", async () => [{ id: 1, name: "HD-1080p" }]);
	radarr.get("/api/v3/movie/lookup", async () => radarrMovieLookup);
	radarr.post("/api/v3/movie", async () => ({ id: 1 }));

	await radarr.listen({ port: RADARR_PORT, host: "0.0.0.0" });
	console.log(`Mock Radarr server listening on port ${String(RADARR_PORT)}`);
};

// ── Sonarr mock (port 8989) ─────────────────────────────────

const createSonarrMock = async () => {
	const sonarr = Fastify();

	sonarr.get("/healthz", async () => ({ status: "ok" }));

	sonarr.addHook("onRequest", (request, reply, done) => {
		if (request.url === "/healthz") {
			done();
			return;
		}
		requireArrApiKey(request, reply);
		done();
	});

	sonarr.get("/api/v3/system/status", async () => ({ version: "4.0.1" }));
	sonarr.get("/api/v3/rootfolder", async () => [{ id: 1, path: "/tv", freeSpace: 100000000000 }]);
	sonarr.get("/api/v3/qualityprofile", async () => [{ id: 1, name: "HD-1080p" }]);
	sonarr.get("/api/v3/series/lookup", async () => sonarrSeriesLookup);
	sonarr.post("/api/v3/series", async () => ({ id: 1 }));

	await sonarr.listen({ port: SONARR_PORT, host: "0.0.0.0" });
	console.log(`Mock Sonarr server listening on port ${String(SONARR_PORT)}`);
};

// ── Start all ───────────────────────────────────────────────

await Promise.all([createPlexMock(), createRadarrMock(), createSonarrMock()]);
console.log("All mock services started");
```

- [ ] **Step 4: Create Dockerfile.mock**

```dockerfile
FROM node:24.14.0-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json ./
COPY tsconfig.json ./
COPY mock-server.ts ./

RUN npm install
RUN npx tsc

CMD ["node", "dist/mock-server.js"]
```

- [ ] **Step 5: Test the mock services build locally**

Run: `cd e2e/mock-services && docker build -f Dockerfile.mock -t mock-services:test . && cd ../..`
Expected: Image builds successfully.

- [ ] **Step 6: Commit**

```bash
git add e2e/mock-services/
git commit -m "feat: add Fastify mock services for Plex, Radarr, and Sonarr"
```

---

### Task 5: Docker Compose + E2E Script Updates

**Files:**

- Modify: `scripts/docker-compose.yml`
- Modify: `scripts/e2e.sh`

- [ ] **Step 1: Update docker-compose.yml**

Replace the entire contents of `scripts/docker-compose.yml`:

```yaml
services:
  mock-services:
    build:
      context: ../e2e/mock-services
      dockerfile: Dockerfile.mock
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:7878/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ]
      interval: 2s
      timeout: 3s
      start_period: 5s
      retries: 3

  recommendarr:
    image: recommendarr:e2e
    depends_on:
      mock-services:
        condition: service_healthy
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      ENCRYPTION_KEY: "97edee5ae27e974c3705ef05bd4a11f6cd1e233ee088de4892bf4417fca402f0"
      NODE_ENV: "production"
    tmpfs:
      - /app/data
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:8080/ping').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ]
      interval: 5s
      timeout: 5s
      start_period: 10s
      retries: 3
```

- [ ] **Step 2: Update e2e.sh to build mock services image**

In `scripts/e2e.sh`, add the mock services build after the app image build. Replace:

```bash
echo "Building Docker image..."
docker build "$PROJECT_DIR" -t recommendarr:e2e
```

With:

```bash
echo "Building Docker images..."
docker build "$PROJECT_DIR" -t recommendarr:e2e
docker build "$PROJECT_DIR/e2e/mock-services" -f "$PROJECT_DIR/e2e/mock-services/Dockerfile.mock" -t mock-services:e2e
```

Also update the docker-compose to use the pre-built mock image. Actually, since docker-compose `build` will build it inline, we don't need a separate build step. Remove the separate mock build and let compose handle it. Revert the e2e.sh change — the compose file's `build` directive handles building the mock image.

Keep `scripts/e2e.sh` as-is. The compose `build` directive will build the mock services automatically on `docker compose up`.

- [ ] **Step 3: Test that compose starts both services**

Run: `cd scripts && docker compose build && docker compose up -d --wait && docker compose ps && docker compose down --volumes && cd ..`
Expected: Both `mock-services` and `recommendarr` containers start and become healthy.

- [ ] **Step 4: Commit**

```bash
git add scripts/docker-compose.yml
git commit -m "infra: add mock-services to e2e Docker Compose"
```

---

### Task 6: Migrate arr-integration Tests to Mock Services

**Files:**

- Modify: `e2e/arr-integration.test.ts`

- [ ] **Step 1: Update arr-integration to use mock Radarr URL**

In `e2e/arr-integration.test.ts`, change the URL constant:

Replace:

```typescript
const radarrUrl = "http://radarr.local:7878";
```

With:

```typescript
const radarrUrl = "http://mock-services:7878";
```

- [ ] **Step 2: Remove browser-level page.route mock from test Radarr connection test**

Replace the entire "test Radarr connection shows success message" test:

```typescript
test("test Radarr connection shows success message", async ({ page }) => {
	await page.goto("/login");
	await page.getByLabel("Username").fill(adminUsername);
	await page.getByLabel("Password").fill(adminPassword);
	await page.getByRole("button", { name: /log in/i }).click();

	await expect(page).toHaveURL("/");
	await page.goto("/settings");
	await page.getByRole("button", { name: "Integrations" }).click();

	// The connection was saved in the previous test, so Test Connection should be visible
	await page.getByRole("button", { name: "Test Connection" }).first().click();

	await expect(page.getByText(/Connection successful/)).toBeVisible();
	await expect(page.getByText("5.3.6")).toBeVisible();
});
```

- [ ] **Step 3: Run e2e tests to verify**

Run: `yarn test:e2e`
Expected: All tests pass across all three browsers. The "test Radarr connection" test now exercises the full server path: Fastify auth → DB lookup → decrypt API key → arr-client fetch → mock Radarr `/api/v3/system/status`.

- [ ] **Step 4: Commit**

```bash
git add e2e/arr-integration.test.ts
git commit -m "test: migrate arr integration e2e to use mock Radarr service"
```

---

### Task 7: Plex Connection E2E Test

**Files:**

- Create: `e2e/plex-connection.test.ts`

- [ ] **Step 1: Create the plex connection e2e test**

```typescript
import { expect, test } from "@playwright/test";

const password = "plextest1234";
const mockPlexUrl = "http://mock-services:9090";
const mockServerName = "E2E Plex Server";
const mockAuthToken = "e2e-plex-token-abc123";

test.describe.configure({ mode: "serial" });

test.describe("plex connection settings flow", () => {
	let username: string;

	test.beforeAll(({}, testInfo) => {
		username = `plex-e2e-${testInfo.project.name}`;
	});

	test("register user for plex connection tests", async ({ page }) => {
		await page.goto("/register");

		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByLabel("Confirm Password").fill(password);
		await page.getByRole("button", { name: /register/i }).click();

		await expect(page).toHaveURL("/");
	});

	test("navigate to Settings and verify Plex tab is default", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await expect(page.getByRole("heading", { level: 3, name: "Plex Connection" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});

	test("expand manual connection and fill in details", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await page.getByText("Show Manual Connection").click();

		await page.getByLabel("Auth Token").fill(mockAuthToken);
		await page.getByLabel("Server URL").fill(mockPlexUrl);
		await page.getByLabel("Server Name").fill(mockServerName);

		// Click the Connect button inside the manual connection section
		await page.getByRole("button", { name: "Connect" }).click();

		// Should transition to connected state showing the server name
		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("connection persists after navigation", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");

		// Navigate to settings
		await page.goto("/settings");

		// Should still show connected state
		await expect(page.getByText(mockServerName)).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
	});

	test("disconnect Plex returns to not-connected state", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");

		await page.getByRole("button", { name: "Disconnect" }).click();

		// Should return to not-connected state
		await expect(page.getByRole("button", { name: "Connect Plex" })).toBeVisible();
		await expect(page.getByText("Show Manual Connection")).toBeVisible();
	});
});
```

- [ ] **Step 2: Run e2e tests**

Run: `yarn test:e2e`
Expected: All tests pass including the new plex connection suite.

- [ ] **Step 3: Commit**

```bash
git add e2e/plex-connection.test.ts
git commit -m "test: add e2e tests for Plex manual connection flow"
```

---

### Task 8: AI Configuration E2E Test

**Files:**

- Create: `e2e/ai-config.test.ts`

- [ ] **Step 1: Create the AI config e2e test**

```typescript
import { expect, test } from "@playwright/test";

const password = "aitest1234";
const testEndpoint = "https://api.openai.com/v1";
const testApiKey = "sk-test-key-1234567890abcdef";
const testModel = "gpt-4";

test.describe.configure({ mode: "serial" });

test.describe("AI configuration settings flow", () => {
	let username: string;

	test.beforeAll(({}, testInfo) => {
		username = `ai-e2e-${testInfo.project.name}`;
	});

	test("register user for AI config tests", async ({ page }) => {
		await page.goto("/register");

		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByLabel("Confirm Password").fill(password);
		await page.getByRole("button", { name: /register/i }).click();

		await expect(page).toHaveURL("/");
	});

	test("navigate to Settings > AI Configuration tab", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await expect(page.getByRole("heading", { level: 3, name: "AI Configuration" })).toBeVisible();
	});

	test("fill in AI config and save", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByLabel("Endpoint URL").fill(testEndpoint);
		await page.getByLabel("API Key").fill(testApiKey);
		await page.getByLabel("Model Name").fill(testModel);

		await page.getByRole("button", { name: "Save" }).click();

		// After saving, Test Connection and Remove buttons should appear
		await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
	});

	test("advanced settings are accessible", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByText("Show Advanced Settings").click();

		await expect(page.getByText("Temperature")).toBeVisible();
		await expect(page.getByText("Max Tokens")).toBeVisible();
	});

	test("test connection shows success message", async ({ page }) => {
		// Browser-mock the AI test endpoint since OpenAI SDK is not simple REST
		await page.route("/api/ai/test", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		});

		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Test Connection" }).click();

		await expect(page.getByText("Connection successful")).toBeVisible();
	});

	test("remove AI config clears fields", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();

		await expect(page).toHaveURL("/");
		await page.goto("/settings");
		await page.getByRole("button", { name: "AI Configuration" }).click();

		await page.getByRole("button", { name: "Remove" }).click();

		// After removal, Test Connection and Remove should be gone
		await expect(page.getByRole("button", { name: "Test Connection" })).not.toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" })).not.toBeVisible();
	});
});
```

- [ ] **Step 2: Run e2e tests**

Run: `yarn test:e2e`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/ai-config.test.ts
git commit -m "test: add e2e tests for AI configuration settings flow"
```

---

### Task 9: Navigation E2E Test

**Files:**

- Create: `e2e/navigation.test.ts`

- [ ] **Step 1: Create the navigation e2e test**

```typescript
import { expect, test } from "@playwright/test";

const password = "navtest1234";

test.describe("navigation", () => {
	let username: string;

	test.beforeAll(({}, testInfo) => {
		username = `nav-e2e-${testInfo.project.name}`;
	});

	test.beforeEach(async ({ page }) => {
		// Register or login before each test
		await page.goto("/login");

		// Try to register first (will fail silently if user exists)
		await page.goto("/register");
		const registerButton = page.getByRole("button", { name: /register/i });
		if (await registerButton.isVisible()) {
			await page.getByLabel("Username").fill(username);
			await page.getByLabel("Password", { exact: true }).fill(password);
			await page.getByLabel("Confirm Password").fill(password);
			await registerButton.click();

			// If we get redirected to /, we're registered and logged in
			const url = page.url();
			if (url.endsWith("/")) {
				return;
			}
		}

		// Fall back to login
		await page.goto("/login");
		await page.getByLabel("Username").fill(username);
		await page.getByLabel("Password").fill(password);
		await page.getByRole("button", { name: /log in/i }).click();
		await expect(page).toHaveURL("/");
	});

	test("landing page shows Recommendations", async ({ page }) => {
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Recommendations")).toBeVisible();
	});

	test("sidebar Settings link navigates to /settings", async ({ page }) => {
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");
		await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
	});

	test("sidebar History link navigates to /history", async ({ page }) => {
		await page.getByRole("link", { name: "History" }).click();
		await expect(page).toHaveURL("/history");
		await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
	});

	test("sidebar Recommendations link navigates to /", async ({ page }) => {
		// Navigate away first
		await page.getByRole("link", { name: "Settings" }).click();
		await expect(page).toHaveURL("/settings");

		// Then navigate back
		await page.getByRole("link", { name: "Recommendations" }).click();
		await expect(page).toHaveURL("/");
	});

	test("unknown route redirects to /", async ({ page }) => {
		await page.goto("/nonexistent-page");
		await expect(page).toHaveURL("/");
	});
});
```

- [ ] **Step 2: Run e2e tests**

Run: `yarn test:e2e`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/navigation.test.ts
git commit -m "test: add e2e tests for sidebar navigation and route redirects"
```

---

### Task 10: Update Documentation

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the manual auth route to CLAUDE.md route list**

In the **Current routes** section of `CLAUDE.md`, add after the `DELETE /api/plex/connection` entry:

```
- `POST /api/plex/auth/manual` — stores a manually-provided Plex auth token and server URL
```

- [ ] **Step 2: Run full verification**

Run: `yarn vp check && yarn vp test && yarn test:e2e`
Expected: All checks, unit tests, and e2e tests pass.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add manual Plex auth route to CLAUDE.md"
```
