# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable

# --- prune: reduce the monorepo to what @acc/api needs ---
FROM base AS pruner
WORKDIR /repo
RUN npm i -g turbo@2
COPY . .
RUN turbo prune @acc/api --docker

# --- build ---
FROM base AS build
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@acc/api

# --- production deps only ---
FROM base AS prod-deps
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --prod --frozen-lockfile

# --- runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/drizzle ./apps/api/drizzle
USER app
WORKDIR /repo/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/index.js"]
