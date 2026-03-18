# Stage 1: Build
FROM node:24.14.0-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install dependencies first for best layer caching
COPY .yarn/ .yarn/
COPY ["package.json", "yarn.lock", ".yarnrc.yml", "./"]

RUN yarn install --immutable

# Copy source and config, then build
COPY vite.config.ts tsconfig.json tsconfig.client.json tsconfig.server.json ./
COPY src/ src/

RUN yarn vp build && \
  yarn vp build --ssr entry-server.tsx --outDir ../../dist/ssr && \
  yarn vp exec tsc -p tsconfig.server.json

# Prune to production dependencies
RUN yarn workspaces focus --production

# Stage 2: Production
FROM node:24.14.0-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/ping').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/server.js"]
