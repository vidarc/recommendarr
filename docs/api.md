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

| Field        | Type      | Description                                  |
| ------------ | --------- | -------------------------------------------- |
| `id`         | `string`  | Recommendation UUID                          |
| `title`      | `string`  | Media title                                  |
| `year`       | `number`  | Optional, release year                       |
| `mediaType`  | `string`  | Type of media (e.g. `movie`, `show`)         |
| `synopsis`   | `string`  | Optional, brief description                  |
| `tmdbId`     | `number`  | Optional, TMDB ID                            |
| `addedToArr` | `boolean` | Whether item was added to \*arr service      |
| `feedback`   | `string`  | Optional. `"liked"`, `"disliked"`, or `null` |

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

## Arr (Radarr/Sonarr)

All arr endpoints require authentication via `session` cookie.

### `GET /api/arr/config`

Returns the arr connections for the authenticated user. API keys are masked for security.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
[
	{
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"serviceType": "radarr",
		"url": "http://localhost:7878",
		"apiKey": "****abcd"
	}
]
```

| Field         | Type     | Description                             |
| ------------- | -------- | --------------------------------------- |
| `id`          | `string` | Connection UUID                         |
| `serviceType` | `string` | Service type (`"radarr"` or `"sonarr"`) |
| `url`         | `string` | Base URL of the arr service             |
| `apiKey`      | `string` | Masked API key                          |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `PUT /api/arr/config/:serviceType`

Creates or updates an arr connection for the authenticated user. The API key is encrypted before storage.

**Request**

| Path Param    | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `serviceType` | `string` | Service type: `"radarr"` or `"sonarr"` |

```json
{
	"url": "http://localhost:7878",
	"apiKey": "my-arr-api-key"
}
```

| Field    | Type     | Description                   |
| -------- | -------- | ----------------------------- |
| `url`    | `string` | Required, valid URL           |
| `apiKey` | `string` | Required, minimum 1 character |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `DELETE /api/arr/config/:serviceType`

Removes an arr connection for the authenticated user.

**Request**

| Path Param    | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `serviceType` | `string` | Service type: `"radarr"` or `"sonarr"` |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `404 Not Found`**

```json
{ "error": "No arr connection found for this service type" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/arr/test`

Tests the saved arr connection by connecting to the arr service endpoint.

**Request**

```json
{
	"serviceType": "radarr"
}
```

| Field         | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `serviceType` | `string` | Service type: `"radarr"` or `"sonarr"` |

**Response `200 OK`**

```json
{
	"success": true,
	"version": "5.3.6"
}
```

| Field     | Type      | Description                             |
| --------- | --------- | --------------------------------------- |
| `success` | `boolean` | Whether the connection test succeeded   |
| `version` | `string`  | Optional. Service version if successful |
| `error`   | `string`  | Optional. Error message if unsuccessful |

**Response `404 Not Found`**

```json
{ "error": "No arr connection found for this service type" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/arr/options/:serviceType`

Returns the root folders and quality profiles available on the arr service.

**Request**

| Path Param    | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `serviceType` | `string` | Service type: `"radarr"` or `"sonarr"` |

**Response `200 OK`**

```json
{
	"rootFolders": [
		{
			"id": 1,
			"path": "/movies",
			"freeSpace": 107374182400
		}
	],
	"qualityProfiles": [
		{
			"id": 1,
			"name": "HD-1080p"
		}
	]
}
```

| Field                     | Type     | Description                  |
| ------------------------- | -------- | ---------------------------- |
| `rootFolders`             | `array`  | Available root folders       |
| `rootFolders[].id`        | `number` | Root folder ID               |
| `rootFolders[].path`      | `string` | Filesystem path              |
| `rootFolders[].freeSpace` | `number` | Free disk space in bytes     |
| `qualityProfiles`         | `array`  | Available quality profiles   |
| `qualityProfiles[].id`    | `number` | Quality profile ID           |
| `qualityProfiles[].name`  | `string` | Quality profile display name |

**Response `404 Not Found`**

```json
{ "error": "No arr connection found for this service type" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/arr/lookup`

Searches an arr service for media matching the given title (and optional year).

**Request**

```json
{
	"serviceType": "radarr",
	"title": "Inception",
	"year": 2010
}
```

| Field         | Type     | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `serviceType` | `string` | Required. Service type: `"radarr"` or `"sonarr"` |
| `title`       | `string` | Required, minimum 1 character                    |
| `year`        | `number` | Optional. Release year to narrow results         |

**Response `200 OK`**

```json
[
	{
		"title": "Inception",
		"year": 2010,
		"tmdbId": 27205,
		"overview": "A thief who steals corporate secrets...",
		"existsInLibrary": false,
		"arrId": 0
	}
]
```

| Field             | Type      | Description                                     |
| ----------------- | --------- | ----------------------------------------------- |
| `title`           | `string`  | Media title                                     |
| `year`            | `number`  | Release year                                    |
| `tmdbId`          | `number`  | Optional. TMDB ID (Radarr)                      |
| `tvdbId`          | `number`  | Optional. TVDB ID (Sonarr)                      |
| `overview`        | `string`  | Short description                               |
| `existsInLibrary` | `boolean` | Whether the media is already in the arr library |
| `arrId`           | `number`  | Arr internal ID (0 if not in library)           |

**Response `404 Not Found`**

```json
{ "error": "No arr connection found for this service type" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `POST /api/arr/add`

Adds media to an arr service and updates the associated recommendation record.

**Request**

```json
{
	"serviceType": "radarr",
	"recommendationId": "550e8400-e29b-41d4-a716-446655440001",
	"tmdbId": 27205,
	"title": "Inception",
	"year": 2010,
	"qualityProfileId": 1,
	"rootFolderPath": "/movies"
}
```

| Field              | Type     | Description                                          |
| ------------------ | -------- | ---------------------------------------------------- |
| `serviceType`      | `string` | Required. Service type: `"radarr"` or `"sonarr"`     |
| `recommendationId` | `string` | Required. UUID of the recommendation to update       |
| `tmdbId`           | `number` | Optional. TMDB ID (required for Radarr)              |
| `tvdbId`           | `number` | Optional. TVDB ID (required for Sonarr)              |
| `title`            | `string` | Required, minimum 1 character                        |
| `year`             | `number` | Required. Release year                               |
| `qualityProfileId` | `number` | Required. Quality profile ID from `/api/arr/options` |
| `rootFolderPath`   | `string` | Required. Root folder path from `/api/arr/options`   |

**Response `200 OK`**

```json
{ "success": true }
```

On failure:

```json
{
	"success": false,
	"error": "Item already exists in library"
}
```

| Field     | Type      | Description                              |
| --------- | --------- | ---------------------------------------- |
| `success` | `boolean` | Whether the media was added successfully |
| `error`   | `string`  | Optional. Error message if unsuccessful  |

**Response `404 Not Found`**

```json
{ "error": "No arr connection found for this service type" }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

## Library

All library endpoints require authentication via `session` cookie.

### `POST /api/library/sync`

Triggers a manual sync of the user's Plex library contents into the local database. Returns item counts after the sync completes.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"movies": 150,
	"series": 42
}
```

| Field    | Type     | Description                      |
| -------- | -------- | -------------------------------- |
| `movies` | `number` | Total movie items after sync     |
| `series` | `number` | Total TV series items after sync |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `GET /api/library/status`

Returns the current library sync status including the last synced time, sync interval, item counts, and the exclude-library default setting.

**Request**

No parameters or body required.

**Response `200 OK`**

```json
{
	"lastSyncedAt": "2024-01-15T10:30:00.000Z",
	"intervalHours": 24,
	"movies": 150,
	"series": 42,
	"excludeByDefault": false
}
```

| Field              | Type      | Description                                                        |
| ------------------ | --------- | ------------------------------------------------------------------ |
| `lastSyncedAt`     | `string`  | Optional. ISO 8601 timestamp of last sync, or null if never        |
| `intervalHours`    | `number`  | Sync interval in hours                                             |
| `movies`           | `number`  | Total movie items in library                                       |
| `series`           | `number`  | Total TV series items in library                                   |
| `excludeByDefault` | `boolean` | Whether library items are excluded from recommendations by default |

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

### `PUT /api/library/settings`

Updates the library sync interval and/or the exclude-library default setting.

**Request**

```json
{
	"intervalHours": 24,
	"excludeByDefault": true
}
```

| Field              | Type      | Description                                                       |
| ------------------ | --------- | ----------------------------------------------------------------- |
| `intervalHours`    | `number`  | Optional. Sync interval in hours (positive integer)               |
| `excludeByDefault` | `boolean` | Optional. Whether to exclude owned library items from suggestions |

**Response `200 OK`**

```json
{ "success": true }
```

**Response `401 Unauthorized`**

```json
{ "error": "Authentication required" }
```

---

## Recommendations

All recommendation endpoints require authentication via `session` cookie.

### `PATCH /api/recommendations/:id/feedback`

Sets, toggles, or clears thumbs-up/thumbs-down feedback on a recommendation. Feedback is used to influence future AI recommendations across conversations.

**Request**

| Path Param | Type     | Description         |
| ---------- | -------- | ------------------- |
| `id`       | `string` | Recommendation UUID |

```json
{
	"feedback": "liked"
}
```

| Field      | Type               | Description                                 |
| ---------- | ------------------ | ------------------------------------------- |
| `feedback` | `string` or `null` | `"liked"`, `"disliked"`, or `null` to clear |

**Response `200 OK`**

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"feedback": "liked"
}
```

| Field      | Type               | Description            |
| ---------- | ------------------ | ---------------------- |
| `id`       | `string`           | Recommendation UUID    |
| `feedback` | `string` or `null` | Current feedback value |

**Response `404 Not Found`**

```json
{ "error": "Recommendation not found" }
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
