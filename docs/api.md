# API Reference

## Health

### `GET /ping`

Returns a simple status response. Used by Docker for container health checks.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{ "status": "ok" }
```

---

### `GET /health`

Returns server status and uptime in seconds since the server started.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"status": "ok",
	"uptimeSeconds": 42.3
}
```

| Field           | Type     | Description                              |
| --------------- | -------- | ---------------------------------------- |
| `status`        | `string` | Always `"ok"`                            |
| `uptimeSeconds` | `number` | Seconds elapsed since the server started |

---

## Settings

### `GET /api/settings`

Returns all application settings as a key-value JSON object.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"app_version": "1.0.0"
}
```

| Field         | Type     | Description         |
| ------------- | -------- | ------------------- |
| `app_version` | `string` | Current app version |

Additional settings will appear as key-value pairs as they are added.

---

## Auth

### `GET /api/auth/setup-status`

Returns whether the application needs initial setup (no users exist yet).

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{ "needsSetup": true }
```

| Field        | Type      | Description                              |
| ------------ | --------- | ---------------------------------------- |
| `needsSetup` | `boolean` | `true` if no users exist in the database |

---

### `POST /api/auth/register`

Creates a new user account. The first user to register automatically becomes an admin.

**Request**

```json
{
	"username": "myuser",
	"password": "mypassword"
}
```

| Field      | Type     | Description                    |
| ---------- | -------- | ------------------------------ |
| `username` | `string` | Required, minimum 1 character  |
| `password` | `string` | Required, minimum 8 characters |

**Response `201 Created`**

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"username": "myuser",
	"isAdmin": true
}
```

**Response `409 Conflict`**

```json
{ "error": "Username already taken" }
```

---

### `POST /api/auth/login`

Authenticates a user with username and password.

**Request**

```json
{
	"username": "myuser",
	"password": "mypassword"
}
```

| Field      | Type     | Description                    |
| ---------- | -------- | ------------------------------ |
| `username` | `string` | Required, minimum 1 character  |
| `password` | `string` | Required, minimum 8 characters |

**Response `200 OK`**

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"username": "myuser",
	"isAdmin": true
}
```

**Response `401 Unauthorized`**

```json
{ "error": "Invalid username or password" }
```

---

### `GET /api/auth/me`

Returns the currently authenticated user based on the session cookie.

**Request**

No parameters or body required. Authentication via `session` cookie.

**Response `200 OK`**

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"username": "myuser",
	"isAdmin": true
}
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/auth/logout`

Logs out the current user by deleting the server-side session and clearing the session cookie.

**Request**

No parameters or body required. Authentication via `session` cookie.

**Response `200 OK`**

```json
{ "success": true }
```

---

## Plex

All Plex endpoints require authentication via `session` cookie.

### `POST /api/plex/auth/start`

Initiates a Plex OAuth flow by creating a PIN. The client should open the returned `authUrl` in a browser for the user to authorize.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"pinId": 123456789,
	"authUrl": "https://app.plex.tv/auth#?clientID=...&code=..."
}
```

| Field     | Type     | Description                             |
| --------- | -------- | --------------------------------------- |
| `pinId`   | `number` | PIN ID to use when checking auth status |
| `authUrl` | `string` | URL to open for user to authorize Plex  |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/plex/auth/check`

Checks whether a Plex PIN has been claimed (user authorized). If claimed, the Plex auth token is encrypted and stored.

**Request**

| Query Param | Type     | Description                             |
| ----------- | -------- | --------------------------------------- |
| `pinId`     | `number` | Required, the PIN ID from `/auth/start` |

**Response `200 OK`**

```json
{ "claimed": true }
```

| Field     | Type      | Description                               |
| --------- | --------- | ----------------------------------------- |
| `claimed` | `boolean` | `true` if the user authorized Plex access |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/plex/servers`

