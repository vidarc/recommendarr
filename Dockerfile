# Stage 1: Build
FROM node:24.15.0-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies first for best layer caching
COPY .yarn/ .yarn/
COPY ["package.json", "yarn.lock", ".yarnrc.yml", "./"]

RUN yarn install --immutable

# Copy source and config, then build
COPY drizzle/ drizzle/
COPY vite.config.ts \
  tsconfig.json \
  tsconfig.client.json \
  tsconfig.server.json \
  tsconfig.shared.json \
  tsconfig.test.json \
  ./
COPY src/ src/

RUN yarn vp build && \
  yarn vp build --ssr entry-server.tsx --outDir ../../dist/ssr && \
  yarn vp exec tsc -b tsconfig.server.json

# Prune to production dependencies
RUN yarn workspaces focus --production

# Stage 2: Production
FROM node:24.15.0-bookworm-slim AS runner

WORKDIR /app

LABEL org.opencontainers.image.title="Recommendarr" \
  org.opencontainers.image.description="AI-powered recommendation engine for the *arr stack (Radarr, Sonarr, Lidarr) and Plex" \
  org.opencontainers.image.source="https://github.com/vidarc/recommendarr" \
  org.opencontainers.image.url="https://github.com/vidarc/recommendarr" \
  org.opencontainers.image.documentation="https://github.com/vidarc/recommendarr#readme" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.vendor="Recommendarr"

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/dist ./dist

ARG PORT=3000
ARG NODE_ENV=production

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/ping').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

VOLUME /app/data

CMD ["node", "dist/server/server.js"]
