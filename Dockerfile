# Stage 1: Build
FROM node:24.14.0-alpine3.22 AS builder

WORKDIR /app

RUN corepack enable

COPY package.json .yarnrc.yml yarn.lock ./
COPY .yarn ./.yarn

RUN yarn install --immutable

COPY . .

RUN yarn vp build && yarn vp build --ssr src/client/entry-server.tsx --outDir dist/ssr && yarn vp exec tsc -p tsconfig.server.json


# Stage 2: Production
FROM node:24.14.0-alpine3.22 AS runner

WORKDIR /app

RUN corepack enable

COPY package.json .yarnrc.yml yarn.lock ./
COPY .yarn/releases ./.yarn/releases

RUN yarn workspaces focus --production

COPY --from=builder /app/dist ./dist

ENV PORT=3000

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/ping || exit 1

CMD ["node", "dist/server/server.js"]
