import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { getBillingState } from "../billing/entitlement.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { accountingConnection, billingAccount } from "../db/schema.js";
import { encryptToken } from "../lib/crypto.js";
import { exchangeAuthorizationCode } from "../bokio/oauth.js";
import { bokioSettings } from "../bokio/settings.js";

const STATE_COOKIE = "bokio_oauth_state";
const redirectUri = `${config.BASE_URL}/connect/bokio/callback`;

async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}

export const connectBokio = new Hono();

// Kick off Bokio's authorization-code flow for the signed-in user.
connectBokio.get("/connect/bokio", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect("/sign-in");

  const state = randomUUID();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.BASE_URL.startsWith("https"),
    maxAge: 600,
    path: "/connect",
  });

  const url = new URL(`${bokioSettings.authBaseUrl}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", bokioSettings.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.BOKIO_SCOPES);
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

connectBokio.get("/connect/bokio/callback", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect("/sign-in");

  const { code, state, error } = c.req.query();
  const expectedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/connect" });

  if (error) return c.text(`Bokio authorization failed: ${error}`, 400);
  if (!code || !state || !expectedState || state !== expectedState) {
    return c.text("Invalid OAuth state — please retry from the dashboard.", 400);
  }

  const tokens = await exchangeAuthorizationCode(code, redirectUri);

  // Best effort: resolve the company name for a friendly dashboard/tool listing.
  let companyName: string | null = null;
  try {
    const res = await fetch(
      `${bokioSettings.apiBaseUrl}/companies/${tokens.tenant_id}/company-information`,
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as { companyInformation?: { name?: string } };
      companyName = body.companyInformation?.name ?? null;
    }
  } catch {
    // name stays null; connection still works
  }

  const values = {
    userId: user.id,
    provider: "bokio" as const,
    tenantId: tokens.tenant_id,
    externalConnectionId: tokens.connection_id ?? null,
    companyName,
    accessTokenEnc: encryptToken(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: config.BOKIO_SCOPES,
    status: "active" as const,
  };
  await db
    .insert(accountingConnection)
    .values(values)
    .onConflictDoUpdate({
      target: [accountingConnection.userId, accountingConnection.provider, accountingConnection.tenantId],
      set: { ...values, updatedAt: new Date() },
    });

  // First connection grants the one-time card-less trial; an existing billing
  // row (however its trial stands) is never touched, so reconnecting or adding
  // companies can't re-grant it.
  await db
    .insert(billingAccount)
    .values({ userId: user.id, trialEndsAt: new Date(Date.now() + config.TRIAL_DAYS * 86_400_000) })
    .onConflictDoNothing({ target: billingAccount.userId });

  return c.redirect("/dashboard");
});

// Session-authenticated billing state for the dashboard page.
connectBokio.get("/api/billing", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const state = await getBillingState(user.id);
  const rows = await db
    .select({ status: accountingConnection.status })
    .from(accountingConnection)
    .where(eq(accountingConnection.userId, user.id));
  return c.json({
    ...state,
    activeConnections: rows.filter((r) => r.status === "active").length,
  });
});

// Session-authenticated JSON for the dashboard page.
connectBokio.get("/api/connections", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const rows = await db
    .select({
      id: accountingConnection.id,
      provider: accountingConnection.provider,
      tenantId: accountingConnection.tenantId,
      companyName: accountingConnection.companyName,
      status: accountingConnection.status,
      createdAt: accountingConnection.createdAt,
    })
    .from(accountingConnection)
    .where(eq(accountingConnection.userId, user.id));
  return c.json({ connections: rows });
});
