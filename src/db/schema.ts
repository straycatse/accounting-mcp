// Application tables + better-auth generated tables (auth-schema.ts, regenerate with
// `npx @better-auth/cli generate --config src/auth/auth.ts --output src/db/auth-schema.ts`).

import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export * from "./auth-schema.js";

export const toolAuditLog = pgTable("tool_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  provider: text("provider"),
  tenantId: text("tenant_id"),
  toolName: text("tool_name").notNull(),
  mutating: boolean("mutating").notNull(),
  success: boolean("success").notNull(),
  durationMs: integer("duration_ms").notNull(),
  errorCode: text("error_code"),
  params: text("params"), // truncated JSON, only when AUDIT_LOG_PARAMS=true
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountingConnection = pgTable(
  "accounting_connection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'bokio' (Fortnox/Visma later)
    tenantId: text("tenant_id").notNull(), // provider's company id
    externalConnectionId: text("external_connection_id"), // Bokio connection_id from token response
    companyName: text("company_name"),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    scopes: text("scopes"),
    status: text("status", { enum: ["active", "revoked", "refresh_failed"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("accounting_connection_user_provider_tenant").on(t.userId, t.provider, t.tenantId)],
);
