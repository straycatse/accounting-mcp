import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";
import { decryptToken, encryptToken } from "./crypto.js";

type Connection = typeof accountingConnection.$inferSelect;

const REFRESH_MARGIN_MS = 60_000;

export interface TokenManagerOptions {
  /** Human-readable provider name used in error messages, e.g. "Bokio". */
  providerLabel: string;
  refresh: (
    refreshToken: string,
  ) => Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
  /** True when the refresh failure means the grant is dead (vs. a transient error). */
  isAuthError: (err: unknown) => boolean;
}

/**
 * Per-provider access-token lifecycle: proactive refresh near expiry, one
 * shared in-flight refresh per connection, and persistence of rotated refresh
 * tokens (both Bokio and Fortnox rotate refresh tokens — a lost rotation
 * bricks the connection).
 */
export function createTokenManager({ providerLabel, refresh, isAuthError }: TokenManagerOptions) {
  // Per-connection mutex so concurrent tool calls don't stampede the refresh endpoint.
  const refreshLocks = new Map<string, Promise<string>>();

  async function doRefresh(connection: Connection): Promise<string> {
    if (!connection.refreshTokenEnc) {
      throw new Error(
        `The connection to ${connection.companyName ?? connection.tenantId} has no refresh token; reconnect the company from the dashboard.`,
      );
    }
    try {
      const tokens = await refresh(decryptToken(connection.refreshTokenEnc));
      await db
        .update(accountingConnection)
        .set({
          accessTokenEnc: encryptToken(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : connection.refreshTokenEnc,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(accountingConnection.id, connection.id));
      return tokens.access_token;
    } catch (err) {
      if (isAuthError(err)) {
        await db
          .update(accountingConnection)
          .set({ status: "refresh_failed", updatedAt: new Date() })
          .where(eq(accountingConnection.id, connection.id));
        throw new Error(
          `${providerLabel} rejected the refresh token for ${connection.companyName ?? connection.tenantId}; the user must reconnect the company from the dashboard.`,
        );
      }
      throw err;
    }
  }

  function refreshWithLock(connection: Connection): Promise<string> {
    const existing = refreshLocks.get(connection.id);
    if (existing) return existing;
    const pending = doRefresh(connection).finally(() => refreshLocks.delete(connection.id));
    refreshLocks.set(connection.id, pending);
    return pending;
  }

  /** Returns a valid access token, refreshing proactively when near expiry. */
  async function getValidAccessToken(connection: Connection): Promise<string> {
    // Private integration tokens are long-lived and have no refresh flow — use
    // the stored token as-is (a revoked one surfaces as a 401 handled below).
    if (connection.authType === "integration_token") {
      return decryptToken(connection.accessTokenEnc);
    }
    if (connection.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return decryptToken(connection.accessTokenEnc);
    }
    return refreshWithLock(connection);
  }

  /** Reactive path: the API returned 401 despite a seemingly valid token. */
  async function forceRefreshAccessToken(connection: Connection): Promise<string> {
    // A private integration token can't be refreshed; a 401 means it was revoked
    // or regenerated in the provider. Mark it and tell the user to reconnect.
    if (connection.authType === "integration_token") {
      await db
        .update(accountingConnection)
        .set({ status: "refresh_failed", updatedAt: new Date() })
        .where(eq(accountingConnection.id, connection.id));
      throw new Error(
        `${providerLabel} rejected the integration token for ${connection.companyName ?? connection.tenantId}. ` +
          `The user must create a new private integration token in ${providerLabel} and reconnect from the dashboard.`,
      );
    }
    // Re-read the row first: another concurrent call may have already rotated it.
    const [fresh] = await db
      .select()
      .from(accountingConnection)
      .where(eq(accountingConnection.id, connection.id));
    if (fresh && fresh.accessTokenEnc !== connection.accessTokenEnc) {
      return decryptToken(fresh.accessTokenEnc);
    }
    return refreshWithLock(fresh ?? connection);
  }

  return { getValidAccessToken, forceRefreshAccessToken };
}
