import "dotenv/config";
import { z } from "zod";

const boolFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Public base URL of this server (OAuth issuer, redirect URIs). No trailing slash.
  BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  // base64-encoded 32-byte key for AES-256-GCM encryption of provider tokens
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "must be base64 of exactly 32 bytes (generate: openssl rand -base64 32)",
    }),
  BOKIO_CLIENT_ID: z.string().default(""),
  BOKIO_CLIENT_SECRET: z.string().default(""),
  BOKIO_AUTH_BASE_URL: z.string().url().default("https://api.bokio.se/v1"),
  BOKIO_API_BASE_URL: z.string().url().default("https://api.bokio.se/v1"),
  // Scope names as documented per-operation in specs/company-api.yaml.
  // bank-payments:* are "elevated" scopes that Bokio must approve per
  // integration — request approval in the developer portal, then add them
  // back via the BOKIO_SCOPES env var.
  BOKIO_SCOPES: z
    .string()
    .default(
      [
        "chart-of-accounts:read",
        "company-information:read credit-notes:read credit-notes:write",
        "customers:read customers:write fiscal-years:read invoices:read invoices:write",
        "items:read items:write journal-entries:read journal-entries:write sie:read",
        "supplier-invoices:read supplier-invoices:write suppliers:read suppliers:write",
        "tags:read tags:write uploads:read uploads:write",
      ].join(" "),
    ),
  BOKIO_ALLOW_WRITES: boolFromString,
  BOKIO_MOCK: boolFromString,
  BINARY_MAX_BYTES: z.coerce.number().int().positive().default(4 * 1024 * 1024),
  AUDIT_LOG_PARAMS: boolFromString,
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const config = parsed.data;
  if (!config.BOKIO_MOCK && (!config.BOKIO_CLIENT_ID || !config.BOKIO_CLIENT_SECRET)) {
    console.warn(
      "[config] BOKIO_CLIENT_ID/BOKIO_CLIENT_SECRET are not set and BOKIO_MOCK=false — Bokio connections will fail until credentials are configured.",
    );
  }
  return config;
}

export const config = loadConfig();
