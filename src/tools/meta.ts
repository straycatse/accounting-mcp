import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { accountingConnection } from "../db/schema.js";
import { jsonResult, textResult, type ToolDef } from "./registry.js";

export const metaTools: ToolDef[] = [
  {
    name: "list_companies",
    title: "List connected companies",
    description:
      "Lists the accounting companies the user has connected. Use the returned companyId with other tools when more than one company is connected.",
    input: {},
    readOnly: true,
    handler: async (_args, ctx) => {
      const rows = await db
        .select({
          companyId: accountingConnection.tenantId,
          provider: accountingConnection.provider,
          companyName: accountingConnection.companyName,
          status: accountingConnection.status,
        })
        .from(accountingConnection)
        .where(eq(accountingConnection.userId, ctx.userId));
      if (rows.length === 0) {
        return textResult(
          `No accounting companies are connected yet. Ask the user to visit ${config.BASE_URL}/dashboard and click "Connect a Bokio company", then try again.`,
        );
      }
      return jsonResult(rows);
    },
  },
  {
    name: "get_connection_status",
    title: "Get connection status",
    description:
      "Shows the health of the user's accounting connections (token status, connected timestamps) and whether write operations are enabled on this server.",
    input: {},
    readOnly: true,
    handler: async (_args, ctx) => {
      const rows = await db
        .select({
          companyId: accountingConnection.tenantId,
          provider: accountingConnection.provider,
          companyName: accountingConnection.companyName,
          status: accountingConnection.status,
          accessTokenExpiresAt: accountingConnection.accessTokenExpiresAt,
          createdAt: accountingConnection.createdAt,
        })
        .from(accountingConnection)
        .where(eq(accountingConnection.userId, ctx.userId));
      return jsonResult({
        writesEnabled: config.BOKIO_ALLOW_WRITES,
        mockMode: config.BOKIO_MOCK,
        connections: rows,
      });
    },
  },
];
