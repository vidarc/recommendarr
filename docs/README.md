# Recommendarr Documentation

AI-based recommendation engine for the \*arr stack (Radarr, Sonarr, Lidarr) and Plex.

## Environment Variables

| Variable                 | Default                  | Description                                                                    |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------ |
| `PORT`                   | `3000`                   | Port the HTTP server listens on                                                |
| `HOST`                   | `0.0.0.0`                | Host the HTTP server binds to                                                  |
| `DATABASE_PATH`          | `./data/recommendarr.db` | Path to the SQLite database file                                               |
| `DEFAULT_ADMIN_USERNAME` | `admin`                  | Username for the default admin account (only used with DEFAULT_ADMIN_PASSWORD) |
| `DEFAULT_ADMIN_PASSWORD` | (none)                   | If set, creates an admin user on first boot with these credentials             |

## API Reference

See [api.md](./api.md) for all available endpoints.
