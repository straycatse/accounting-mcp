import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { auth } from "./auth.js";
import { checkEntitlement } from "../billing/entitlement.js";
import { config } from "../config.js";
import { exchangeAuthorizationCode } from "../fortnox/oauth.js";
import { fetchFortnoxCompanyInfo } from "../fortnox/company-info.js";
import { fortnoxSettings } from "../fortnox/settings.js";
import {
  activeConnectionCount,
  connectSeatCheck,
  upsertConnection,
} from "../services/connections.js";

const STATE_COOKIE = "fortnox_oauth_state";
// Browser-facing flows live on the web origin (which proxies /connect/* to us),
// so both Fortnox's redirect URI and our own page redirects must be absolute.
const redirectUri = `${config.WEB_URL}/connect/fortnox/callback`;
const webPage = (path: string) => `${config.WEB_URL}${path}`;

async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}

export const connectFortnox = new Hono();

// Kick off Fortnox's authorization-code flow for the signed-in user.
connectFortnox.get("/connect/fortnox", async (c) => {
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

  const url = new URL(`${fortnoxSettings.authBaseUrl}/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", fortnoxSettings.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.FORTNOX_SCOPES);
  url.searchParams.set("state", state);
  // Without access_type=offline Fortnox issues no refresh token and the
  // connection dies when the ~1h access token expires.
  url.searchParams.set("access_type", "offline");
  return c.redirect(url.toString());
});

connectFortnox.get("/connect/fortnox/callback", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect(webPage("/sign-in"));

  const { code, state, error } = c.req.query();
  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/connect" });

  if (error) return c.text(`Fortnox authorization failed: ${error}`, 400);
  if (!code || !state || !expectedState || state !== expectedState) {
    return c.text("Invalid OAuth state — please retry from the dashboard.", 400);
  }

  const tokens = await exchangeAuthorizationCode(code, redirectUri);

  // The token response has no tenant id — the company behind the grant is
  // whatever /3/companyinformation says. Mandatory: without a DatabaseNumber
  // there is nothing to store the connection under.
  let tenantId: string;
  let companyName: string | null;
  try {
    ({ tenantId, companyName } = await fetchFortnoxCompanyInfo(tokens.access_token));
  } catch (err) {
    return c.text(err instanceof Error ? err.message : "Could not read company information from Fortnox.", 502);
  }

  const entitled = await connectSeatCheck(user.id, "fortnox", tenantId);
  if (!entitled.ok) {
    return c.redirect(
      webPage(`/dashboard?billing=${entitled.reason === "seats_exceeded" ? "seats" : "required"}`),
    );
  }

  await upsertConnection({
    userId: user.id,
    provider: "fortnox",
    authType: "oauth",
    tenantId,
    externalConnectionId: null,
    companyName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: tokens.scope ?? config.FORTNOX_SCOPES,
  });

  return c.redirect(webPage("/dashboard"));
});
