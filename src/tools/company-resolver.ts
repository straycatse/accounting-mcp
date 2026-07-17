import { and, eq } from "drizzle-orm";
import { checkEntitlement } from "../billing/entitlement.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";

type Connection = typeof accountingConnection.$inferSelect;

/**
 * Resolves which connected company a tool call targets. Single choke point for
 * tenant isolation: an explicit companyId must belong to the calling user.
 */
export async function resolveConnection(userId: string, companyId?: string): Promise<Connection> {
  const rows = await db
    .select()
    .from(accountingConnection)
    .where(and(eq(accountingConnection.userId, userId), eq(accountingConnection.provider, "bokio")));

  if (rows.length === 0) {
    throw new Error(
      `No Bokio company is connected. Ask the user to visit ${config.BASE_URL}/dashboard and click "Connect a Bokio company".`,
    );
  }

  const entitlement = await checkEntitlement(
    userId,
    rows.filter((r) => r.status === "active").length,
  );
  if (!entitlement.ok) throw new Error(entitlement.message);

  let connection: Connection | undefined;
  if (companyId) {
    connection = rows.find((r) => r.tenantId === companyId);
    if (!connection) {
      throw new Error(
        `companyId ${companyId} is not a company connected by this user. Connected: ${rows
          .map((r) => `${r.tenantId} (${r.companyName ?? "unnamed"})`)
          .join(", ")}`,
      );
    }
  } else if (rows.length === 1) {
    connection = rows[0]!;
  } else {
    throw new Error(
      `Multiple companies are connected — pass companyId. Options: ${rows
        .map((r) => `${r.tenantId} (${r.companyName ?? "unnamed"})`)
        .join(", ")}`,
    );
  }

  if (connection.status === "refresh_failed" || connection.status === "revoked") {
    throw new Error(
      `The connection to ${connection.companyName ?? connection.tenantId} is ${connection.status}; the user must reconnect it from ${config.BASE_URL}/dashboard.`,
    );
  }
  return connection;
}
