# Build from the repo root: docker build -f apps/web/Dockerfile .
#
# NOTE: NEXT_PUBLIC_API_URL and API_INTERNAL_URL are BUILD-time values — Next
# inlines the public one into the client bundle and bakes the rewrite
# destinations into the standalone server. Changing either requires a rebuild.
# (Railway exposes service variables during image builds, so setting them on
# the service is enough.)
FROM node:22-alpine AS base
RUN corepack enable

# --- prune: reduce the monorepo to what @acc/web needs ---
FROM base AS pruner
WORKDIR /repo
RUN npm i -g turbo@2
COPY . .
RUN turbo prune @acc/web --docker

# --- build ---
FROM base AS build
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG NEXT_PUBLIC_API_URL
ARG API_INTERNAL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm turbo run build --filter=@acc/web

# --- runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/sign-in >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
