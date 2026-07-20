import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { auth } from "./auth.js";
import { checkEntitlement } from "../billing/entitlement.js";
import { config } from "../config.js";
import { buildAuthorizeUrl } from "../lib/authorize-url.js";
import { exchangeAuthorizationCode } from "../bokio/oauth.js";
import { bokioSettings } from "../bokio/settings.js";
import {
  activeConnectionCount,
  billingSummary,
  connectSeatCheck,
  connectViaToken,
  disconnectConnection,
  fetchCompanyName,
  listConnections,
  upsertConnection,
} from "../services/connections.js";

const STATE_COOKIE = "bokio_oauth_state";
// Browser-facing flows live on the web origin (which proxies /connect/* to us),
// so both Bokio's redirect URI and our own page redirects must be absolute.
const redirectUri = `${config.WEB_URL}/connect/bokio/callback`;
const webPage = (path: string) => `${config.WEB_URL}${path}`;

async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}

export const connectBokio = new Hono();

// Kick off Bokio's authorization-code flow for the signed-in user.
connectBokio.get("/connect/bokio", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect(webPage("/sign-in"));

  // Checkout comes before connecting: no subscription (or trial), no connect.
  // Seat availability for a *new* company is enforced in the callback, where we
  // know which company was picked — re-authorizing an already-connected company
  // must not require a spare seat.
  const entitled = await checkEntitlement(user.id, await activeConnectionCount(user.id));
  if (!entitled.ok) return c.redirect(webPage("/dashboard?billing=required"));

  const state = randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.WEB_URL.startsWith("https"),
    maxAge: 600,
    path: "/connect",
  });

  const url = buildAuthorizeUrl(`${bokioSettings.authBaseUrl}/authorize`, {
    response_type: "code",
    client_id: bokioSettings.clientId,
    redirect_uri: redirectUri,
    // Must be %20-delimited, not "+" — see buildAuthorizeUrl.
    scope: config.BOKIO_SCOPES,
    state,
  });
  return c.redirect(url);
});

connectBokio.get("/connect/bokio/callback", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect(webPage("/sign-in"));

  const { code, state, error } = c.req.query();
  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/connect" });

  // Bounce back to the dashboard with a *code* rather than rendering prose the
  // API can't translate — the web app owns the message catalogs. A dead-end
  // plain-text 400 was also a worse place to land than the page you started on.
  if (error) {
    console.warn(`Bokio authorization failed: ${error}`);
    return c.redirect(webPage("/dashboard?error=oauth_denied"));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return c.redirect(webPage("/dashboard?error=oauth_state"));
  }

  const tokens = await exchangeAuthorizationCode(code, redirectUri);

  const entitled = await connectSeatCheck(user.id, "bokio", tokens.tenant_id);
  if (!entitled.ok) {
    return c.redirect(
      webPage(`/dashboard?billing=${entitled.reason === "seats_exceeded" ? "seats" : "required"}`),
    );
  }

  const companyName = await fetchCompanyName(tokens.tenant_id, tokens.access_token);

  await upsertConnection({
    userId: user.id,
    provider: "bokio",
    authType: "oauth",
    tenantId: tokens.tenant_id,
    externalConnectionId: tokens.connection_id ?? null,
    companyName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: config.BOKIO_SCOPES,
  });

  return c.redirect(webPage("/dashboard"));
});

// Connect a single company directly with a Bokio *private integration* token
// (Bokio company settings → API Tokens → Create Private Integration). No OAuth,
// no marketplace review — the token is a long-lived bearer for that one company.
connectBokio.post("/connect/bokio/token", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = (await c.req.json().catch(() => ({}))) as {
    integrationToken?: string;
    companyId?: string;
  };
  const result = await connectViaToken(user.id, body.integrationToken, body.companyId);
  if (!result.ok) {
    // A JSON API, not a rendered page: hand back the message-catalog reference
    // and let the caller localise it (the web app does so via tRPC).
    return c.json(
      { error: result.error, messageKey: result.key, messageParams: result.params },
      result.httpStatus,
    );
  }
  return c.json({ ok: true, companyName: result.companyName, companyId: result.companyId });
});

// Remove a connected company. Scoped to the calling user's own rows.
connectBokio.post("/connect/bokio/disconnect", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { id } = (await c.req.json().catch(() => ({}))) as { id?: string };
  if (!id) return c.json({ error: "missing_id" }, 400);

  const removed = await disconnectConnection(user.id, id);
  if (!removed) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// Session-authenticated billing state for the dashboard.
connectBokio.get("/api/billing", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json(await billingSummary(user.id));
});

// Session-authenticated JSON for the dashboard.
connectBokio.get("/api/connections", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json({ connections: await listConnections(user.id) });
});