Returns the list of Plex servers available to the authenticated user.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"servers": [
		{
			"name": "My Plex Server",
			"address": "192.168.1.100",
			"port": 32400,
			"scheme": "http",
			"uri": "http://192.168.1.100:32400",
			"clientIdentifier": "abc123",
			"owned": true
		}
	]
}
```

**Response `404 Not Found`**

```json
{ "error": "No Plex connection found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/plex/servers/select`

Saves the selected Plex server for the authenticated user.

**Request**

```json
{
	"serverUrl": "http://192.168.1.100:32400",
	"serverName": "My Plex Server",
	"machineIdentifier": "abc123"
}
```

| Field               | Type     | Description                  |
| ------------------- | -------- | ---------------------------- |
| `serverUrl`         | `string` | Required, full URL of server |
| `serverName`        | `string` | Required, display name       |
| `machineIdentifier` | `string` | Required, unique server ID   |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `404 Not Found`**

```json
{ "error": "No Plex connection found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `DELETE /api/plex/connection`

Removes the Plex connection for the authenticated user.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{ "success": true }
```

**Response `404 Not Found`**

```json
{ "error": "No Plex connection found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/plex/libraries`

Returns the Plex libraries available on the selected server.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"libraries": [
		{
			"key": "1",
			"title": "Movies",
			"type": "movie"
		}
	]
}
```

| Field   | Type     | Description                         |
| ------- | -------- | ----------------------------------- |
| `key`   | `string` | Library section ID                  |
| `title` | `string` | Library display name                |
| `type`  | `string` | Library type (e.g. `movie`, `show`) |

**Response `404 Not Found`**

```json
{ "error": "No Plex connection found" }
```

**Response `400 Bad Request`**

```json
{ "error": "No Plex server selected" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

## AI

All AI endpoints require authentication via `session` cookie.

### `GET /api/ai/config`

Returns the AI configuration for the authenticated user. The API key is masked for security.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"endpointUrl": "https://api.openai.com/v1",
	"apiKey": "sk-****abcd",
	"modelName": "gpt-4",
	"temperature": 0.7,
	"maxTokens": 2048
}
```

| Field         | Type     | Description                        |
| ------------- | -------- | ---------------------------------- |
| `endpointUrl` | `string` | OpenAI-compatible API endpoint URL |
| `apiKey`      | `string` | Masked API key                     |
| `modelName`   | `string` | Model identifier                   |
| `temperature` | `number` | Sampling temperature (0-2)         |
| `maxTokens`   | `number` | Maximum tokens in response         |

**Response `404 Not Found`**

```json
{ "error": "No AI configuration found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `PUT /api/ai/config`

Creates or updates the AI configuration for the authenticated user. The API key is encrypted before storage.

**Request**

```json
{
	"endpointUrl": "https://api.openai.com/v1",
	"apiKey": "sk-my-secret-key",
	"modelName": "gpt-4",
	"temperature": 0.7,
	"maxTokens": 2048
}
```

| Field         | Type     | Description                   |
| ------------- | -------- | ----------------------------- |
| `endpointUrl` | `string` | Required, valid URL           |
| `apiKey`      | `string` | Required, minimum 1 character |
| `modelName`   | `string` | Required, minimum 1 character |
| `temperature` | `number` | Required, between 0 and 2     |
| `maxTokens`   | `number` | Required, positive integer    |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `DELETE /api/ai/config`

Removes the AI configuration for the authenticated user.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{ "success": true }
```

**Response `404 Not Found`**

```json
{ "error": "No AI configuration found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/ai/test`

Tests the saved AI configuration by making a connection to the configured endpoint.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"success": true
}
```

or on failure:

```json
{
	"success": false,
	"error": "Connection refused"
}
```

| Field     | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| `success` | `boolean` | Whether the connection test succeeded  |
| `error`   | `string`  | Optional, error message if test failed |

**Response `404 Not Found`**

```json
{ "error": "No AI configuration found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

## Chat

All chat endpoints require authentication via `session` cookie.

### `POST /api/chat`

Sends a message to the AI for media recommendations. Creates a new conversation or continues an existing one. Fetches watch history from Plex to personalize recommendations.

**Request**

```json
{
	"message": "Recommend me some sci-fi movies",
	"mediaType": "movie",
	"resultCount": 5,
	"conversationId": "optional-existing-conversation-id",
	"libraryIds": ["1", "3"]
}
```

| Field            | Type       | Description                                          |
| ---------------- | ---------- | ---------------------------------------------------- |
| `message`        | `string`   | Required, minimum 1 character                        |
| `mediaType`      | `string`   | Required, minimum 1 character (e.g. `movie`, `show`) |
| `resultCount`    | `number`   | Optional, 1-25, default 5                            |
| `conversationId` | `string`   | Optional, to continue an existing conversation       |
| `libraryIds`     | `string[]` | Optional, Plex library IDs to pull history from      |

**Response `200 OK`**

```json
{
	"conversationId": "550e8400-e29b-41d4-a716-446655440000",
	"message": "Here are some sci-fi movies you might enjoy...",
	"recommendations": [
		{
			"id": "rec-uuid",
			"title": "Arrival",
			"year": 2016,
			"mediaType": "movie",
			"synopsis": "A linguist works with the military...",
			"addedToArr": false
		}
	]
}
```

| Field             | Type     | Description                     |
| ----------------- | -------- | ------------------------------- |
| `conversationId`  | `string` | UUID of the conversation        |
| `message`         | `string` | AI conversational response text |
| `recommendations` | `array`  | List of recommended media items |

Each recommendation object:

| Field        | Type      | Description                             |
| ------------ | --------- | --------------------------------------- |
| `id`         | `string`  | Recommendation UUID                     |
| `title`      | `string`  | Media title                             |
| `year`       | `number`  | Optional, release year                  |
| `mediaType`  | `string`  | Type of media (e.g. `movie`, `show`)    |
| `synopsis`   | `string`  | Optional, brief description             |
| `tmdbId`     | `number`  | Optional, TMDB ID                       |
| `addedToArr` | `boolean` | Whether item was added to \*arr service |

**Response `404 Not Found`**

```json
{ "error": "No AI configuration found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/conversations`

Returns all conversations for the authenticated user.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"conversations": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"mediaType": "movie",
			"title": "Sci-fi Movie Recommendations",
			"createdAt": "2024-01-15T10:30:00.000Z"
		}
	]
}
```

| Field       | Type     | Description                               |
| ----------- | -------- | ----------------------------------------- |
| `id`        | `string` | Conversation UUID                         |
| `mediaType` | `string` | Media type for this conversation          |
| `title`     | `string` | Optional, AI-generated conversation title |
| `createdAt` | `string` | ISO 8601 timestamp                        |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/conversations/:id`

