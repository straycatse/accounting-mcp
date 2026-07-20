// Connection + billing dashboard logic shared by the REST routes
// (src/auth/connect-bokio.ts) and the tRPC router (src/trpc/router.ts).
import { and, eq } from "drizzle-orm";
import { checkEntitlement, getBillingState } from "../billing/entitlement.js";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";
import type { MessageKey } from "../lib/app-error.js";
import { encryptToken } from "../lib/crypto.js";
import { bokioSettings } from "../bokio/settings.js";

export async function activeConnectionCount(userId: string) {
  const rows = await db
    .select({ status: accountingConnection.status })
    .from(accountingConnection)
    .where(eq(accountingConnection.userId, userId));
  return rows.filter((r) => r.status === "active").length;
}

// Seat check shared by both connect paths: adding a *new* company needs a spare
// seat; re-connecting one already held (new OAuth grant, refreshed token) does
// not. Returns the entitlement so each caller can format its own response.
export async function connectSeatCheck(
  userId: string,
  provider: "bokio" | "fortnox",
  tenantId: string,
) {
  const [existing] = await db
    .select({ id: accountingConnection.id })
    .from(accountingConnection)
    .where(
      and(
        eq(accountingConnection.userId, userId),
        eq(accountingConnection.provider, provider),
        eq(accountingConnection.tenantId, tenantId),
      ),
    );
  const activeCount = await activeConnectionCount(userId);
  return checkEntitlement(userId, existing ? activeCount : activeCount + 1);
}

// Best effort: resolve the company name for a friendly dashboard/tool listing.
// A failure just leaves the name null; the connection still works.
export async function fetchCompanyName(tenantId: string, accessToken: string): Promise<string | null> {
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

export interface ConnectionInput {
  userId: string;
  provider: "bokio" | "fortnox";
  authType: "oauth" | "integration_token";
  tenantId: string;
  externalConnectionId: string | null;
  companyName: string | null;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date;
  scopes: string | null;
}

export async function upsertConnection(input: ConnectionInput) {
  const values = {
    userId: input.userId,
    provider: input.provider,
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

// Failures are described by a message-catalog key, not prose: this result is
// only ever rendered in the browser, where the reader's language is known.
export type TokenConnectResult =
  | { ok: true; companyName: string | null; companyId: string }
  | ({ ok: false; error: string; httpStatus: 400 | 402 | 502 } & MessageKey);

// Connect a single company directly with a Bokio *private integration* token.
// Validates the token + companyId against the live API (which also yields the
// company name); a non-2xx means the pair is wrong or the token is revoked.
export async function connectViaToken(
  userId: string,
  integrationTokenRaw: string | undefined,
  companyIdRaw: string | undefined,
): Promise<TokenConnectResult> {
  const integrationToken = integrationTokenRaw?.trim();
  const companyId = companyIdRaw?.trim();
  if (!integrationToken || !companyId) {
    return {
      ok: false,
      error: "missing_fields",
      key: "connect.missingFields",
      httpStatus: 400,
    };
  }

  const entitled = await connectSeatCheck(userId, "bokio", companyId);
  if (!entitled.ok) {
    return {
      ok: false,
      error: entitled.reason,
      key: entitled.key,
      params: entitled.params,
      httpStatus: 402,
    };
  }

  let companyName: string | null = null;
  try {
    const res = await fetch(`${bokioSettings.apiBaseUrl}/companies/${companyId}/company-information`, {
      headers: { Authorization: `Bearer ${integrationToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: "invalid_token",
        key: "connect.tokenRejected",
        params: { status: res.status },
        httpStatus: 400,
      };
    }
    const info = (await res.json()) as { companyInformation?: { name?: string } };
    companyName = info.companyInformation?.name ?? null;
  } catch {
    return { ok: false, error: "unreachable", key: "connect.providerUnreachable", httpStatus: 502 };
  }

  await upsertConnection({
    userId,
    provider: "bokio",
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

  return { ok: true, companyName, companyId };
}

/** Removes a connection. Scoped to the calling user's own rows. */
export async function disconnectConnection(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(accountingConnection)
    .where(and(eq(accountingConnection.id, id), eq(accountingConnection.userId, userId)))
    .returning({ id: accountingConnection.id });
  return deleted.length > 0;
}

/** Billing state + connection count as shown on the dashboard. */
export async function billingSummary(userId: string) {
  const state = await getBillingState(userId);
  const activeConnections = await activeConnectionCount(userId);
  return {
    ...state,
    activeConnections,
    // Connecting is allowed while a spare seat exists; complimentary accounts
    // and disabled billing are unconstrained.
    canConnect:
      !state.billingEnabled ||
      state.complimentary ||
      (state.subscriptionStatus !== null && (state.seats ?? 1) > activeConnections),
  };
}

export async function listConnections(userId: string) {
  return db
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
    .where(eq(accountingConnection.userId, userId));
}
