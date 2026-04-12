# Recommendarr Documentation

AI-based recommendation engine for the \*arr stack (Radarr, Sonarr, Lidarr) and Plex.

## Environment Variables

| Variable                 | Default                  | Description                                                                     |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| `PORT`                   | `3000`                   | Port the HTTP server listens on                                                 |
| `HOST`                   | `0.0.0.0`                | Host the HTTP server binds to                                                   |
| `DATABASE_PATH`          | `./data/recommendarr.db` | Path to the SQLite database file                                                |
| `DEFAULT_ADMIN_USERNAME` | `admin`                  | Username for the default admin account (only used with DEFAULT_ADMIN_PASSWORD)  |
| `DEFAULT_ADMIN_PASSWORD` | (none)                   | If set, creates an admin user on first boot with these credentials              |
| `ENCRYPTION_KEY`         | (none)                   | Required, 64-character hex string for AES-256-GCM encryption of stored secrets  |
| `SESSION_DURATION_DAYS`  | `7`                      | Controls how long login sessions last (in days)                                 |
| `LOG_LEVEL`              | `info`                   | Server log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) |

## Reverse Proxy / TLS

The server sets `trustProxy: "loopback"` on Fastify, which means it trusts `X-Forwarded-Proto` and other forwarded headers from loopback and private IP addresses. This allows the app to correctly detect HTTPS when running behind a reverse proxy (e.g. Nginx, Caddy, Traefik) that terminates TLS.

Session cookies automatically set the `Secure` flag based on the detected request protocol (`request.protocol`). When the app is behind a TLS-terminating proxy that sends `X-Forwarded-Proto: https`, cookies will be marked `Secure`. Over plain HTTP (e.g. local development), they won't be.

## API Reference

See [api.md](./api.md) for all available endpoints.