Returns a single conversation with all its messages and recommendations.

**Request**

| Path Param | Type     | Description       |
| ---------- | -------- | ----------------- |
| `id`       | `string` | Conversation UUID |

**Response `200 OK`**

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"mediaType": "movie",
	"title": "Sci-fi Movie Recommendations",
	"createdAt": "2024-01-15T10:30:00.000Z",
	"messages": [
		{
			"id": "msg-uuid",
			"role": "user",
			"content": "Recommend me some sci-fi movies",
			"createdAt": "2024-01-15T10:30:00.000Z",
			"recommendations": []
		},
		{
			"id": "msg-uuid-2",
			"role": "assistant",
			"content": "Here are some great sci-fi movies...",
			"createdAt": "2024-01-15T10:30:01.000Z",
			"recommendations": [
				{
					"id": "rec-uuid",
					"title": "Arrival",
					"year": 2016,
					"mediaType": "movie",
					"synopsis": "A linguist works with the military...",
					"addedToArr": false
				}
			]
		}
	]
}
```

**Response `404 Not Found`**

```json
{ "error": "Conversation not found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `DELETE /api/conversations/:id`

Deletes a conversation and all its messages and recommendations (cascade delete).

**Request**

| Path Param | Type     | Description       |
| ---------- | -------- | ----------------- |
| `id`       | `string` | Conversation UUID |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `404 Not Found`**

```json
{ "error": "Conversation not found" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

## SSR

### `GET /*` (catch-all)

Serves the React application via server-side rendering. All routes not matched by API endpoints above are handled by SSR, which renders the React app to HTML on the server and sends it to the browser for hydration.

**Response `200 OK`**

Returns full HTML page with server-rendered React content.
