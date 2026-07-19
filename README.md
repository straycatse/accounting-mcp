# accounting-mcp

Multi-tenant remote MCP server that connects accounting software to MCP clients (Claude, ChatGPT, Perplexity, Claude Code). Business administrators sign in, connect their accounting company via OAuth, and their AI assistant can then work with their bookkeeping through ~87 tools.

**Providers:** [Bokio](https://docs.bokio.se) (Swedish accounting SaaS). The core is provider-generic — adding Fortnox/Visma later means new files under `src/providers` + tool definitions, no changes to auth/transport/storage.

## Architecture

pnpm/Turborepo monorepo with two deployable apps:

- **`apps/api`** — the MCP + auth + billing server (Hono on `@hono/node-server`).
- **`apps/web`** — the user-facing dashboard (Next.js App Router). Talks to the
  api via tRPC (`/trpc`, router in `apps/api/src/trpc/router.ts`, type-only
  import in the web app) and proxies `/api/*`, `/connect/*` and `/trpc/*` to the
  api via Next rewrites, so the better-auth session cookie stays first-party on
  the web origin. The api's `WEB_URL` env points browser-facing redirects
  (sign-in, consent, Bokio OAuth callback) at the web origin. See `DEPLOY.md`.

The api is one stateful Node process with three faces:

1. **OAuth 2.1 authorization server** toward MCP clients — better-auth + `@better-auth/oauth-provider`: dynamic client registration, PKCE, sign-in/consent pages, token issuance. Metadata at `/.well-known/oauth-authorization-server`.
2. **MCP resource server** at `/mcp` (Streamable HTTP via `@hono/mcp`) — validates our JWTs, one session per `Mcp-Session-Id`, serves the tool set.
3. **OAuth client** toward Bokio — `/connect/bokio` flow; company tokens AES-256-GCM-encrypted in Postgres, auto-refreshed with rotation + per-connection mutex.

Users authenticate with email/password; each user can connect multiple Bokio companies. Tools take an optional `companyId` (defaults when exactly one company is connected); tenant isolation is enforced in `src/tools/company-resolver.ts`.

## Development

```bash
docker compose up -d               # Postgres on localhost:5433
cp apps/api/.env.example apps/api/.env   # fill BETTER_AUTH_SECRET + TOKEN_ENCRYPTION_KEY (openssl rand -base64 32)
pnpm install
pnpm --filter @acc/api db:migrate
pnpm --filter @acc/api dev         # api on http://localhost:3000
pnpm --filter @acc/web dev         # dashboard on http://localhost:3001 (optional; api serves MCP alone)
```

With `BOKIO_MOCK=true` (the default in `.env.example`) a mock Bokio — OAuth endpoints + fixture companies with invoices, journal entries, chart of accounts, SIE export — is mounted at `/mock/bokio/v1`. The entire product works end-to-end with zero Bokio credentials.

### Verify

```bash
pnpm turbo run build typecheck test   # all workspaces
pnpm --filter @acc/api e2e            # against a running api: token connect suite + full
                                      # DCR → OAuth → consent → MCP session → tools → SIE flow
```

Connect from Claude Code: `claude mcp add --transport http accounting http://localhost:3000/mcp` (the OAuth flow opens in your browser — sign up, approve, then connect a mock company from `/dashboard`).

## Configuration

See `.env.example`. Highlights:

- `BOKIO_ALLOW_WRITES` (default `false`) — when off, mutating tools are not even listed. Write tools carry MCP `destructiveHint`/`readOnlyHint` annotations either way.
- `BOKIO_MOCK` — mock Bokio instead of `api.bokio.se`.
- `TOKEN_ENCRYPTION_KEY` — base64 32-byte AES key for provider tokens at rest.
- `BOKIO_SCOPES` — defaults to every scope documented in the spec (`invoices:read`, `journal-entries:write`, …).

## Going live with real Bokio

1. Create a developer account + integration at the [Bokio developer portal](https://docs.bokio.se); register redirect URI `https://<host>/connect/bokio/callback`.
2. Set `BOKIO_CLIENT_ID`/`BOKIO_CLIENT_SECRET`, `BOKIO_MOCK=false`, `BASE_URL=https://<host>`.
3. For local testing against real Bokio, tunnel with `cloudflared tunnel --url http://localhost:3000` and use the tunnel URL as `BASE_URL`.

## Deployment (Railway or any container host)

Multi-stage `Dockerfile`; the image is self-contained. On Railway: add a Postgres service, set the env vars, use `npm run db:migrate` as release command, health check `GET /healthz`. Note: MCP sessions are in-memory — run a single instance (or add sticky sessions before scaling out).

## Layout

```
src/
  auth/       better-auth config (OAuth AS) + Bokio connect flow
  http/       Hono app, /mcp session handling, HTML pages (sign-in/consent/dashboard)
  bokio/      generated OpenAPI types, API client (401-retry), token-manager, mock server
  tools/      declarative registry, meta tools, per-resource Bokio tool tables
  db/         Drizzle schema (better-auth tables + accounting_connection + tool_audit_log)
  lib/        AES-256-GCM token crypto
specs/        Bokio OpenAPI specs (source for npm run gen:bokio)
scripts/      e2e-oauth.mjs — full-flow integration test
```
