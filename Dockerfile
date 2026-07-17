# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY specs ./specs
COPY src ./src
RUN npm run build

# --- prune stage: production deps only ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime stage ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/index.js"]
