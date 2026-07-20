# Deploying (Railway, two services)

The monorepo produces two Railway services from one repo. **Deploy the api
changes first, then create/deploy web, then set `WEB_URL` on api** — the api
keeps working stand-alone (WEB_URL defaults to BASE_URL) until web is live.

**Decided domain layout** (July 2026):

- api → `https://accounting-mcp.straycat.app` (first-level subdomain, covered
  by Cloudflare Universal SSL). This CHANGES `BASE_URL`/the OAuth issuer — a
  one-time event that forces every MCP client to re-authenticate, so do it as
  part of this deploy, not as a second migration later.
- web → `https://web.accounting-mcp.straycat.app` (nested subdomain — NOT
  covered by Universal SSL; its Cloudflare record must be **DNS-only/grey
  cloud** so Railway terminates TLS with its own Let's Encrypt cert).

## Service: api (existing service, settings changes)

- **Build**: Dockerfile path `apps/api/Dockerfile` (build context = repo root).
- **Watch paths**: `apps/api/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`.
- **Pre-deploy command**: `node dist/db/migrate.js`
  (replaces `npm run db:migrate`; the image no longer contains drizzle-kit.
  Working dir in the image is `/repo/apps/api`.)
- **Custom domain**: `accounting-mcp.straycat.app`. In Cloudflare, point the
  existing record at the domain target Railway shows (CNAME) and either set the
  record DNS-only or fix zone SSL/TLS to Full (strict) — the current 301 loop
  is caused by Flexible mode.
- **Env vars**: keep everything else as-is, then:
  - `BASE_URL=https://accounting-mcp.straycat.app` (the issuer move — see
    above; also update the Bokio redirect URI and Stripe webhook endpoint).
  - `WEB_URL=https://web.accounting-mcp.straycat.app` (set this only after the
    web service exists; until then leave it unset).

## Service: web (new service, same repo)

- **Build**: Dockerfile path `apps/web/Dockerfile` (build context = repo root).
- **Watch paths**: `apps/web/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`.
- **Custom domain**: `web.accounting-mcp.straycat.app` — Cloudflare record
  must be DNS-only (nested subdomains aren't covered by Universal SSL).
- **Env vars** (both are read at BUILD time — changing them requires a redeploy;
  Railway resolves `${{...}}` reference variables before the build, so they
  work here):
  - `NEXT_PUBLIC_API_URL=${{accounting-mcp.BASE_URL}}` (the public api origin
    shown in the dashboard's MCP connector cards, inherited from the api
    service's BASE_URL — single source of truth. Don't use
    `RAILWAY_PUBLIC_DOMAIN`: it's the Railway-generated domain, not the custom
    one, and lacks the scheme.)
  - `API_INTERNAL_URL=http://${{accounting-mcp.RAILWAY_PRIVATE_DOMAIN}}:${{accounting-mcp.PORT}}`
    Gotchas that each caused a real failure on first deploy:
    - reference the **accounting-mcp** service — `${{RAILWAY_PRIVATE_DOMAIN}}`
      alone resolves to the web service's own domain (proxy loop → 500);
    - scheme must be `http://` — private networking has no TLS (https → 443 →
      ECONNREFUSED);
    - the port must match the api's actual listening port. Railway injects
      `PORT=8080` on the api, so set `PORT=8080` explicitly on the api service
      (making it referenceable and pinned) and use the reference above.
    - NOT `RAILWAY_STATIC_URL` — deprecated name for the *public* domain.

## Deploy-day externals

1. **Bokio developer portal**: add redirect URI
   `https://web.accounting-mcp.straycat.app/connect/bokio/callback`
   (keep the old `/connect/bokio/callback` URIs registered during the
   transition if the portal allows multiple).
2. **Stripe**: point the webhook endpoint at
   `https://accounting-mcp.straycat.app/api/auth/stripe/webhook` (the issuer
   moved with BASE_URL). The dashboard sends absolute web-origin
   success/cancel/return URLs, which `trustedOrigins: [WEB_URL]` allows.
3. **MCP clients**: the issuer moved, so every existing connector must
   re-authenticate against the new `/mcp` URL
   (`https://accounting-mcp.straycat.app/mcp`) — reconnect your own Claude
   connector and update any published connect instructions.
4. **Smoke test**: fresh MCP connect from Claude exercises the web sign-in +
   consent pages; web dashboard sign-in → connect → disconnect; Stripe
   checkout + billing portal round-trip if BILLING_ENABLED.

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

- Retire the proxied REST endpoints (`/api/billing`, `/api/connections`) once
  nothing but the e2e scripts uses them.
