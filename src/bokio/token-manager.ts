import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";
import { decryptToken, encryptToken } from "../lib/crypto.js";
import { BokioOAuthError, refreshBokioToken } from "./oauth.js";

type Connection = typeof accountingConnection.$inferSelect;

const REFRESH_MARGIN_MS = 60_000;

// Per-connection mutex so concurrent tool calls don't stampede the refresh
// endpoint (Bokio rotates refresh tokens — a lost rotation bricks the connection).
const refreshLocks = new Map<string, Promise<string>>();

async function doRefresh(connection: Connection): Promise<string> {
  if (!connection.refreshTokenEnc) {
    throw new Error(
      `The connection to ${connection.companyName ?? connection.tenantId} has no refresh token; reconnect the company from the dashboard.`,
    );
  }
  try {
    const tokens = await refreshBokioToken(decryptToken(connection.refreshTokenEnc));
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
    if (err instanceof BokioOAuthError && err.status >= 400 && err.status < 500) {
      await db
        .update(accountingConnection)
        .set({ status: "refresh_failed", updatedAt: new Date() })
        .where(eq(accountingConnection.id, connection.id));
      throw new Error(
        `Bokio rejected the refresh token for ${connection.companyName ?? connection.tenantId}; the user must reconnect the company from the dashboard.`,
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
export async function getValidAccessToken(connection: Connection): Promise<string> {
  if (connection.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return decryptToken(connection.accessTokenEnc);
  }
  return refreshWithLock(connection);
}

/** Reactive path: the API returned 401 despite a seemingly valid token. */
export async function forceRefreshAccessToken(connection: Connection): Promise<string> {
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
