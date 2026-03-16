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
