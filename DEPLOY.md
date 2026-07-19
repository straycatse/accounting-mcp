# Deploying (Railway, two services)

The monorepo produces two Railway services from one repo. **Deploy the api
changes first, then create/deploy web, then set `WEB_URL` on api** — the api
keeps working stand-alone (WEB_URL defaults to BASE_URL) until web is live.

## Service: api (existing service, settings changes)

- **Build**: Dockerfile path `apps/api/Dockerfile` (build context = repo root).
- **Watch paths**: `apps/api/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`.
- **Pre-deploy command**: `node dist/db/migrate.js`
  (replaces `npm run db:migrate`; the image no longer contains drizzle-kit.
  Working dir in the image is `/repo/apps/api`.)
- **Env vars**: keep everything as-is (`BASE_URL` UNCHANGED — the OAuth issuer
  must not move, or every MCP client has to re-authenticate). Add:
  - `WEB_URL=https://<web-service>.up.railway.app` (set this only after the web
    service exists; until then leave it unset).

## Service: web (new service, same repo)

- **Build**: Dockerfile path `apps/web/Dockerfile` (build context = repo root).
- **Watch paths**: `apps/web/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`.
- **Env vars** (both are read at BUILD time — changing them requires a redeploy):
  - `NEXT_PUBLIC_API_URL=https://accounting-mcp-production.up.railway.app`
  - `API_INTERNAL_URL=http://<api-service>.railway.internal:<port>` (Railway
    private networking; falls back to NEXT_PUBLIC_API_URL if unset).

## Deploy-day externals

1. **Bokio developer portal**: add redirect URI
   `https://<web-service>.up.railway.app/connect/bokio/callback`
   (keep the old `${BASE_URL}/connect/bokio/callback` registered during the
   transition if the portal allows multiple).
2. **Stripe**: nothing changes (webhook + issuer stay on the api origin). The
   dashboard now sends absolute web-origin success/cancel/return URLs, which
   `trustedOrigins: [WEB_URL]` allows.
3. **Smoke test**: existing MCP connector still works (issuer untouched); fresh
   MCP connect from Claude exercises the web sign-in + consent pages; web
   dashboard sign-in → connect → disconnect; Stripe checkout + billing portal
   round-trip if BILLING_ENABLED.

## Local development

```sh
docker compose up -d                     # postgres on 5433
pnpm install
pnpm --filter @acc/api dev               # api on :3000 (WEB_URL defaults to BASE_URL)
WEB_URL=http://localhost:3001 pnpm --filter @acc/api dev   # when running web too
pnpm --filter @acc/web dev               # web on :3001, proxies to :3000
```

Tests: `pnpm turbo run build typecheck test`; e2e (api must be running with
`BOKIO_MOCK=true`): `pnpm --filter @acc/api e2e`. To exercise the web proxy
path end-to-end:
`E2E_BASE_URL=http://localhost:3001 E2E_MCP_URL=http://localhost:3000 E2E_WEB_URL=http://localhost:3001 pnpm --filter @acc/api e2e`.

## Later (unblocked, optional)

- Fix Cloudflare SSL for straycat.app (SSL/TLS mode → Full (strict)), then move
  web to `app.straycat.app`: change `WEB_URL` on api, the Bokio redirect URI,
  and the web service's custom domain. The OAuth issuer (BASE_URL) still
  doesn't move.
- Retire the proxied REST endpoints (`/api/billing`, `/api/connections`) once
  nothing but the e2e scripts uses them.
