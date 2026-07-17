import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { checkEntitlement, getBillingState } from "../billing/entitlement.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";
import { encryptToken } from "../lib/crypto.js";
import { exchangeAuthorizationCode } from "../bokio/oauth.js";
import { bokioSettings } from "../bokio/settings.js";

const STATE_COOKIE = "bokio_oauth_state";
const redirectUri = `${config.BASE_URL}/connect/bokio/callback`;

async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}

async function activeConnectionCount(userId: string) {
  const rows = await db
    .select({ status: accountingConnection.status })
    .from(accountingConnection)
    .where(eq(accountingConnection.userId, userId));
  return rows.filter((r) => r.status === "active").length;
}

// Seat check shared by both connect paths: adding a *new* company needs a spare
// seat; re-connecting one already held (new OAuth grant, refreshed token) does
// not. Returns the entitlement so each caller can format its own response.
async function connectSeatCheck(userId: string, tenantId: string) {
  const [existing] = await db
    .select({ id: accountingConnection.id })
    .from(accountingConnection)
    .where(
      and(
        eq(accountingConnection.userId, userId),
        eq(accountingConnection.provider, "bokio"),
        eq(accountingConnection.tenantId, tenantId),
      ),
    );
  const activeCount = await activeConnectionCount(userId);
  return checkEntitlement(userId, existing ? activeCount : activeCount + 1);
}

// Best effort: resolve the company name for a friendly dashboard/tool listing.
// A failure just leaves the name null; the connection still works.
async function fetchCompanyName(tenantId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${bokioSettings.apiBaseUrl}/companies/${tenantId}/company-information`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { companyInformation?: { name?: string } };
      return body.companyInformation?.name ?? null;
    }
  } catch {
    // fall through
  }
  return null;
}

interface ConnectionInput {
  userId: string;
  authType: "oauth" | "integration_token";
  tenantId: string;
  externalConnectionId: string | null;
  companyName: string | null;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date;
  scopes: string | null;
}

async function upsertConnection(input: ConnectionInput) {
  const values = {
    userId: input.userId,
    provider: "bokio" as const,
    authType: input.authType,
    tenantId: input.tenantId,
    externalConnectionId: input.externalConnectionId,
    companyName: input.companyName,
    accessTokenEnc: encryptToken(input.accessToken),
    refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken) : null,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    scopes: input.scopes,
    status: "active" as const,
  };
  await db
    .insert(accountingConnection)
    .values(values)
    .onConflictDoUpdate({
      target: [accountingConnection.userId, accountingConnection.provider, accountingConnection.tenantId],
      set: { ...values, updatedAt: new Date() },
    });
}

export const connectBokio = new Hono();

// Kick off Bokio's authorization-code flow for the signed-in user.
connectBokio.get("/connect/bokio", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.redirect("/sign-in");

  // Checkout comes before connecting: no subscription (or trial), no connect.
  // Seat availability for a *new* company is enforced in the callback, where we
  // know which company was picked — re-authorizing an already-connected company
  // must not require a spare seat.
  const entitled = await checkEntitlement(user.id, await activeConnectionCount(user.id));
  if (!entitled.ok) return c.redirect("/dashboard?billing=required");

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

  const entitled = await connectSeatCheck(user.id, tokens.tenant_id);
  if (!entitled.ok) {
    return c.redirect(`/dashboard?billing=${entitled.reason === "seats_exceeded" ? "seats" : "required"}`);
  }

  const companyName = await fetchCompanyName(tokens.tenant_id, tokens.access_token);

  await upsertConnection({
    userId: user.id,
    authType: "oauth",
    tenantId: tokens.tenant_id,
    externalConnectionId: tokens.connection_id ?? null,
    companyName,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: config.BOKIO_SCOPES,
  });

  return c.redirect("/dashboard");
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
  const integrationToken = body.integrationToken?.trim();
  const companyId = body.companyId?.trim();
  if (!integrationToken || !companyId) {
    return c.json({ error: "missing_fields", message: "Both integrationToken and companyId are required." }, 400);
  }

  const entitled = await connectSeatCheck(user.id, companyId);
  if (!entitled.ok) return c.json({ error: entitled.reason, message: entitled.message }, 402);

  // Validate the token + companyId against the live API, which also gives us the
  // company name. A non-2xx here means the pair is wrong or the token is revoked.
  let companyName: string | null = null;
  try {
    const res = await fetch(`${bokioSettings.apiBaseUrl}/companies/${companyId}/company-information`, {
      headers: { Authorization: `Bearer ${integrationToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return c.json(
        {
          error: "invalid_token",
          message: `Bokio rejected that token and company ID (HTTP ${res.status}). Check both and try again.`,
        },
        400,
      );
    }
    const info = (await res.json()) as { companyInformation?: { name?: string } };
    companyName = info.companyInformation?.name ?? null;
  } catch {
    return c.json({ error: "unreachable", message: "Could not reach Bokio to validate the token." }, 502);
  }

  await upsertConnection({
    userId: user.id,
    authType: "integration_token",
    tenantId: companyId,
    externalConnectionId: null,
    companyName,
    accessToken: integrationToken,
    refreshToken: null,
    // Private integration tokens don't expire on a fixed schedule and can't be
    // refreshed; a far-future value keeps the not-null column honest while the
    // token-manager's authType branch bypasses expiry entirely.
    accessTokenExpiresAt: new Date("2999-01-01T00:00:00Z"),
    scopes: null,
  });

  return c.json({ ok: true, companyName, companyId });
});

// Remove a connected company. Scoped to the calling user's own rows.
connectBokio.post("/connect/bokio/disconnect", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { id } = (await c.req.json().catch(() => ({}))) as { id?: string };
  if (!id) return c.json({ error: "missing_id" }, 400);

  const deleted = await db
    .delete(accountingConnection)
    .where(and(eq(accountingConnection.id, id), eq(accountingConnection.userId, user.id)))
    .returning({ id: accountingConnection.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// Session-authenticated billing state for the dashboard page.
connectBokio.get("/api/billing", async (c) => {
  const user = await requireSession(c.req.raw.headers);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const state = await getBillingState(user.id);
  const activeConnections = await activeConnectionCount(user.id);
  return c.json({
    ...state,
    activeConnections,
    // Connecting is allowed while a spare seat exists; complimentary accounts
    // and disabled billing are unconstrained.
    canConnect:
      !state.billingEnabled ||
      state.complimentary ||
      (state.subscriptionStatus !== null && (state.seats ?? 1) > activeConnections),
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
      authType: accountingConnection.authType,
      tenantId: accountingConnection.tenantId,
      companyName: accountingConnection.companyName,
      status: accountingConnection.status,
      createdAt: accountingConnection.createdAt,
    })
    .from(accountingConnection)
    .where(eq(accountingConnection.userId, user.id));
  return c.json({ connections: rows });
});
