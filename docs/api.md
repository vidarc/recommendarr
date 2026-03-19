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

## SSR

### `GET /*` (catch-all)

Serves the React application via server-side rendering. All routes not matched by API endpoints above are handled by SSR, which renders the React app to HTML on the server and sends it to the browser for hydration.

**Response `200 OK`**

Returns full HTML page with server-rendered React content.
