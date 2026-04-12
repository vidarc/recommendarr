# Recommendarr

An AI-powered recommendation engine for the *arr stack (Radarr, Sonarr, Lidarr) and Plex. It analyzes your Plex watch history and uses your chosen AI model to recommend movies, TV shows, and music — then lets you send those recommendations straight to your *arr apps.

## ✨ Features

- Connects to your Plex server to pull watch history
- Supports any OpenAI-compatible AI endpoint (OpenAI, Ollama, LM Studio, etc.)
- Chat-based interface for getting and refining recommendations
- Conversation history so you can pick up where you left off
- Self-hosted with a single Docker image
- SQLite database — no external DB required

## 🐳 Docker Setup

### 🚀 Quick Start

```bash
docker run -d \
  --name recommendarr \
  -p 3000:3000 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -v recommendarr-data:/app/data \
  recommendarr
```

Then open `http://localhost:3000` and register your first user (automatically becomes admin).

### 📄 Docker Compose

```yaml
services:
  recommendarr:
    image: recommendarr:latest
    ports:
      - "3000:3000"
    environment:
      ENCRYPTION_KEY: "<64-character hex string>" # generate with: openssl rand -hex 32
    volumes:
      - recommendarr-data:/app/data

volumes:
  recommendarr-data:
```

### ⚙️ Environment Variables

| Variable                 | Required | Default                  | Description                                                                                                                                                            |
| ------------------------ | -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY`         | **Yes**  | —                        | 64-character hex string for AES-256-GCM encryption of stored secrets (Plex tokens, AI API keys). Generate with `openssl rand -hex 32`                                  |
| `PORT`                   | No       | `3000`                   | Port the HTTP server listens on                                                                                                                                        |
| `HOST`                   | No       | `0.0.0.0`                | Host the HTTP server binds to                                                                                                                                          |
| `DATABASE_PATH`          | No       | `./data/recommendarr.db` | Path to the SQLite database file                                                                                                                                       |
| `DEFAULT_ADMIN_USERNAME` | No       | `admin`                  | Username for the auto-created admin (only used with `DEFAULT_ADMIN_PASSWORD`)                                                                                          |
| `DEFAULT_ADMIN_PASSWORD` | No       | —                        | If set, creates an admin user on first boot with these credentials                                                                                                     |
| `SESSION_DURATION_DAYS`  | No       | `7`                      | How long login sessions last (in days)                                                                                                                                 |
| `LOG_LEVEL`              | No       | `info`                   | Server log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`)                                                                                        |
| `LOG_PRETTY`             | No       | —                        | Set to `true` to enable pretty-printed logs via `pino-pretty`                                                                                                          |
| `TVDB_API_KEY`           | No       | —                        | TVDB v4 API key for enriching TV show recommendation cards with metadata (poster, overview, genres, rating, cast/crew). Get one at https://thetvdb.com/api-information |
| `TMDB_API_KEY`           | No       | —                        | TMDB API key for enriching movie recommendation cards with metadata (poster, overview, genres, rating, cast/crew). Get one at https://www.themoviedb.org/settings/api  |

### 🔒 Reverse Proxy / TLS

The server trusts `X-Forwarded-Proto` from loopback and private IPs (`trustProxy: "loopback"`), so it works correctly behind a TLS-terminating proxy (Nginx, Caddy, Traefik, etc.). Session cookies automatically set the `Secure` flag when HTTPS is detected.

### 🏗️ Building the Image

```bash
docker build -t recommendarr .
```

## 💻 Local Development

### 📋 Prerequisites

- Node.js 24+
- Yarn (enabled via corepack)
- [Vite+](https://viteplus.dev/) — the project uses `vp` as its unified toolchain

### 🛠️ Setup

```bash
# Enable corepack for Yarn
corepack enable

# Install dependencies
yarn install

# Start the dev server (Fastify + Vite SSR with HMR)
yarn dev
```

The app will be available at `http://localhost:3000`. You'll need to set the `ENCRYPTION_KEY` environment variable (or add it to a `.env` file):

```bash
ENCRYPTION_KEY=$(openssl rand -hex 32) yarn dev
```

### 📝 Common Commands

```bash
yarn dev             # Start dev server
yarn build           # Build client, SSR bundle, and server
yarn vp test         # Run all tests
yarn vp test <file>  # Run a single test file
yarn vp check        # Run format + lint + typecheck
yarn vp lint         # Lint only
yarn vp fmt          # Format only
yarn test:e2e        # Run end-to-end tests (requires Docker)
```

### 📁 Project Structure

```
src/
  server/         # Fastify backend (routes, services, middleware, DB)
  client/         # React frontend (pages, components, features)
    pages/        # Route-level components (Login, Settings, Recommendations, etc.)
    components/   # Reusable UI (ChatMessage, RecommendationCard, etc.)
docs/             # Architecture decisions, API reference, env var docs
scripts/          # Docker compose, e2e runner, publish script
```

## 🤖 Claude Code

This project is set up for development with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). The repo includes:

- **`CLAUDE.md`** — project conventions, architecture overview, and instructions that Claude Code loads automatically
- **`.claude/`** — memory files, rules, and skill configurations for consistent AI-assisted development

If you're using Claude Code, it will pick these up automatically. No extra setup needed.

## 🙏 Attribution

Based on the original concept from [this r/selfhosted post](https://www.reddit.com/r/selfhosted/comments/1j0ovbm/recommendarr_a_simple_web_app_using_ai_to_analyze/) after the original GitHub repository was removed.

## ⚠️ AI Disclaimer

AI (specifically Claude Code) is being used heavily to develop this application. Various context, memory, skills, and configurations are committed to the repo to be as transparent as possible about how AI is being used in development.
