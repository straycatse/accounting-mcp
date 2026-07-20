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
  // Public origin of the Next.js web app (dashboard, sign-in, consent). The web
  // app proxies /api/*, /connect/* and /api/auth/* here, so browser-facing
  // redirects must target it. Defaults to BASE_URL for single-server dev/tests.
  WEB_URL: z.string().url().optional(),
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
  FORTNOX_CLIENT_ID: z.string().default(""),
  FORTNOX_CLIENT_SECRET: z.string().default(""),
  // Fortnox splits hosts: OAuth on apps.fortnox.se, API on api.fortnox.se.
  FORTNOX_AUTH_BASE_URL: z.string().url().default("https://apps.fortnox.se/oauth-v1"),
  FORTNOX_API_BASE_URL: z.string().url().default("https://api.fortnox.se"),
  // Space-separated Fortnox OAuth scopes. Load-bearing beyond the authorize
  // URL: tools/fortnox/index.ts registers only ops whose scope is listed here,
  // so this decides the tool surface too. Widening it requires ticking the
  // matching permission in the apps.fortnox.se portal. Deliberately omitted:
  // asset, salary, timereporting, warehouse, noxfinansinvoice (paid add-on
  // modules — requesting them imposes license requirements on customers).
  FORTNOX_SCOPES: z
    .string()
    .default(
      [
        "companyinformation bookkeeping invoice customer supplier supplierinvoice",
        "article archive inbox order offer project price costcenter currency",
        "settings connectfile payment print",
      ].join(" "),
    ),
  FORTNOX_ALLOW_WRITES: boolFromString,
  FORTNOX_MOCK: boolFromString,
  // Billing (Stripe via @better-auth/stripe). Off by default: everything is free
  // until launch. When enabled, users get a card-less TRIAL_DAYS trial starting
  // at their first company connection, then need an active subscription.
  BILLING_ENABLED: boolFromString,
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_ID: z.string().default(""),
  TRIAL_DAYS: z.coerce.number().int().nonnegative().default(14),
  BINARY_MAX_BYTES: z.coerce.number().int().positive().default(4 * 1024 * 1024),
  AUDIT_LOG_PARAMS: boolFromString,
});

export type Config = z.infer<typeof envSchema> & { WEB_URL: string };

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const config = { ...parsed.data, WEB_URL: parsed.data.WEB_URL ?? parsed.data.BASE_URL };
  if (
    config.BILLING_ENABLED &&
    (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET || !config.STRIPE_PRICE_ID)
  ) {
    console.warn(
      "[config] BILLING_ENABLED=true but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/STRIPE_PRICE_ID are not all set — checkout and webhooks will fail until they are configured.",
    );
  }
  if (!config.BOKIO_MOCK && (!config.BOKIO_CLIENT_ID || !config.BOKIO_CLIENT_SECRET)) {
    console.warn(
      "[config] BOKIO_CLIENT_ID/BOKIO_CLIENT_SECRET are not set and BOKIO_MOCK=false — Bokio connections will fail until credentials are configured.",
    );
  }
  if (!config.FORTNOX_MOCK && (!config.FORTNOX_CLIENT_ID || !config.FORTNOX_CLIENT_SECRET)) {
    console.warn(
      "[config] FORTNOX_CLIENT_ID/FORTNOX_CLIENT_SECRET are not set and FORTNOX_MOCK=false — Fortnox connections will fail until credentials are configured.",
    );
  }
  return config;
}

export const config = loadConfig();
